import { readFileSync, writeFileSync } from 'fs';

const KEY = process.env.DEEPSEEK_API_KEY || '';
if (!KEY) { console.error('Set DEEPSEEK_API_KEY'); process.exit(1); }

const lessons = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));

async function callAI(system, user) {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.3, max_tokens: 4096, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  const d = await r.json();
  return d.choices[0].message.content;
}

function extractHTML(text) {
  let t = text.replace(/```html\s*\n?/i, '').replace(/```\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  const htmlStart = t.indexOf('<!DOCTYPE');
  const htmlEnd = t.lastIndexOf('</html>');
  if (htmlStart >= 0 && htmlEnd > htmlStart) return t.substring(htmlStart, htmlEnd + 7);
  const hStart = t.indexOf('<html');
  const hEnd = t.lastIndexOf('</html>');
  if (hStart >= 0 && hEnd > hStart) return '<!DOCTYPE html>\n' + t.substring(hStart, hEnd + 7);
  return null;
}

const VIDEO_PROMPT = `你是C++教学可视化专家。生成一个自播放的算法讲解视频HTML页面。

规则：
- **绝对不能出现任何C++代码**（不要#include, int main, cout等）
- 用GSAP Timeline自动播放算法过程（无交互按钮），逐步展示：输入 → 计算 → 输出
- 用彩色方块、数字、箭头等可视化元素
- 包含标题卡片（题目标题）和结束卡片（总结）
- 引入 GSAP CDN: https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js
- 页面底部放播放控制：[▶播放/⏸暂停] [🔄重播] 和进度条
- 适合中小学生观看，活泼配色
- 页面加载后自动开始播放（用GSAP的timeline.play()）
- 在页面底部隐藏一个<div id="narration-text" style="display:none">，里面放给TTS朗读的分步讲解文本（用中文句号分隔）
- 输出完整HTML（从<!DOCTYPE html>开始），不要markdown包裹`;

let done = 0, skipped = 0, total = 0;

for (const l of lessons) {
  for (const p of [...(l.homework || []), ...(l.extended || [])]) {
    const code = p.code || p.answerCode || '';
    if (!code || code.length < 30) continue;
    total++;

    const fname = 'video_' + l.order + '_' + (p.title || '').replace(/[^a-zA-Z0-9一-鿿]/g, '_').substring(0, 30) + '.html';

    if (p.videoHTML && p.videoHTML.length > 200) { skipped++; continue; }

    try {
      const thinking = p.thinking || '';
      const html = await callAI(VIDEO_PROMPT,
        `课程：${l.title}\n题目：${p.title}\n解题思路（用于生成讲解文本）：\n${thinking}\n参考答案（仅用于理解算法逻辑，不要展示代码）：\n${code.substring(0, 1200)}`
      );
      const cleaned = extractHTML(html);
      if (cleaned && cleaned.length > 500) {
        p.videoHTML = cleaned;
        p.videoFile = fname;
        done++;
        process.stdout.write('V');
      } else { process.stdout.write('x'); }
    } catch (e) { process.stdout.write('E'); }

    if (total % 5 === 0) {
      writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
      process.stdout.write(` [${done}/${total-skipped}] `);
    }
  }
}

writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
console.log(`\nGenerated: ${done} / ${total} | Skipped: ${skipped}`);
