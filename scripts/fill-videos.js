import { readFileSync, writeFileSync } from 'fs';
import { VIDEO_SYSTEM, VIDEO_USER, extractHTML } from '../shared/services/gen-prompts.js';

const KEY = process.env.DEEPSEEK_API_KEY || '';
if (!KEY) { console.error('Set DEEPSEEK_API_KEY'); process.exit(1); }

const lessons = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));

async function callAI(system, user) {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.3, max_tokens: 8192, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  const d = await r.json();
  return d.choices[0].message.content;
}

let done = 0, total = 0;
for (const l of lessons) {
  for (const p of [...(l.homework || []), ...(l.extended || [])]) {
    const code = (p.code || p.answerCode || '').trim();
    if (code.length < 10) continue;
    if (p.videoHTML) { total++; done++; continue; }
    total++;

    try {
      const result = await callAI(VIDEO_SYSTEM, VIDEO_USER(l.title, p.title, p.thinking || '', code));
      const html = extractHTML(result);
      if (html) {
        p.videoHTML = html;
        p.videoFile = 'video_' + l.order + '_' + (p.title || '').replace(/[^a-zA-Z0-9一-鿿]/g, '_').substring(0, 30) + '.html';
        done++; process.stdout.write('V');
      } else { process.stdout.write('x'); }
    } catch (e) { process.stdout.write('E'); }

    if (done % 10 === 0) {
      writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
      process.stdout.write(` ${done}/${total} `);
    }
  }
}
writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
console.log(`\nVideos: ${done}/${total}`);
