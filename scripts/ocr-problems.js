/**
 * OCR problem images from DOCX teaching plans
 * Extracts images, runs tesseract OCR, matches text to problems
 * Usage: node scripts/ocr-problems.js [--range=1,5]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_FILE = resolve(ROOT, 'shared/data/lessons.json');
const DOCX_DIR = resolve(ROOT, '教案', '教案doc合集');

function parseRange() {
  const arg = process.argv.find(a => a.startsWith('--range='));
  if (!arg) return null;
  const [start, end] = arg.split('=')[1].split(',').map(Number);
  return { start, end };
}

async function extractImages(docxPath) {
  const images = [];
  await mammoth.convertToHtml({ path: docxPath }, {
    convertImage: mammoth.images.imgElement(async (image) => {
      const buf = await image.read();
      images.push({ buffer: Buffer.from(buf), contentType: image.contentType });
      return { src: '' };
    })
  });
  return images;
}

async function ocrImage(img) {
  try {
    const worker = await Tesseract.createWorker('chi_sim+eng');
    const { data: { text } } = await worker.recognize(img.buffer);
    await worker.terminate();
    return text.trim();
  } catch { return ''; }
}

async function ocrLesson(num) {
  const docxPath = resolve(DOCX_DIR, `P${num}教案.docx`);
  if (!existsSync(docxPath)) return [];

  console.log(`  P${num}: extracting images...`);
  const images = await extractImages(docxPath);
  console.log(`  P${num}: ${images.length} images, OCRing...`);

  const texts = [];
  // Limit to 15 images per lesson for speed; skip tiny images
  const toOcr = images.filter(img => img.buffer.length > 5000).slice(0, 15);

  for (let i = 0; i < toOcr.length; i++) {
    const text = await ocrImage(toOcr[i]);
    if (text.length > 10) {
      texts.push(text);
    }
    if ((i + 1) % 5 === 0) process.stdout.write('.');
  }

  return texts;
}

async function main() {
  const lessons = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  const range = parseRange();

  const targets = range
    ? lessons.filter(l => l.order >= range.start && l.order <= range.end)
    : lessons;

  let totalOcred = 0;

  for (const lesson of targets) {
    const num = lesson.order;
    try {
      const ocrTexts = await ocrLesson(num);
      if (ocrTexts.length === 0) { process.stdout.write('o'); continue; }

      // Combine OCR text
      const allOcr = ocrTexts.join('\n---\n');

      // Find problems that need better descriptions
      const allProblems = [
        ...(lesson.inClassCodes || []),
        ...(lesson.homework || []),
        ...(lesson.extended || [])
      ].filter(p => p && p.title);

      // Filter OCR texts: only keep ones that look like problem descriptions (have Chinese text, not just code)
      const validOcrTexts = ocrTexts.filter(t => {
        const cnChars = (t.match(/[一-鿿]/g) || []).length;
        const codeLines = (t.match(/#include|int main|using namespace|cout\s*<</g) || []).length;
        // Must have Chinese text and not be mostly code
        return cnChars > 5 && (cnChars / Math.max(1, t.length) > 0.05);
      });

      let enriched = 0;
      for (const p of allProblems) {
        const currentDesc = p.description || '';
        // Only try to improve if current description is clearly auto-generated or very short
        const needsImprovement = !currentDesc ||
          currentDesc.length < 30 ||
          currentDesc.startsWith('编写C++') ||
          currentDesc.startsWith('输入') && currentDesc.length < 20 ||
          currentDesc.startsWith('输出') && currentDesc.length < 20;

        if (!needsImprovement) continue;

        const code = p.code || p.answerCode || '';
        const problemNum = (p.title || '').match(/(\d{4,6})/)?.[1] || '';

        // Find best matching OCR text
        let bestMatch = null;
        let bestScore = 0;

        for (const ocrText of validOcrTexts) {
          let score = 0;
          // Score 1: problem number match
          if (problemNum && ocrText.includes(problemNum)) score += 10;
          // Score 2: contains description keywords like "输入", "输出", "描述"
          if (/输入|输出|描述|题目/.test(ocrText)) score += 3;
          // Score 3: has structured description (sample input/output pattern)
          if (/输入样例|输出样例|输入描述|输出描述/.test(ocrText)) score += 15;
          // Score 4: length is substantial (real description, not noise)
          if (ocrText.length > 50) score += 2;

          if (score > bestScore) {
            bestScore = score;
            bestMatch = ocrText;
          }
        }

        if (bestMatch && bestScore >= 5) {
          // Extract the descriptive part from OCR text
          const lines = bestMatch.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 3 && !l.startsWith('#include') && !l.startsWith('using') &&
              !l.startsWith('int main') && !l.startsWith('return') &&
              !l.startsWith('{') && !l.startsWith('}') && !l.startsWith('cout') &&
              !l.startsWith('cin'))
            .slice(0, 15);
          const desc = lines.join('\n').trim().substring(0, 400);
          if (desc.length > 10) {
            p.description = desc;
            enriched++;
          }
        }
      }

      if (enriched > 0) {
        totalOcred += enriched;
        process.stdout.write('+');
      } else {
        process.stdout.write('o');
      }

      // Save after each lesson
      writeFileSync(DATA_FILE, JSON.stringify(lessons, null, 2));

    } catch (e) {
      process.stdout.write('x');
      console.error(`\n  P${num} error:`, e.message?.substring(0, 100));
    }
  }

  console.log(`\nOCR enriched ${totalOcred} descriptions`);
}

function extractKeywords(code) {
  if (!code) return [];
  const keywords = [];
  // Extract variable names, function names, string literals
  const varMatch = code.match(/\b(int|double|float|char|string|long long)\s+(\w+)/g);
  if (varMatch) keywords.push(...varMatch);
  const coutMatch = code.match(/cout\s*<<\s*"([^"]+)"/g);
  if (coutMatch) keywords.push(...coutMatch);
  // Extract any Chinese text in comments
  const cnMatch = code.match(/\/\/\s*([一-龥].+)/g);
  if (cnMatch) keywords.push(...cnMatch);
  return keywords.slice(0, 5);
}

main().catch(e => { console.error(e); process.exit(1); });
