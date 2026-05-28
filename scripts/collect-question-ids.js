/**
 * Browser Console Script - 自动收集 OJ 题目 ID
 *
 * 使用方法（超简单）：
 * 1. 在任意页面 F12 → Console → 贴这个脚本 → 回车
 * 2. 正常打开每个课后作业/扩展练习的 course-step 页面
 * 3. 每打开一个页面，脚本自动检测并记录"题目ID"
 *    - 检测到会短暂绿闪一下
 * 4. 全部看完后，在 Console 输入 `showResults()` 回车
 * 5. 复制结果贴给 Claude
 */

window.__cqResults = {};
window.__cqLastUrl = '';
window.__cqExtracted = new Set();

// 每 500ms 检查页面内容
setInterval(() => {
  const url = window.location.href;
  if (!url.includes('space-client.codemao.cn/classin/course-step')) return;
  if (url === window.__cqLastUrl) return;
  window.__cqLastUrl = url;

  // 等页面加载完
  setTimeout(() => {
    const body = document.body?.innerText || '';
    // 找 "题目ID：10753" 或 "题目ID: 10753"
    const match = body.match(/题目ID[：:]\s*(\d+)/);
    if (!match) return;

    const qId = match[1];
    const nameMatch = body.match(/题目名称[：:]?\s*(.+)/);
    const name = nameMatch ? nameMatch[1].trim().substring(0, 50) : '未知';

    // 从 URL 中提取 lessonId
    const urlParams = new URLSearchParams(url.split('?')[1]);
    const lessonId = urlParams.get('lessonId') || '?';
    const stepId = urlParams.get('stepId') || '?';

    // 找之前拿到的 lesson 编号（需要手动设置，或者用映射表）
    const key = `lesson_${lessonId}_step_${stepId}`;
    if (window.__cqExtracted.has(key)) return;
    window.__cqExtracted.add(key);

    const entry = {
      lessonId,
      stepId,
      questionId: parseInt(qId),
      name,
      url
    };

    window.__cqResults[key] = entry;
    console.log(`✅ 已记录: ${name} → questionId: ${qId} (${Object.keys(window.__cqResults).length} 条)`);

    // 绿闪提示
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;top:10px;right:10px;background:#22c55e;color:white;padding:10px 16px;border-radius:8px;z-index:99999;font-size:14px;font-weight:bold';
    flash.textContent = `✅ 题目ID: ${qId}`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 1500);
  }, 2000);
}, 500);

// 查看所有结果
window.showResults = () => {
  const items = Object.values(window.__cqResults);
  console.log(`\n========== 已收集 ${items.length} 条 ==========`);
  console.log(JSON.stringify(items, null, 2));

  // 按 lessonId 分组
  const grouped = {};
  items.forEach(item => {
    if (!grouped[item.lessonId]) grouped[item.lessonId] = [];
    grouped[item.lessonId].push(item);
  });
  console.log('\n按课程分组:');
  console.log(JSON.stringify(grouped, null, 2));
  copy(JSON.stringify(items, null, 2));
  console.log('\n✅ 已复制到剪贴板！贴给 Claude。');
};

// 手动添加（如果自动检测失败）
window.addQuestion = (questionId, name, lessonId) => {
  const entry = { lessonId: String(lessonId), stepId: 'manual', questionId, name, url: window.location.href };
  const key = `manual_${Date.now()}`;
  window.__cqResults[key] = entry;
  console.log(`✅ 手动添加: ${name} → questionId: ${questionId}`);
};

console.log('🎯 收集器已启动！现在正常打开 course-step 页面即可自动记录。');
console.log('完成后输入 showResults() 查看结果。');
console.log('如果自动检测失败，用 addQuestion(题目ID, "名称", lessonId) 手动添加。');
