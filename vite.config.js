import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';

const TARGET = process.env.BUILD_TARGET || 'coach';

function copyDir(src, dest) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  for (const e of readdirSync(src)) {
    const sp = resolve(src, e), dp = resolve(dest, e);
    statSync(sp).isDirectory() ? copyDir(sp, dp) : copyFileSync(sp, dp);
  }
}

function buildPlugin(target) {
  return {
    name: `chrome-extension-${target}`,
    closeBundle() {
      const root = resolve(import.meta.dirname);
      const dist = resolve(root, `dist-${target}`);

      // Manifest & service worker
      copyFileSync(resolve(root, `${target}/manifest.json`), resolve(dist, 'manifest.json'));
      const swSrc = resolve(root, `${target}/service-worker.js`);
      if (existsSync(swSrc)) {
        mkdirSync(resolve(dist, target), { recursive: true });
        copyFileSync(swSrc, resolve(dist, `${target}/service-worker.js`));
      }

      // Shared data
      const dataDir = resolve(dist, 'shared/data');
      mkdirSync(dataDir, { recursive: true });
      copyFileSync(resolve(root, 'shared/data/stages.json'), resolve(dataDir, 'stages.json'));

      // lessons.json: strip answerCode for student target
      const lessonsPath = resolve(dataDir, 'lessons.json');
      if (target === 'student') {
        const raw = JSON.parse(readFileSync(resolve(root, 'shared/data/lessons.json'), 'utf-8'));
        // Handle nested {stages: [{lessons: [...]}]} format
        const flat = [];
        for (const stage of (raw.stages || [])) {
          for (const l of (stage.lessons || [])) {
            flat.push(l);
          }
        }
        flat.forEach(l => {
          (l.review || []).forEach(p => { delete p.code; delete p.answerCode; });
          (l.inClassCodes || []).forEach(p => { delete p.code; delete p.answerCode; delete p.answerNotes; delete p.commentary; delete p.videoSteps; delete p.videoHTML; delete p.videoFile; });
          (l.inClassQuiz || []).forEach(p => { delete p.code; delete p.answerCode; });
          (l.homework || []).forEach(p => { delete p.code; delete p.answerCode; delete p.answerNotes; delete p.commentary; delete p.videoSteps; delete p.videoHTML; delete p.videoFile; });
          (l.extended || []).forEach(p => { delete p.code; delete p.answerCode; delete p.answerNotes; delete p.commentary; delete p.videoSteps; delete p.videoHTML; delete p.videoFile; });
        });
        // Write back in nested format
        raw.stages.forEach(stage => {
          stage.lessons = stage.lessons.map(l => flat.find(fl => fl.id === l.id) || l);
        });
        writeFileSync(lessonsPath, JSON.stringify(raw));
      } else {
        copyFileSync(resolve(root, 'shared/data/lessons.json'), lessonsPath);
      }

      // Shared styles
      const stylesDir = resolve(dist, 'shared/styles');
      mkdirSync(stylesDir, { recursive: true });
      ['highlight-theme.css'].forEach(f => {
        const src = resolve(root, 'styles', f);
        if (existsSync(src)) copyFileSync(src, resolve(stylesDir, f));
      });

      // Static assets
      ['lib', 'icons', 'animations'].forEach(d => {
        const src = resolve(root, d);
        if (existsSync(src)) copyDir(src, resolve(dist, d));
      });

      // Options CSS only (HTML is handled by Vite's rollup input)
      if (existsSync(resolve(root, 'options/options.css'))) {
        mkdirSync(resolve(dist, 'options'), { recursive: true });
        copyFileSync(resolve(root, 'options/options.css'), resolve(dist, 'options/options.css'));
      }

      console.log(`[chrome-extension] Built ${target} → dist-${target}/`);
    }
  };
}

export default defineConfig({
  plugins: [buildPlugin(TARGET)],
  build: {
    outDir: `dist-${TARGET}`,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(import.meta.dirname, `${TARGET}/sidepanel.html`),
        options: resolve(import.meta.dirname, 'options/options.html'),
      }
    }
  }
});
