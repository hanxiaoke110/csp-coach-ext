/**
 * Enrich lessons.json with problem descriptions from teaching plan MD files
 * Usage: DEEPSEEK_API_KEY=sk-xxx node scripts/enrich-lessons.js
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_FILE = resolve(ROOT, 'shared/data/lessons.json');
const MD_DIR = resolve(ROOT, '教案/教案md合集');
const API_KEY = process.env.DEEPSEEK_API_KEY;

const PROMPT = `从教案附录提取每道题的描述。输出JSON数组：[{"id":"题目标题或编号","desc":"题目要求原文"}]。只输出JSON。`;

async function extractOne(num) {
  const mdPath = resolve(MD_DIR, `P${num}教案.md`);
  if (!existsSync(mdPath)) return null;

  const md = readFileSync(mdPath, 'utf-8');
  const appendixStart = md.indexOf('# 附录');
  const content = appendixStart > 0 ? md.substring(appendixStart) : md;

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat', temperature: 0, max_tokens: 4096,
      messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: content.substring(0, 10000) }]
    })
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  let text = data.choices[0].message.content;
  text = text.replace(/```json\s*|```/g, '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end < 0) throw new Error('No JSON array found');
  return JSON.parse(text.substring(start, end + 1));
}

async function main() {
  if (!API_KEY) { console.error('Set DEEPSEEK_API_KEY'); process.exit(1); }

  const lessons = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  let enriched = 0;

  for (let i = 1; i <= 70; i++) {
    try {
      const descs = await extractOne(i);
      if (!descs || !descs.length) continue;

      const lesson = lessons[i - 1];
      if (!lesson) continue;

      let matched = 0;
      const all = [...(lesson.homework || []), ...(lesson.extended || []), ...(lesson.inClassCodes || [])];

      for (const p of all) {
        // Skip if already has real description
        if (p.description && p.description.length > 10 && !p.description.startsWith('编写C++') && !p.description.startsWith('题目：')) continue;

        const d = descs.find(x => {
          const xid = (x.id || '').replace(/[0-9\s\-【】\[\]]/g, '');
          const pid = (p.title || '').replace(/[0-9\s\-【】\[\]]/g, '');
          return pid.includes(xid) || xid.includes(pid) || xid === pid;
        });

        if (d && d.desc && d.desc !== '[图片题目]') {
          p.description = d.desc;
          matched++;
        }
      }

      if (matched > 0) { enriched++; process.stdout.write('.'); }
    } catch (e) {
      process.stdout.write('x');
    }
  }

  writeFileSync(DATA_FILE, JSON.stringify(lessons, null, 2));
  console.log(`\nEnriched ${enriched}/70 lessons`);
}

main().catch(e => { console.error(e); process.exit(1); });
