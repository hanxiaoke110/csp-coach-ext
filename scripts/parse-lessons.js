/**
 * 教案解析脚本
 * 读取 教案/教案md合集/P{id}教案.md 或 教案/教案doc合集/P{id}教案.docx
 * 调用 AI 提取结构化数据，输出到 shared/data/lessons.json
 *
 * 用法：
 *   DEEPSEEK_API_KEY=sk-xxx node scripts/parse-lessons.js
 *   DEEPSEEK_API_KEY=sk-xxx node scripts/parse-lessons.js --range=1,10  // 只解析 P1-P10
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MD_DIR = join(ROOT, '教案', '教案md合集');
const DATA_DIR = join(ROOT, 'shared', 'data');
const OUT_FILE = join(DATA_DIR, 'lessons.json');
const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

const EXTRACT_PROMPT = `你是教案解析助手。从以下教案中提取结构化数据，输出严格 JSON（不要 markdown 包裹）：

{
  "title": "课时标题",
  "kpSummary": "一句话概括本课学什么（30-50字）",
  "knowledgePoints": [{"name": "知识点名（3-8字）", "detail": "1-2句解释（20-40字）"}],
  "tags": ["标签1", "标签2"],
  "inClassCodes": [
    {
      "id": "ic-{课号}-1",
      "title": "代码示例标题",
      "description": "这个代码演示了什么",
      "code": "完整C++代码（保持原样，不要省略）",
      "commentary": "代码关键行的注释说明",
      "linkedHomeworks": ["p{课号}-hw-1"]
    }
  ],
  "homework": [
    {
      "id": "p{课号}-hw-1",
      "title": "作业题目名称",
      "hints": [
        {"q": "引导学生思考的问题", "a": "实在不会时给的提示"}
      ],
      "answerCode": "完整参考答案代码（保持原样）",
      "answerNotes": "讲解这道题的要点",
      "commonMistakes": [
        {"mistake": "学生常犯的错误", "fix": "如何修正"}
      ]
    }
  ]
}

【提取规则】
- knowledgePoints：从教学目标、知识点讲解部分提取，每课3-6个
- tags：跨课标签，如"for循环""数组""输入输出""排序""递归"
- inClassCodes：课上现场编写的演示代码。提取id、title、完整code、关键行注释
- homework：课后作业题目。提取id、标题、分步提示(hints的q/a)、完整参考答案、讲解要点、常见错误
- linkedHomeworks：inClassCode的id关联到哪些homework的id
- 如果某部分在教案中不存在，对应数组写空 []
- code字段保持原样，不要省略或改写
- hints的q是引导学生思考的问题，a是学生实在想不出来时看的提示（不是答案）

请只输出 JSON，不要任何其他文字。`;

function parseLessonId(filename) {
  const m = filename.match(/P(\d+)/);
  return m ? parseInt(m[1]) : null;
}

function parseRange() {
  const arg = process.argv.find(a => a.startsWith('--range='));
  if (!arg) return null;
  const [start, end] = arg.split('=')[1].split(',').map(Number);
  return { start, end };
}

async function callAI(content) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: EXTRACT_PROMPT },
        { role: 'user', content: content.substring(0, 16000) }
      ],
      temperature: 0.1,
      max_tokens: 8192
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices[0].message.content;
  const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  // Try parse, with JSON repair fallback
  try {
    return JSON.parse(clean);
  } catch (e1) {
    // Attempt 1: extract everything between first { and last }
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e2) {}
    }
    throw e1;
  }
}

async function parseOne(filepath, id) {
  const content = readFileSync(filepath, 'utf-8');
  const charCount = content.length;

  // 尝试用更少的 token：教案正文前面部分包含主要教学内容
  const truncated = content.substring(0, 16000);
  console.log(`  Parsing P${id} (${charCount} chars → ${truncated.length} sent)...`);

  const result = await callAI(truncated);
  result.id = `P${id}`;
  result.order = id;
  return result;
}

async function main() {
  if (!API_KEY) {
    console.error('错误：需要设置 DEEPSEEK_API_KEY 环境变量');
    console.error('用法: DEEPSEEK_API_KEY=sk-xxx node scripts/parse-lessons.js');
    console.error('      DEEPSEEK_API_KEY=sk-xxx node scripts/parse-lessons.js --range=1,10');
    process.exit(1);
  }

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const files = readdirSync(MD_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ file: f, id: parseLessonId(f) }))
    .filter(x => x.id !== null);

  // 支持范围过滤
  const range = parseRange();
  const targets = range
    ? files.filter(x => x.id >= range.start && x.id <= range.end)
    : files;

  // 加载已有数据（增量模式）
  const existing = new Map();
  if (existsSync(OUT_FILE)) {
    const prev = JSON.parse(readFileSync(OUT_FILE, 'utf-8'));
    prev.forEach(l => existing.set(l.id, l));
    console.log(`已加载 ${prev.length} 条已有数据，增量更新...\n`);
  }

  const results = [];
  let ok = 0, fail = 0;

  for (const { file, id } of targets.sort((a, b) => a.id - b.id)) {
    const filepath = join(MD_DIR, file);
    try {
      const lesson = await parseOne(filepath, id);
      results.push(lesson);
      ok++;
      console.log(`  ✅ P${id} — ${lesson.title} | 知识点:${lesson.knowledgePoints?.length || 0} 代码:${lesson.inClassCodes?.length || 0} 作业:${lesson.homework?.length || 0}`);
    } catch (e) {
      fail++;
      console.error(`  ❌ P${id} — ${e.message}`);
      // 使用旧数据或占位数据
      const fallback = existing.get(`P${id}`) || {
        id: `P${id}`, order: id,
        title: `第${id}课（需手动补充）`,
        kpSummary: '', knowledgePoints: [], tags: [], inClassCodes: [], homework: [],
        _parseError: e.message
      };
      results.push(fallback);
    }
  }

  // 合并没有重新解析的已有数据
  if (range) {
    existing.forEach((lesson, key) => {
      if (!results.find(r => r.id === key)) {
        results.push(lesson);
      }
    });
  }

  results.sort((a, b) => a.order - b.order);

  const outDir = dirname(OUT_FILE);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  writeFileSync(OUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n完成：${ok} 成功, ${fail} 失败, 共 ${results.length} 课 → ${OUT_FILE}`);

  if (fail > 0) {
    console.log('\n💡 失败的课可单独重试: DEEPSEEK_API_KEY=sk-xxx node scripts/parse-lessons.js --range=失败课号,失败课号');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
