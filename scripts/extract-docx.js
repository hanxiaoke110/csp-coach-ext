/**
 * Extract problem descriptions from DOCX teaching plans
 * Usage: node scripts/extract-docx.js
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_FILE = resolve(ROOT, 'shared/data/lessons.json');
const DOCX_DIR = resolve(ROOT, '教案/教案doc合集');
const EXTRACT_DIR = resolve(ROOT, 'shared/data/docx-extracts');

if (!existsSync(EXTRACT_DIR)) mkdirSync(EXTRACT_DIR, { recursive: true });

async function extractOne(num) {
  const path = resolve(DOCX_DIR, `P${num}教案.docx`);
  if (!existsSync(path)) return null;
  console.log(`  P${num}...`);
  const r = await mammoth.extractRawText({ path });
  const text = r.value;

  // Save extract
  writeFileSync(resolve(EXTRACT_DIR, `P${num}.txt`), text);

  // Parse descriptions from appendix/homework sections
  const descriptions = [];
  const appendixIdx = text.indexOf('附录');
  const target = appendixIdx > 0 ? text.substring(appendixIdx) : text;

  // Match problem patterns: "题目 X-YYYY" followed by description
  const problemRegex = /题目\s*\d+\s*[-–]\s*\d+\s*\n+(.+?)(?=\n\s*题目|\n\s*#include|\n\s*$)/gs;
  let match;
  while ((match = problemRegex.exec(target)) !== null) {
    descriptions.push(match[1].trim().substring(0, 200));
  }

  // Also match "题目 1-7590" style in extended exercises
  const extRegex = /题目\s*(\d+[-–]\d+)\s*\n+(.+?)(?=\n\s*#include|\n\s*题目|\n\s*$)/gs;
  while ((match = extRegex.exec(target)) !== null) {
    const desc = match[2].trim().substring(0, 200);
    if (desc && !desc.startsWith('#include')) {
      descriptions.push(`题目${match[1]}: ${desc}`);
    }
  }

  return { text, descriptions };
}

async function main() {
  const lessons = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  let extracted = 0;

  for (const lesson of lessons) {
    const num = lesson.order;
    try {
      const result = await extractOne(num);
      if (!result) continue;

      // Apply descriptions to problems
      const all = [...(lesson.homework || []), ...(lesson.extended || []), ...(lesson.inClassCodes || [])];
      let applied = 0;

      for (const p of all) {
        // Skip if already has good description
        if (p.description && p.description.length > 10 && !p.description.startsWith('编写C++') && !p.description.startsWith('题目：')) continue;

        // Find matching description from extracted text
        // Match by problem number pattern in title
        const numMatch = p.title.match(/(\d{3,6})/);
        if (numMatch) {
          const problemNum = numMatch[1];
          // Search in text for this problem number
          const regex = new RegExp(`题目\\s*\\d*[-–]\\s*${problemNum}\\s*\\n+(.+?)(?=\\n\\s*题目|\\n\\s*#include|\\n\\s*$)`, 's');
          const m = result.text.match(regex);
          if (m && m[1].trim().length > 3) {
            p.description = m[1].trim().substring(0, 300);
            applied++;
          }
        }
      }

      if (applied > 0) { extracted++; process.stdout.write('.'); }
    } catch (e) { process.stdout.write('x'); }
  }

  writeFileSync(DATA_FILE, JSON.stringify(lessons, null, 2));
  console.log(`\nExtracted ${extracted}/70 lessons`);
}

main().catch(e => { console.error(e); process.exit(1); });
