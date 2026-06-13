$ErrorActionPreference = "Stop"

$outputDir = $PSScriptRoot
$docxPath = Join-Path $outputDir "陈铭_系统策划_简历.docx"
$pdfPath = Join-Path $outputDir "陈铭_系统策划_简历.pdf"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

function Set-Font($range, [double]$size, [bool]$bold = $false, [string]$color = "222222") {
    $range.Font.NameFarEast = "微软雅黑"
    $range.Font.Name = "Arial"
    $range.Font.Size = $size
    $range.Font.Bold = [int]$bold
    $range.Font.Color = [System.Drawing.ColorTranslator]::FromHtml("#$color").ToArgb()
}

function Add-Paragraph(
    [string]$text,
    [double]$size = 9.2,
    [bool]$bold = $false,
    [int]$align = 0,
    [double]$spaceBefore = 0,
    [double]$spaceAfter = 0,
    [double]$lineSpacing = 11.5,
    [string]$color = "222222"
) {
    $paragraph = $script:doc.Content.Paragraphs.Add()
    $paragraph.Range.Text = $text
    Set-Font $paragraph.Range $size $bold $color
    $paragraph.Alignment = $align
    $paragraph.Format.SpaceBefore = $spaceBefore
    $paragraph.Format.SpaceAfter = $spaceAfter
    $paragraph.Format.LineSpacingRule = 4
    $paragraph.Format.LineSpacing = $lineSpacing
    return $paragraph
}

function Add-Section([string]$text) {
    $paragraph = Add-Paragraph $text 10.5 $true 0 4 2 13 "1F4E79"
    $paragraph.Borders.Item(-3).LineStyle = 1
    $paragraph.Borders.Item(-3).Color = [System.Drawing.ColorTranslator]::FromHtml("#2F75B5").ToArgb()
    $paragraph.Borders.Item(-3).LineWidth = 8
}

function Add-EntryHeader([string]$left, [string]$right) {
    $table = $script:doc.Tables.Add($script:doc.Content.Paragraphs.Add().Range, 1, 2)
    $table.AllowAutoFit = $false
    $table.Columns.Item(1).Width = 395
    $table.Columns.Item(2).Width = 115
    $table.Borders.Enable = 0
    $table.Cell(1, 1).Range.Text = $left
    $table.Cell(1, 2).Range.Text = $right
    Set-Font $table.Cell(1, 1).Range 9.4 $true "111111"
    Set-Font $table.Cell(1, 2).Range 8.3 $false "666666"
    $table.Cell(1, 2).Range.ParagraphFormat.Alignment = 2
    $table.Range.ParagraphFormat.SpaceBefore = 0
    $table.Range.ParagraphFormat.SpaceAfter = 0
    $table.Range.ParagraphFormat.LineSpacingRule = 4
    $table.Range.ParagraphFormat.LineSpacing = 10.5
}

function Add-Meta([string]$text) {
    Add-Paragraph $text 8.1 $false 0 0 1 10 "2F75B5" | Out-Null
}

function Add-Bullet([string]$text) {
    $paragraph = Add-Paragraph $text 8.65 $false 0 0 0.5 10.8 "222222"
    $paragraph.Range.ListFormat.ApplyBulletDefault()
    $paragraph.Format.LeftIndent = 14
    $paragraph.Format.FirstLineIndent = -8
}

try {
    $script:doc = $word.Documents.Add()
    $section = $doc.Sections.Item(1)
    $section.PageSetup.PaperSize = 7
    $section.PageSetup.TopMargin = 28
    $section.PageSetup.BottomMargin = 25
    $section.PageSetup.LeftMargin = 36
    $section.PageSetup.RightMargin = 36

    Add-Paragraph "陈　铭" 20 $true 1 0 0 22 "111111" | Out-Null
    Add-Paragraph "求职方向：游戏系统策划（校招）" 10.5 $true 1 0 1 13 "1F4E79" | Out-Null
    Add-Paragraph "男｜22岁｜13586725649｜2819092941@qq.com" 8.5 $false 1 0 3 10.5 "555555" | Out-Null

    Add-Section "教育背景"
    Add-EntryHeader "广西大学（211）｜计算机科学与技术 本科" "2022.09–2026.06"
    Add-Paragraph "主修：数据结构、计算机网络、计算机组成原理、操作系统" 8.5 $false 0 0 1 10.5 "444444" | Out-Null

    Add-Section "核心能力"
    Add-Bullet "系统设计：核心循环、状态机、规则拆解、信息权限、异常流程、功能优先级。"
    Add-Bullet "数值与分析：基础概率与计分设计、成长节奏、版本与 Meta 分析、Excel 数据处理。"
    Add-Bullet "原型与协作：Unity、TypeScript、React、Node.js、SQLite；可独立实现验证原型并与程序协作。"
    Add-Bullet "文档与验证：系统设计文档、流程图、测试报告、迭代记录；基于实玩数据定位并闭环问题。"

    Add-Section "项目经历"
    Add-EntryHeader "DreamCards AI 联想叙事桌游｜独立系统策划 / 原型负责人" "2026.06–至今"
    Add-Meta "React · TypeScript · Node.js · SQLite · 视觉模型 API"
    Add-Bullet "定义“图片联想 + UGC 创作 + 收藏发现”的产品定位，搭建“创作—发现—收藏—梦境集—对局传播”的长期循环。"
    Add-Bullet "设计四人核心回合，完成说书、匿名跟牌、投票、三分支计分、补牌、弃牌堆洗回与说书人轮换规则。"
    Add-Bullet "建立信息权限矩阵，隔离对局图片、创作者档案、后台 AI 标签和私人灵感，避免推理信息泄露。"
    Add-Bullet "设计视觉 AI 的说书、跟牌和投票行为，并加入无效 ID、错误 JSON、限流与超时降级。"
    Add-Bullet "将同步 AI 流程重构为逐玩家异步状态机，使提交反馈由约 20 秒等待降至毫秒级；设置 9 秒硬超时。"
    Add-Bullet "完成 40 张卡牌全局唯一分配，闭环重复卡牌、禁止自投、牌背泄露和状态不可见等问题。"

    Add-EntryHeader "VR 音乐节奏系统｜项目主要负责人" "2024.09–2025.06"
    Add-Meta "Unity3D · VR 交互 · 用户体验设计"
    Add-Bullet "拆解选曲、准备、游玩、结算等状态，明确各阶段输入、反馈与退出路径。"
    Add-Bullet "设计沉浸式 UI 与空间交互反馈，并根据体验测试调整界面层级、交互距离和反馈强度。"

    Add-EntryHeader "智能眼镜 UI 系统｜前端设计与交互逻辑" "2024.06–2024.12"
    Add-Meta "Unity3D · UI 设计 · 场景感知 · 交互逻辑"
    Add-Bullet "设计基于环境与任务状态变化的 UI 展示规则，构建信息优先级与界面响应流程。"
    Add-Bullet "参与可用性测试，根据结果调整信息层级和触发条件，平衡可读性与信息密度。"

    Add-Section "游戏系统研究"
    Add-Bullet "竞技系统：长期关注《英雄联盟》版本、装备符文与 Meta 变化，分析改动对分路职责和对局节奏的影响。"
    Add-Bullet "构筑系统：对比《Hades》《杀戮尖塔》《Noita》的 Build 形成、随机资源、风险回报和局外成长。"
    Add-Bullet "策略系统：关注《文明 VI》科技树、资源转化、多维胜利条件与回合节奏之间的关系。"

    Add-Section "获奖与补充"
    Add-Bullet "2025 年全国大学生高新技术竞赛 Java 赛道二等奖；CET-4。"
    Add-Bullet "作品集包含：DreamCards 可玩 Demo、系统设计文档、测试与迭代报告。"

    $doc.SaveAs2($docxPath, 16)
    $doc.ExportAsFixedFormat($pdfPath, 17)

    "DOCX=$docxPath"
    "PDF=$pdfPath"
    "PAGES=$($doc.ComputeStatistics(2))"
} finally {
    if ($doc) { $doc.Close($false) }
    $word.Quit()
}
