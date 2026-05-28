/**
 * Rebuild lessons.json entirely from OJ API data
 * Discard all OCR/AI-generated descriptions
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const CK = `_ga=GA1.2.333065525.1746419898; internal_account_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJUb2tlbiIsImF1dGgiOiJST0xFX0FETUlOIiwibmFtZSI6IumfqeS4peWogSIsImVuaWQiOjEzODUsImlhdCI6MTc3ODQwOTk4NiwianRpIjoiMjM4YmQ5NjItZjU1YS00MzI0LThjYTktZjI3ZWU5YWMxZWJiIiwiZW1haWwiOiJoYW55YW53ZWlAY29kZW1hby5jbiJ9.vArSHnntPWkbOhTHjKv6YIWhaidLAT_pgT3mTXpTvaw; authorization=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDb2RlbWFvIEF1dGgiLCJ1c2VyX3R5cGUiOiJzdHVkZW50IiwiZGV2aWNlX2lkIjowLCJ1c2VyX2lkIjoyNDUxNTUzLCJpc3MiOiJBdXRoIFNlcnZpY2UiLCJwaWQiOiJ4Sm9GRG8ybyIsImV4cCI6NDEwMjQ0NDc5OSwiaWF0IjoxNzc4NDIzMTY2LCJqdGkiOiI3YWY2MTU4Yy1hOTdmLTQ1NzMtYjg0ZS03NzIyZWNmZmQ3ODUifQ.Cuj6K0ivMOOxNfWQQLXmA3AuDejsZLaxkRKshrCmIkk`;

function curl(url, opts = {}) {
  try {
    let extra = '';
    if (opts.body) {
      extra = `-X POST -H "content-type: application/json" -d '${JSON.stringify(opts.body)}'`;
    }
    const cmd = `curl -s --compressed "${url}" ${extra} -H "origin: https://oj.codemao.cn" -b "${CK}"`;
    return JSON.parse(execSync(cmd, { maxBuffer: 50 * 1024 * 1024, timeout: 15000 }).toString());
  } catch (e) { return null; }
}

function strip(h) {
  if (!h) return '';
  return h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\\n/g, '\n').trim();
}

function cleanName(n) {
  return (n || '').replace(/[0-9_\s\-【】\[\]（）\(\)\.\,\;\:\!\?\#\$\%\^\&\*\+\=\/\\\|\{\}\"\'\~\`\@]/g, '').toLowerCase();
}

function isGarbled(text) {
  if (!text || text.length < 5) return false;
  const valid = text.replace(/[a-zA-Z0-9\s一-鿿　-〿＀-￯.,;:!?\n\r【】（）\[\]：。，、\-\+\*\/\=\|]/g, '');
  return valid.length / text.length > 0.1;
}

const OJ = 'https://api-oj.codemao.cn';
const CLS = 'https://api-live-class-crm.codemao.cn/live/teacher/class-board';

// Step 1: Index ALL OJ questions
console.log('Step 1: Indexing OJ questions...');
const ojByName = {};
const ojById = {};
let page = 1;
while (true) {
  const d = curl(`${OJ}/question/lib`, { body: { page, limit: 1000, submitResults: [], languageType: 1 } });
  if (!d || !d.items || !d.items.length) break;
  d.items.forEach(q => {
    const name = cleanName(q.name);
    if (name.length >= 2) {
      if (!ojByName[name]) ojByName[name] = [];
      ojByName[name].push(q.id);
    }
    ojById[q.id] = q;
  });
  console.log(`  Page ${page}: ${d.items.length} items`);
  if (page * 1000 >= (d.total || 0)) break;
  page++;
}
console.log(`  Total: ${Object.keys(ojById).length} OJ questions indexed`);

// Step 2: Fetch class board step data
console.log('Step 2: Fetching class board steps...');
const CLASSES = [{ id: 427 }, { id: 738 }, { id: 1610 }];
const lessonMatches = {};

for (const cls of CLASSES) {
  const listData = curl(`${CLS}/lessons/all?classId=${cls.id}&limitLocked=true`);
  if (!listData || !listData.data) continue;
  console.log(`  Class ${cls.id}: ${listData.data.length} lessons`);

  for (const al of listData.data) {
    const num = parseInt((al.name || '').match(/P(\d+)/)?.[1]);
    if (!num) continue;

    const dData = curl(`${CLS}/courses/overall/dynamic?lessonId=${al.id}`);
    if (!dData || !dData.data || !dData.data.length) continue;
    const course = dData.data[0];

    const steps = (course.stepList || []).filter(s => s.type === 21);
    const links = course.linkList || [];
    if (!steps.length) continue;

    // Categorize steps and find matching OJ questions
    const cats = { inclass: [], homework: [], extended: [] };
    for (const s of steps) {
      const sn = (s.name || '').toLowerCase();
      const link = links.find(l => {
        const ln = (l.name || '').toLowerCase();
        if (sn.includes('课后') || sn.includes('作业')) return ln.includes('作业');
        if (sn.includes('拓展') || sn.includes('扩展')) return ln.includes('拓展') || ln.includes('扩展');
        return ln.includes('oj') || ln.includes('课中');
      });
      if (!link) continue;

      let cat = 'inclass';
      const ln = (link.name || '').toLowerCase();
      if (ln.includes('作业')) cat = 'homework';
      else if (ln.includes('拓展') || ln.includes('扩展')) cat = 'extended';

      // Find OJ question by exact clean name match only (no fuzzy)
      const cn = cleanName(s.name);
      const qIds = ojByName[cn] || [];

      // Only use match if step has a meaningful name (not generic like "课后作业1")
      const isGeneric = /^(课后作业|拓展练习|课后拓展|作业|练习|课中oj)\d*$/.test(cn);
      if (qIds.length && !isGeneric) {
        cats[cat].push({ stepName: s.name, qIds, idx: cats[cat].length });
      }
    }

    if (cats.inclass.length || cats.homework.length || cats.extended.length) {
      lessonMatches[num] = cats;
      process.stdout.write('.');
    } else {
      process.stdout.write('o');
    }
  }
}

// Step 3: Fetch OJ details and update lessons
console.log('\nStep 3: Fetching OJ question details...');
const lessons = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));

// Keep existing descriptions, only OVERWRITE with OJ data
console.log('  Keeping existing descriptions, overlaying OJ data...');

const detailCache = {};
let matched = 0;
let fetched = 0;

for (const [num, cats] of Object.entries(lessonMatches)) {
  const lesson = lessons[parseInt(num) - 1];
  if (!lesson) continue;

  for (const [cat, items] of Object.entries(cats)) {
    const group = cat === 'homework' ? lesson.homework : cat === 'extended' ? lesson.extended : lesson.inClassCodes;
    if (!group) continue;

    for (const item of items) {
      if (item.idx >= group.length) continue;
      const qId = item.qIds[0];
      if (!qId) continue;

      // Fetch detail
      if (detailCache[qId] === undefined) {
        detailCache[qId] = curl(`${OJ}/question/detail?questionId=${qId}`);
        fetched++;
      }
      const detail = detailCache[qId];
      if (!detail || !detail.description) continue;

      let desc = strip(detail.description || '');
      const od = detail.ojDetail || {};

      if (od.inputType) { const t = strip(od.inputType); if (t) desc += '\n【输入格式】\n' + t; }
      if (od.outputType) { const t = strip(od.outputType); if (t) desc += '\n【输出格式】\n' + t; }
      if (od.dataRange) { const t = strip(od.dataRange); if (t) desc += '\n【数据范围】\n' + t; }
      if (od.timeLimit) desc += `\n【时间限制】${od.timeLimit}ms`;
      if (od.memoryLimit) desc += ` 【内存限制】${od.memoryLimit}MB`;

      if (od.example) {
        try {
          const exs = typeof od.example === 'string' ? JSON.parse(od.example) : od.example;
          if (Array.isArray(exs)) {
            exs.forEach((ex, i) => desc += `\n【样例${i + 1}】\n输入：${ex.in || ''}\n输出：${ex.out || ''}`);
          }
        } catch (e) { }
      }

      // Knowledge tags
      if (detail.sourceDictList && detail.sourceDictList.length) {
        desc += '\n【标签】' + detail.sourceDictList.map(d => d.dictValue).join(' | ');
      }

      const p = group[item.idx];
      if (p) {
        p.description = desc.substring(0, 2000);
        matched++;
      }
    }
  }
}

console.log(`  Fetched ${fetched} OJ details, matched ${matched} problems`);

// Step 4: Enrich knowledgePoints from OJ tags
console.log('Step 4: Enriching knowledge points...');
lessons.forEach(l => {
  const tags = new Set();
  [...(l.inClassCodes || []), (l.homework || []), (l.extended || [])].forEach(p => {
    if (!p || !p.description) return;
    const m = p.description.match(/【标签】(.+)/);
    if (m) m[1].split('|').forEach(t => tags.add(t.trim()));
  });
  if (tags.size > 0 && (!l.knowledgePoints || !l.knowledgePoints.length)) {
    l.knowledgePoints = [...tags].map(t => ({ name: t, detail: '' }));
  }
});

// Step 5: Quality check & clean garbled
console.log('Step 5: Quality check...');
let haveDesc = 0, noDesc = 0, total = 0, garbledCount = 0;
lessons.forEach(l => {
  [...(l.inClassCodes || []), (l.homework || []), (l.extended || [])].forEach(p => {
    if (!p || !p.title) return;
    total++;
    const d = p.description || '';
    if (d.length > 0 && isGarbled(d)) {
      garbledCount++;
      p.description = '';
      noDesc++;
    } else if (d.length > 20) {
      haveDesc++;
    } else {
      noDesc++;
    }
  });
});

writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));

console.log(`\n=== Results ===`);
console.log(`OJ-matched descriptions: ${haveDesc}/${total} (${(haveDesc / total * 100).toFixed(0)}%)`);
console.log(`No description: ${noDesc}`);
console.log(`Garbled cleared: ${garbledCount}`);
console.log('Done');
