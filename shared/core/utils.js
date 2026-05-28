/**
 * Utils - 通用工具函数
 */

/** 生成唯一 ID */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/** 转义 HTML 特殊字符 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 简易 Markdown → HTML 渲染
 * 支持：标题、粗体、行内代码、代码块、表格、无序列表、分隔线
 */
export function renderMarkdown(text) {
  if (!text) return '';
  let html = text;
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\$([^$]+)\$/g, '$1');
  html = html.replace(/```(\w*)\s*\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^\|(.+)\|\s*$/gm, (line) => {
    if (/^\|[-:\s|]+\|$/.test(line)) return '';
    const cells = line.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
    return `<tr>${cells}</tr>`;
  });
  html = html.replace(/((?:<tr>.*<\/tr>\s*)+)/g, '<table>$1</table>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

export default { generateId, escapeHtml, renderMarkdown };
