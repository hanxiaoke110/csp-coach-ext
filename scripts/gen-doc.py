#!/usr/bin/env python3
"""生成 CSP 信奥教学扩展使用文档 PDF"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                 TableStyle, PageBreak, KeepTogether, HRFlowable)
from reportlab.platypus.flowables import HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
import os

OUT = '/Users/hanliuliu/Desktop/CSP扩展使用文档.pdf'

# ── 注册中文字体 ──
font_paths = [
    '/System/Library/Fonts/PingFang.ttc',
    '/System/Library/Fonts/STHeiti Medium.ttc',
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
]
for fp in font_paths:
    if os.path.exists(fp):
        pdfmetrics.registerFont(TTFont('CJK', fp))
        break
else:
    pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
    print('Warning: using fallback CJK font')

W, H = A4  # 210 x 297 mm

# ── 颜色 ──
PRIMARY = HexColor('#4f46e5')
GREEN = HexColor('#059669')
GRAY = HexColor('#64748b')
LIGHT_BG = HexColor('#f8fafc')
BORDER = HexColor('#e2e8f0')
DARK = HexColor('#1e293b')
WHITE = white
RED = HexColor('#ef4444')

# ── 样式 ──
styles = getSampleStyleSheet()

body = ParagraphStyle('Body', fontName='CJK', fontSize=10, leading=16,
                       textColor=DARK, spaceAfter=6, alignment=TA_JUSTIFY)
h1 = ParagraphStyle('H1', fontName='CJK', fontSize=22, leading=28,
                     textColor=PRIMARY, spaceAfter=12, spaceBefore=20)
h2 = ParagraphStyle('H2', fontName='CJK', fontSize=16, leading=22,
                     textColor=PRIMARY, spaceAfter=8, spaceBefore=16)
h3 = ParagraphStyle('H3', fontName='CJK', fontSize=13, leading=18,
                     textColor=DARK, spaceAfter=6, spaceBefore=12)
cover_title = ParagraphStyle('Cover', fontName='CJK', fontSize=32, leading=40,
                              textColor=WHITE, alignment=TA_CENTER)
cover_sub = ParagraphStyle('CoverSub', fontName='CJK', fontSize=14, leading=20,
                            textColor=HexColor('#c7d2fe'), alignment=TA_CENTER)
toc_item = ParagraphStyle('TOC', fontName='CJK', fontSize=11, leading=20,
                           textColor=DARK, leftIndent=20)
footer_style = ParagraphStyle('Footer', fontName='CJK', fontSize=8,
                               textColor=GRAY, alignment=TA_CENTER)
code_style = ParagraphStyle('Code', fontName='CJK', fontSize=8, leading=12,
                             textColor=DARK, backColor=LIGHT_BG,
                             borderWidth=0.5, borderColor=BORDER,
                             borderPadding=6, leftIndent=10)
bullet = ParagraphStyle('Bullet', fontName='CJK', fontSize=10, leading=16,
                         textColor=DARK, leftIndent=16, bulletIndent=4,
                         spaceAfter=3)
note_style = ParagraphStyle('Note', fontName='CJK', fontSize=9, leading=14,
                             textColor=GRAY, leftIndent=10, rightIndent=10)

# ── 辅助函数 ──
def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=10, spaceBefore=10)

def bullet_list(items):
    return [Paragraph(f"• {item}", bullet) for item in items]

def info_table(headers, rows, col_widths=None):
    """生成带表头的表格"""
    data = [headers] + rows
    t = Table(data, colWidths=col_widths)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, -1), 'CJK'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]
    t.setStyle(TableStyle(style_cmds))
    return t

def section(title, body_elements):
    return [Paragraph(title, h2)] + body_elements + [Spacer(1, 6)]

def make_cover():
    """生成封面页"""
    from reportlab.platypus import Frame, PageTemplate
    # Not using page template - just draw on the canvas for page 0
    pass

# ── 页面模板 ──
def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont('CJK', 8)
    canvas.setFillColor(GRAY)
    canvas.drawString(20*mm, 15*mm, f"CSP 信奥教学扩展 · 使用指南")
    canvas.drawRightString(W - 20*mm, 15*mm, f"第 {doc.page} 页")
    canvas.restoreState()

def on_first_page(canvas, doc):
    """封面不显示页眉页脚"""
    pass

# ── 构建文档 ──
doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    leftMargin=20*mm, rightMargin=20*mm,
    topMargin=20*mm, bottomMargin=20*mm,
    title='CSP 信奥教学扩展 · 使用指南',
    author='CSP Teaching Team'
)

story = []

# ═══════ 封面 ═══════
story.append(Spacer(1, 80))
story.append(Paragraph("CSP 信奥教学扩展", cover_title))
story.append(Spacer(1, 12))
story.append(Paragraph("C++ 编程教学辅助工具 · 使用指南", cover_sub))
story.append(Spacer(1, 8))
story.append(Paragraph("教练版 & 学生版 ｜ v2.0", cover_sub))
story.append(Spacer(1, 40))
story.append(hr())
story.append(Spacer(1, 8))
story.append(Paragraph("69 节课 · 440 道题 · 覆盖 C++ 零基础到 CSP-J 竞赛", ParagraphStyle('Sub', fontName='CJK', fontSize=11, textColor=GRAY, alignment=TA_CENTER)))
story.append(Paragraph("支持 NCT / GESP / CSP-J/S 考级规划", ParagraphStyle('Sub2', fontName='CJK', fontSize=11, textColor=GRAY, alignment=TA_CENTER)))
story.append(PageBreak())

# ═══════ 目录 ═══════
story.append(Paragraph("目  录", h1))
story.append(hr())
toc_entries = [
    "一、项目简介",
    "二、安装指南",
    "三、教练端功能详解",
    "    3.1  AI 服务设置",
    "    3.2  课程浏览与知识点",
    "    3.3  三级递进提示",
    "    3.4  动画演示",
    "    3.5  Debug 面板",
    "    3.6  课程管理",
    "    3.7  AI 解析教案",
    "    3.8  生成学生版",
    "四、学生端功能详解",
    "    4.1  导入课程数据",
    "    4.2  密码解锁",
    "    4.3  AI 进阶教练",
    "    4.4  向 AI 提问",
    "五、考试规划参考",
    "六、常见问题",
]
for e in toc_entries:
    story.append(Paragraph(e, toc_item))
story.append(PageBreak())

# ═══════ 一、项目简介 ═══════
story.append(Paragraph("一、项目简介", h1))
story.append(hr())
story.append(Paragraph(
    "CSP 信奥教学扩展是一套 Chrome 浏览器扩展程序，分为 <b>教练版</b>（教师端）和 <b>学生版</b>（学生端）两个独立的扩展。"
    "教练端提供课程管理、AI 教案解析、代码 Debug、学生版生成等功能；学生端提供密码解锁课程、AI 进阶教练、苏格拉底式答疑等功能。", body))
story.append(Paragraph(
    "两个扩展共用同一套课程数据（69 节课、440 道编程题），覆盖 C++ 从零基础到 CSP-J/S 竞赛的全部知识点。"
    "内置 NCT（全国青少年编程能力等级测试）、GESP（CCF 编程能力等级认证）、CSP-J/S 三套考级体系的知识点映射与备考规划。", body))

story.append(info_table(
    ['项目', '说明'],
    [
        ['课节数', '69 节（P1-P69），连续无缺'],
        ['题目数', '440 道（含课上OJ、课后作业、扩展练习）'],
        ['阶段', 'C1入门(1-25) / C2基础(26-50) / C3进阶(51-71)'],
        ['AI 模型', '支持 DeepSeek / 硅基流动 / 阿里百炼 / 智谱 四家'],
        ['TTS 语音', '微软 Edge TTS（4种音色），动画演示用'],
        ['知识体系', '每课含知识点标签 + 概述 + 三级思考提示'],
    ],
    col_widths=[80, 380]
))
story.append(PageBreak())

# ═══════ 二、安装指南 ═══════
story.append(Paragraph("二、安装指南", h1))
story.append(hr())

story.append(Paragraph("2.1  准备工作", h3))
story.append(Paragraph("获取扩展压缩包（CSP教练助手.zip / CSP学习助手.zip），解压到本地文件夹。", body))

story.append(Paragraph("2.2  加载扩展", h3))
steps = [
    "打开 Chrome 浏览器，地址栏输入 <b>chrome://extensions/</b> 并回车",
    "打开右上角「<b>开发者模式</b>」开关",
    "点击左上角「<b>加载已解压的扩展程序</b>」",
    "选择解压后的文件夹（教练端选 <b>CSP教练助手</b>，学生端选 <b>CSP学习助手</b>）",
    "扩展图标会出现在 Chrome 工具栏右侧，点击即可打开侧边栏",
]
for i, s in enumerate(steps, 1):
    story.append(Paragraph(f"第{i}步：{s}", bullet))

story.append(Paragraph("2.3  固定扩展", h3))
story.append(Paragraph(
    "建议在 Chrome 工具栏点击扩展图标旁的 📌 图钉按钮，将扩展固定到工具栏，方便随时打开。", body))
story.append(PageBreak())

# ═══════ 三、教练端功能详解 ═══════
story.append(Paragraph("三、教练端功能详解", h1))
story.append(hr())

# 3.1 AI 设置
story.append(Paragraph("3.1  AI 服务设置", h2))
story.append(Paragraph(
    "打开教练端扩展，点击右上角「⚙ AI 服务设置」，进入配置页面。", body))
story.append(info_table(
    ['供应商', '模型', '费用', '推荐场景'],
    [
        ['DeepSeek', 'deepseek-chat', '充值使用', '主力推荐，最稳定'],
        ['硅基流动', 'DeepSeek-V3', '新用户免费额度', '免费备用'],
        ['阿里百炼', '通义千问系列', '充值/免费额度', '备用'],
        ['智谱 AI', 'GLM-4-Flash', '永久免费', '推荐给学生使用'],
    ],
    col_widths=[70, 100, 80, 200]
))
story.append(Paragraph(
    "选择供应商后，填入对应的 API Key，点击「🔗 测试连接」验证是否可用，然后「保存设置」。", body))

# 3.2 课程浏览
story.append(Paragraph("3.2  课程浏览与知识点", h2))
story.append(Paragraph(
    "教练端主界面按阶段（C1-C3）展示课程列表。点击阶段名称展开/折叠，点击课节查看详情。", body))
story.append(Paragraph("每节课顶部展示：", body))
story.append(Paragraph(
    "• <b>知识点标签</b>（如「循环变量」「步长控制」「for倒序」）— 悬停可查看详细解释", bullet))
story.append(Paragraph(
    "• <b>课程概述</b>（一句话概括本课内容，如「学习 for 循环的进阶用法：用步长控制跳跃、倒序输出、打擂台求最大最小值」）", bullet))
story.append(Paragraph("每道题包含：📄 题目描述 / 📋 参考代码（带语法高亮）/ ⚠️ 常见错误 / 💡 解题思路 / 🔍 三级提示。", body))

# 3.3 三级提示
story.append(Paragraph("3.3  三级递进提示", h2))
story.append(info_table(
    ['级别', '内容', '规则'],
    [
        ['第1级', '纯文字引导', '只用中文描述每一步做什么，<b>绝对不出现任何C++代码</b>'],
        ['第2级', '代码框架 + ___ 留空', '给完整结构的代码，但核心算法行用 ___ 替换（至少2-3处）'],
        ['第3级', '接近完整 + 1-2个 ___', '几乎完整的代码，只把最关键表达式用 ___ 留空'],
    ],
    col_widths=[50, 120, 290]
))
story.append(Paragraph(
    "学生端每点一次「🔍 提示」按钮，依次展示 1→2→3 级提示，再点关闭。确保学生先思考再看答案。", body))

# 3.4 动画
story.append(Paragraph("3.4  动画演示", h2))
story.append(Paragraph(
    "题目如有动画数据，点击「🎬 动画演示」会在新标签页打开交互式算法可视化页面，支持语音讲解（使用微软 Edge TTS，免费），可逐步播放、自动播放、重置。", body))

# 3.5 Debug
story.append(Paragraph("3.5  Debug 面板", h2))
story.append(Paragraph(
    "每道题底部有「🔍 代码 Debug」面板。老师粘贴学生的代码，点击「🤖 AI 分析代码」，AI 会自动对比参考答案，给出差异定位、错误原因、修改建议。", body))

# 3.6 课程管理
story.append(Paragraph("3.6  课程管理", h2))
story.append(Paragraph(
    "点击顶部「+ 课程管理」按钮，打开课程管理弹窗，包含三个标签页：", body))
story.append(Paragraph("• <b>阶段管理</b>：添加/编辑/删除阶段，设置每个阶段的课节范围", bullet))
story.append(Paragraph("• <b>课节管理</b>：查看所有课节列表，支持编辑/删除/批量删除，删除前自动备份", bullet))
story.append(Paragraph("• <b>新增课节</b>：从编程猫 CRM 拉取课节，或上传 MD 教案文件进行 AI 解析（详见 3.7）", bullet))
story.append(PageBreak())

# 3.7 AI 解析
story.append(Paragraph("3.7  AI 解析教案", h2))
story.append(Paragraph(
    "在「新增课节」标签页中，上传教案 MD 文件后点击「🤖 AI 解析」，系统会自动：", body))
steps = [
    "从教案中提取课上 OJ 题、课后作业、扩展练习",
    "匹配代码到对应的题目",
    "生成常见错误（每道题 2-3 条）",
    "生成解题思路 + 三级递进提示",
    "可选：生成动画演示数据",
    "提取知识点标签 + 课程概述",
]
for s in steps:
    story.append(Paragraph(f"• {s}", bullet))
story.append(Paragraph("解析完成后，可在表单中修改标题、密码、知识点等，确认无误后点击「保存」。", body))

# 3.8 生成学生版
story.append(Paragraph("3.8  生成学生版", h2))
story.append(Paragraph(
    "课程管理弹窗底部有「🎓 生成学生版」按钮。点击后弹出配置框：", body))
story.append(Paragraph("• <b>供应商</b>：选择学生使用的 AI 供应商（推荐智谱 GLM-4-Flash，永久免费）", bullet))
story.append(Paragraph("• <b>API Key</b>：填入学生的 Key（可选，不填则学生自行配置）", bullet))
story.append(Paragraph(
    "点击「生成」后，系统会补生成缺失的思路/提示/动画（如有 API Key），剥离答案代码，"
    "自动下载 <b>lessons-student.json</b> 文件。将此文件发给学生即可。", body))
story.append(Paragraph(
    "⚠️ 注意：答案代码（code/answerCode/answerNotes/commentary）和视频数据（videoSteps/videoHTML/videoFile）"
    "会被自动剥离，但思考过程、三级提示、易错点、动画等学生需要的内容会保留。", note_style))
story.append(PageBreak())

# ═══════ 四、学生端功能详解 ═══════
story.append(Paragraph("四、学生端功能详解", h1))
story.append(hr())

# 4.1 导入
story.append(Paragraph("4.1  导入课程数据", h2))
story.append(Paragraph(
    "学生收到老师发的 lessons-student.json 文件后：", body))
steps = [
    "打开 CSP 学习助手扩展",
    "点击顶部「📥 导入课程」按钮",
    "选择老师发的 JSON 文件",
    "系统自动加载课程数据，如有预置 AI 配置也会自动生效",
]
for i, s in enumerate(steps, 1):
    story.append(Paragraph(f"第{i}步：{s}", bullet))
story.append(Paragraph(
    "导入成功后，学生即可使用所有功能，无需额外配置。", body))

# 4.2 密码
story.append(Paragraph("4.2  密码解锁课程", h2))
story.append(Paragraph(
    "所有课程默认锁定，学生需要输入老师给的密码才能解锁。解锁某课后，<b>该课之前的所有课程自动解锁</b>。"
    "例如：老师给学生 P5 的密码，学生解锁 P5 后，P1-P4 也自动打开。", body))

# 4.3 AI 教练
story.append(Paragraph("4.3  AI 进阶教练", h2))
story.append(Paragraph(
    "点击顶部「🧑‍🏫 AI教练」按钮，打开 AI 教练对话窗口。提供以下能力：", body))
story.append(info_table(
    ['功能', '说明', '示例'],
    [
        ['知识点总结', '总结近期学习的所有知识点，表格展示', '「近期学的什么？」'],
        ['习题推荐', '根据进度推荐洛谷练习题，带链接', '「推荐额外习题」'],
        ['知识点汇总', '用表格汇总近10节课知识点', '「知识点汇总」'],
        ['课程安排', '根据后续课程列学习计划，标注CSP考点', '「后续课程安排」'],
        ['课外答疑', '回答课外C++问题，按三级提示逐步引导', '「课外题答疑」'],
        ['考试规划', '根据进度推荐NCT/GESP/CSP考试', '自动附在回复末尾'],
    ],
    col_widths=[80, 160, 180]
))

# 降档策略
story.append(Paragraph("<b>降档报名策略</b>", h3))
story.append(Paragraph(
    "AI 教练遵循「降档报名，保过攒信心」原则：学生实际达到 4 级水平，推荐报 2-3 级考试。"
    "让学生轻松通过、积累考试经验和信心，每次考过后再逐步提档。", body))

# 4.4 向AI提问
story.append(Paragraph("4.4  向 AI 提问", h2))
story.append(Paragraph(
    "每道题下方有「🤔 问AI」按钮，点击打开针对该题的 AI 问答窗口。采用<b>苏格拉底引导法</b>：", body))
story.append(Paragraph("• <b>第一次问</b>：AI 只给题目分析（考什么、输入输出是什么），等学生回复", bullet))
story.append(Paragraph("• <b>第二次问</b>：AI 给算法思路（用什么方法解决），等学生回复", bullet))
story.append(Paragraph("• <b>第三次问</b>：AI 给代码框架（带 ___ 留空），让学生自己填", bullet))
story.append(Paragraph("• <b>学生发代码</b>：AI 指出问题给修改建议，<b>绝不直接给完整答案</b>", bullet))
story.append(Paragraph(
    "快捷按钮：「🤷 没思路」→ AI 分析题目 /「🐛 代码不对」→ AI 帮找 bug", body))
story.append(PageBreak())

# ═══════ 五、考试规划参考 ═══════
story.append(Paragraph("五、考试规划参考", h1))
story.append(hr())

story.append(Paragraph("5.1  课程与考级对应", h2))
story.append(info_table(
    ['课节', 'NCT', 'GESP', '主要知识点'],
    [
        ['P1-P7', 'IC1', '一级', 'C++基础框架、数据类型、输入输出'],
        ['P8-P12', 'IC2', '一级', '关系/逻辑运算符、if分支'],
        ['P13-P21', 'IC3', '二级', 'for/while循环、嵌套循环'],
        ['P22-P25', 'IC4', '三级', '一维数组及其应用、数学函数'],
        ['P26-P30', 'IC5', '三级', '字符数组、string字符串'],
        ['P31-P34', 'IC6', '三级/四级', '自定义函数、作用域'],
        ['P35-P40', 'IC7', '三级', '进制转换、位运算、数据编码'],
        ['P41-P48', 'IC7', '四级', '二维数组、结构体、排序算法'],
        ['P49-P60', 'IC8', '五级', '枚举、模拟、递推、贪心'],
        ['P61-P69', 'IC8', '五级+', '排序/数论/二分/动态数组/栈'],
    ],
    col_widths=[60, 45, 55, 300]
))

story.append(Paragraph("5.2  三大考级概览", h2))
story.append(info_table(
    ['考试', '频次', '级别', '特点'],
    [
        ['NCT', '每月可考', 'IC1-IC8', '主力刷证，学完模块降1-2档报名，稳过攒信心'],
        ['GESP', '3/6/9/12月', '一级-八级', 'CCF主办，线下考场经验积累，不作重点推荐'],
        ['CSP-J/S', '9月一轮/10月二轮', '入门/提高', '需8月31日前年满12周岁；一轮纯选择题，二轮4道编程题'],
    ],
    col_widths=[60, 80, 60, 260]
))

story.append(Paragraph("5.3  CSP-J/S 特别说明", h2))
story.append(Paragraph("• <b>年龄要求</b>：必须在8月31日前年满12周岁才能参加", bullet))
story.append(Paragraph("• <b>第一轮（9月）</b>：纯选择题，考察知识广度，重点复习 P1-P60 课内容", bullet))
story.append(Paragraph("• <b>第二轮（10月）</b>：4道编程题，<b>必须第一轮通过才能参加</b>，重点考察算法能力（P44-P68）", bullet))
story.append(Paragraph("• <b>建议</b>：学完50课以上、年龄达标再考虑CSP-J，不要过早准备", bullet))
story.append(PageBreak())

# ═══════ 六、常见问题 ═══════
story.append(Paragraph("六、常见问题", h1))
story.append(hr())

faqs = [
    ("Q: 学生点击 AI 教练显示「请先配置 AI Key」？",
     "A: 老师生成学生版时在弹窗中填好供应商和 Key，学生导入 JSON 后自动配置。"
     "学生也可以自己打开右上角「AI 设置」手动配置。"),
    ("Q: 导入课程数据失败？",
     "A: 请确认选的是老师发的 .json 文件，不是其他格式。文件格式为 lessons-student.json。"),
    ("Q: 学生输入密码后无法解锁？",
     "A: 密码区分大小写，请确认输入正确。解锁某课后，该课之前的所有课程自动打开。"),
    ("Q: AI 分析/提问返回错误？",
     "A: 通常是 API Key 无效或额度不足。去 AI 服务设置里「测试连接」检查。"
     "推荐使用智谱 GLM-4-Flash（永久免费），避免额度问题。"),
    ("Q: 教练端 Debug 面板分析不准确？",
     "A: AI 分析结果仅供参考，建议结合自己的教学经验判断。可以让学生代码和参考答案一起发给 AI 对比。"),
    ("Q: 动画演示没有声音？",
     "A: 动画使用微软 Edge TTS（免费），需要网络连接。确保浏览器允许音频播放。"),
    ("Q: 如何更新课程数据？",
     "A: 教练端修改课程后，重新「生成学生版」，学生重新导入即可。"),
]
for q, a in faqs:
    story.append(Paragraph(f"<b>{q}</b>", body))
    story.append(Paragraph(a, body))
    story.append(Spacer(1, 6))

story.append(Spacer(1, 20))
story.append(hr())
story.append(Paragraph("— 文档结束 —", ParagraphStyle('End', fontName='CJK', fontSize=10, textColor=GRAY, alignment=TA_CENTER)))

# ── 生成 PDF ──
doc.build(story, onFirstPage=on_first_page, onLaterPages=on_page)
print(f"✅ PDF generated: {OUT}")
