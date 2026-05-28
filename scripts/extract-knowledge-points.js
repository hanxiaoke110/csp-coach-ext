import { readFileSync, writeFileSync, readdirSync } from 'fs';

const KEY = process.env.DEEPSEEK_API_KEY || '';
if (!KEY) { console.error('Set DEEPSEEK_API_KEY'); process.exit(1); }

const SYSTEM = `你是C++信奥教学专家。从教案中提取本课的核心知识点。

输出JSON对象，格式：
{
  "kpSummary": "一句话概括本课学什么（30-50字，小学生能懂）",
  "knowledgePoints": [
    {"name":"知识点名（3-8字）","detail":"1-2句解释，说清是什么、用来干什么（20-40字）"}
  ]
}

规则：
- 每课4-6条知识点
- detail要具体，说清这个概念在C++里的作用和意义，不要说空话
- 只提取C++编程知识点，忽略教学流程、课堂管理、习题安排等
- name适合做标签，detail适合做说明文字
- 输出纯JSON，不要markdown包裹

示例输出：
{"kpSummary":"学习for循环的进阶控制：用循环变量和步长灵活遍历数据，掌握倒序输出，并通过打擂台法求最大最小值。","knowledgePoints":[{"name":"循环变量","detail":"for循环中的i不仅是计数器，还可以在循环体中参与运算，是实现遍历的核心变量"},{"name":"步长控制","detail":"通过i+=2、i+=3等控制每次循环的跳跃距离，能灵活跳过不需要的数据"},{"name":"for倒序","detail":"从n循环到1（i--），实现逆序遍历，常用于需要从后往前处理数据的场景"}]}`;

async function extract(lessonPath) {
  const content = readFileSync(lessonPath, 'utf-8');
  // Strip image URLs to save tokens
  const cleaned = content.replace(/!\[.*?\]\(https?:\/\/[^)]+\)/g, '[图]');

  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.1,
      max_tokens: 1024,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: cleaned.substring(0, 10000) }]
    })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  const text = d.choices[0].message.content;
  // Parse JSON object
  const t = text.replace(/```json\s*|```/g, '').trim();
  const objStart = t.indexOf('{'), objEnd = t.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) return JSON.parse(t.substring(objStart, objEnd + 1));
  return JSON.parse(t);
}

const MD_DIR = '教案/教案md合集';
const TARGETS = readdirSync(MD_DIR)
  .filter(f => f.endsWith('.md'))
  .map(f => {
    const m = f.match(/P(\d+)/);
    return m ? { order: parseInt(m[1]), file: MD_DIR + '/' + f } : null;
  })
  .filter(x => x && x.order > 0 && x.order <= 70)
  .sort((a, b) => a.order - b.order);

const lessons = JSON.parse(readFileSync('shared/data/lessons.json', 'utf-8'));

for (const target of TARGETS) {
  const lesson = lessons.find(l => l.order === target.order);
  if (!lesson) { console.log(`Lesson order=${target.order} not found`); continue; }
  try {
    const result = await extract(target.file);
    lesson.knowledgePoints = result.knowledgePoints || [];
    lesson.kpSummary = result.kpSummary || '';
    console.log(`P${target.order} ${lesson.title}: ✅ ${lesson.kpSummary}`);
    writeFileSync('shared/data/lessons.json', JSON.stringify(lessons, null, 2));
    await new Promise(r => setTimeout(r, 500));
  } catch (e) {
    console.error(`P${target.order} error:`, e.message);
  }
}

console.log('\nDone.');
