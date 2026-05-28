/**
 * Scrape problem descriptions from codemao API
 * Using teacher class board API with valid cookies
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_FILE = resolve(ROOT, 'shared/data/lessons.json');

const COOKIE = `_ga=GA1.2.333065525.1746419898; authorization=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDb2RlbWFvIEF1dGgiLCJ1c2VyX3R5cGUiOiJzdHVkZW50IiwiZGV2aWNlX2lkIjowLCJ1c2VyX2lkIjoyNDUxNTUzLCJpc3MiOiJBdXRoIFNlcnZpY2UiLCJwaWQiOiJ4Sm9GRG8ybyIsImV4cCI6NDEwMjQ0NDc5OSwiaWF0IjoxNzc4NDIzMTY2LCJqdGkiOiI3YWY2MTU4Yy1hOTdmLTQ1NzMtYjg0ZS03NzIyZWNmZmQ3ODUifQ.Cuj6K0ivMOOxNfWQQLXmA3AuDejsZLaxkRKshrCmIkk`;
const HEADERS = {
  "Cookie": COOKIE,
  "Origin": "https://space-teacher.codemao.cn",
  "Referer": "https://space-teacher.codemao.cn/"
};
const BASE = "https://api-live-class-crm.codemao.cn/live/teacher/class-board";
const CLASSES = [
  { classId: 427, name: "C1 (1-25)" },
  { classId: 738, name: "C2 (26-50)" },
  { classId: 1610, name: "C3 (51-71)" },
];

async function fetchJSON(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function stripHTML(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
}

function formatQuestion(q) {
  const desc = stripHTML(q.description || '');
  let text = desc;
  if (q.options?.length) {
    const opts = q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o.text}`).join('\n');
    text += '\n' + opts;
  }
  return text.substring(0, 500);
}

async function scrapeClass(classId) {
  // Get lesson list
  const listUrl = `${BASE}/courses/overall/dynamic?classId=${classId}`;
  console.log(`  Fetching lessons for class ${classId}...`);
  const listData = await fetchJSON(listUrl);
  const lessons = listData.data || [];
  console.log(`  Found ${lessons.length} lessons`);

  const allProblems = {};

  for (const lesson of lessons) {
    const lessonId = lesson.id;
    const lessonName = lesson.name || '';

    try {
      // Get lesson detail with step list
      const detailUrl = `${BASE}/courses/overall/dynamic?lessonId=${lessonId}`;
      const detailData = await fetchJSON(detailUrl);
      const courses = detailData.data || [];

      for (const course of courses) {
        const courseId = course.courseId;
        const steps = course.stepList || [];
        const links = course.linkList || [];

        for (const step of steps) {
          if (step.type !== 21 && step.type !== 22) continue; // type 21=OJ, 22=quiz
          const stepId = step.id;
          const stepName = step.name || '';

          // Find matching link
          const link = links.find(l => {
            const ln = (l.name || '').toLowerCase();
            const sn = stepName.toLowerCase();
            if (sn.includes('课后作业') && ln.includes('课后作业')) return true;
            if (sn.includes('拓展') && ln.includes('拓展')) return true;
            if (sn.includes('oj') && (ln.includes('oj') || ln.includes('课中'))) return true;
            if ((sn.includes('温故') || sn.includes('课堂小测')) && (ln.includes('温故') || ln.includes('课堂小测') || ln.includes('测试'))) return true;
            if (sn.includes('作业') && (ln.includes('作业') || ln.includes('oj'))) return true;
            return false;
          });

          if (!link) continue;

          try {
            const qUrl = `${BASE}/steps/questions?courseId=${courseId}&linkId=${link.id}&stepId=${stepId}`;
            const qData = await fetchJSON(qUrl);
            const questions = qData.data || [];

            questions.forEach(q => {
              const formatted = formatQuestion(q);
              if (formatted.length > 5) {
                const key = stepName.replace(/[0-9\s\-]/g, '');
                if (!allProblems[key]) allProblems[key] = [];
                allProblems[key].push({ name: stepName, index: allProblems[key].length, desc: formatted });
              }
            });
          } catch (e) {
            // skip individual question errors
          }
        }
      }

      process.stdout.write('.');
    } catch (e) {
      process.stdout.write('x');
    }
  }

  return allProblems;
}

function matchProblems(lessons, allProblems) {
  let matched = 0;

  for (const lesson of lessons) {
    const all = [...(lesson.inClassCodes || []), ...(lesson.homework || []), ...(lesson.extended || [])];

    for (const p of all) {
      const title = (p.title || '').replace(/[0-9\s\-【】\[\]]/g, '').toLowerCase();
      if (!title) continue;

      // Try to match by problem name
      for (const [stepName, questions] of Object.entries(allProblems)) {
        const cleanStep = stepName.replace(/[0-9\s\-]/g, '').toLowerCase();

        // Match: OJ problems match "课上OJ", homework matches "作业", extended matches "拓展"
        let typeMatch = false;
        if (cleanStep.includes('oj') || cleanStep.includes('班长') || cleanStep.includes('统计') || cleanStep.includes('数字')) {
          typeMatch = lesson.inClassCodes?.includes(p);
        } else if (cleanStep.includes('作业') || cleanStep.includes('课后')) {
          typeMatch = lesson.homework?.includes(p);
        } else if (cleanStep.includes('拓展') || cleanStep.includes('扩展')) {
          typeMatch = lesson.extended?.includes(p);
        }

        if (typeMatch && questions.length > 0) {
          // Find this problem's index within its group
          const group = typeMatch ? (lesson.inClassCodes?.includes(p) ? lesson.inClassCodes :
                                     lesson.homework?.includes(p) ? lesson.homework :
                                     lesson.extended) : null;
          if (!group) continue;
          const idx = group.indexOf(p);
          if (idx >= 0 && idx < questions.length) {
            const newDesc = questions[idx].desc;
            const currentDesc = p.description || '';
            if (newDesc.length > currentDesc.length) {
              p.description = newDesc;
              matched++;
            }
          }
        }
      }
    }
  }

  return matched;
}

async function main() {
  console.log("Scraping problem descriptions from codemao API...\n");

  const allProblems = {};
  for (const cls of CLASSES) {
    console.log(`\nClass ${cls.classId} (${cls.name}):`);
    const problems = await scrapeClass(cls.classId);
    Object.assign(allProblems, problems);
  }

  const lessons = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  const matched = matchProblems(lessons, allProblems);

  writeFileSync(DATA_FILE, JSON.stringify(lessons, null, 2));
  console.log(`\n\nMatched ${matched} problem descriptions`);
  console.log('Done');
}

main().catch(e => { console.error(e); process.exit(1); });
