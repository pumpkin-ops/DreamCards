import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = "D:/新建文件夹/dreamcards";
const outDir = path.join(root, "docs/portfolio/generated");
const assetDir = path.join(outDir, "assets");
await fs.mkdir(assetDir, { recursive: true });

const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const palette = {
  bg: "#111310",
  panel: "#1a1d18",
  panel2: "#22251f",
  gold: "#d5ac62",
  cream: "#f3ead8",
  muted: "#aaa79d",
  green: "#4f9d7a",
  red: "#c86f72",
  blue: "#678cae",
};

const svg = (body, title = "") => `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" rx="36" fill="${palette.bg}"/>
  <rect x="18" y="18" width="1564" height="864" rx="28" fill="none" stroke="#4c4331" stroke-width="2"/>
  ${title ? `<text x="80" y="92" fill="${palette.cream}" font-family="Microsoft YaHei,Arial" font-size="34" font-weight="700">${esc(title)}</text>` : ""}
  ${body}
</svg>`;

const box = (x, y, w, h, title, sub = "", color = palette.gold) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${palette.panel}" stroke="${color}" stroke-width="2"/>
  <text x="${x + w / 2}" y="${y + h / 2 - (sub ? 10 : -10)}" text-anchor="middle" fill="${palette.cream}" font-family="Microsoft YaHei,Arial" font-size="30" font-weight="700">${esc(title)}</text>
  ${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 35}" text-anchor="middle" fill="${palette.muted}" font-family="Microsoft YaHei,Arial" font-size="20">${esc(sub)}</text>` : ""}
`;

const arrow = (x1, y1, x2, y2, color = palette.gold) => `
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="5"/>
  <polygon points="${x2},${y2} ${x2 - 18},${y2 - 10} ${x2 - 18},${y2 + 10}" fill="${color}"/>
`;

const saveSvg = async (name, body, title) => {
  const target = path.join(assetDir, `${name}.png`);
  await sharp(Buffer.from(svg(body, title))).png().toFile(target);
  return `assets/${name}.png`;
};

await fs.copyFile(path.join(root, ".codex/demo-table-1440x900.png"), path.join(assetDir, "table.png"));
await fs.copyFile(path.join(root, ".codex/demo-inspiration-1440x900.png"), path.join(assetDir, "inspiration.png"));
await fs.copyFile(path.join(root, ".codex/demo-result-1366x768.png"), path.join(assetDir, "result.png"));

const cardPaths = [1, 2, 3, 4, 5, 6].map((n) => path.join(root, `server/uploads/dream-${String(n).padStart(2, "0")}.webp`));
const cards = await Promise.all(cardPaths.map((p) => sharp(p).resize(230, 320, { fit: "cover" }).png().toBuffer()));
const collage = {
  create: { width: 1540, height: 390, channels: 4, background: palette.bg },
  composite: cards.map((input, i) => ({ input, left: 30 + i * 250, top: 35 })),
};
await sharp({ create: collage.create }).composite(collage.composite).png().toFile(path.join(assetDir, "card-strip.png"));

const diagrams = {};
diagrams.loop = await saveSvg("loop", [
  box(650, 330, 300, 180, "图片作品", "内容资产", palette.gold),
  box(100, 140, 260, 130, "创作", "上传与永久署名", palette.blue),
  box(450, 95, 260, 130, "发现", "对局曝光", palette.green),
  box(890, 95, 260, 130, "收藏", "记录偏好", palette.red),
  box(1240, 140, 260, 130, "梦境集", "主题策展", palette.gold),
  box(1150, 620, 260, 130, "对局", "联想与投票", palette.blue),
  box(190, 620, 260, 130, "复盘", "故事沉淀", palette.green),
  arrow(360, 205, 450, 160), arrow(710, 160, 890, 160), arrow(1150, 160, 1240, 205),
  arrow(1370, 270, 1270, 620), arrow(1150, 685, 450, 685), arrow(320, 620, 650, 500),
  arrow(800, 330, 300, 270), arrow(950, 420, 1150, 650),
].join(""), "UGC 内容如何成为长期循环");

diagrams.roles = await saveSvg("roles", [
  box(650, 110, 300, 150, "说书人", "控制提示模糊度", palette.gold),
  box(180, 610, 300, 150, "跟牌者", "制造合理干扰", palette.green),
  box(1120, 610, 300, 150, "投票者", "识别真实表达", palette.blue),
  arrow(710, 260, 420, 610), arrow(890, 260, 1180, 610), arrow(480, 685, 1120, 685),
  `<text x="510" y="420" fill="${palette.muted}" font-family="Microsoft YaHei" font-size="26">提示 + 图片</text>`,
  `<text x="1000" y="420" fill="${palette.muted}" font-family="Microsoft YaHei" font-size="26">匿名候选</text>`,
  `<text x="700" y="660" fill="${palette.muted}" font-family="Microsoft YaHei" font-size="26">诱导票收益</text>`,
].join(""), "三种角色，三套风险收益");

diagrams.info = await saveSvg("info-flow", [
  box(610, 330, 380, 180, "服务端权威状态", "按阶段裁剪公开数据", palette.gold),
  box(80, 120, 330, 150, "手牌阶段", "仅本人可见图片", palette.blue),
  box(80, 630, 330, 150, "出牌阶段", "公开谁已完成", palette.green),
  box(1190, 120, 330, 150, "投票阶段", "隐藏投票目标", palette.red),
  box(1190, 630, 330, 150, "结算 / 复盘", "释放归属与票流", palette.gold),
  arrow(410, 195, 610, 350), arrow(410, 705, 610, 490),
  arrow(990, 350, 1190, 195), arrow(990, 490, 1190, 705),
  `<text x="800" y="580" text-anchor="middle" fill="${palette.cream}" font-family="Microsoft YaHei" font-size="28">行动状态可见 · 行动内容保密</text>`,
].join(""), "信息出现的时间决定推理公平性");

diagrams.oldFlow = await saveSvg("old-flow", [
  box(70, 340, 250, 140, "玩家提交", "0s", palette.green),
  box(400, 340, 250, 140, "AI_Alice", "串行等待", palette.red),
  box(730, 340, 250, 140, "AI_Bob", "串行等待", palette.red),
  box(1060, 340, 250, 140, "AI_Carol", "串行等待", palette.red),
  box(1370, 340, 170, 140, "更新", "约20s", palette.gold),
  arrow(320, 410, 400, 410), arrow(650, 410, 730, 410), arrow(980, 410, 1060, 410), arrow(1310, 410, 1370, 410),
  `<line x1="70" y1="610" x2="1540" y2="610" stroke="${palette.muted}" stroke-width="3"/>`,
  `<text x="70" y="660" fill="${palette.cream}" font-family="Microsoft YaHei" font-size="26">玩家行为已经完成，但在整个请求结束前不被系统承认</text>`,
].join(""), "旧流程：所有人完成后，任何人才生效");

diagrams.newFlow = await saveSvg("new-flow", [
  box(80, 330, 280, 150, "玩家提交", "1–3ms 即时写入", palette.green),
  box(520, 120, 300, 140, "AI_Alice", "独立完成即更新", palette.blue),
  box(520, 340, 300, 140, "AI_Bob", "独立完成即更新", palette.blue),
  box(520, 560, 300, 140, "AI_Carol", "独立完成即更新", palette.blue),
  box(1100, 330, 400, 150, "阶段条件满足", "自动进入投票 / 结算", palette.gold),
  arrow(360, 405, 520, 190), arrow(360, 405, 520, 410), arrow(360, 405, 520, 630),
  arrow(820, 190, 1100, 380), arrow(820, 410, 1100, 405), arrow(820, 630, 1100, 430),
].join(""), "新流程：逐玩家状态 + AI 并行");

diagrams.score = await saveSvg("score", `
  <line x1="220" y1="720" x2="1420" y2="720" stroke="${palette.muted}" stroke-width="3"/>
  <line x1="220" y1="720" x2="220" y2="170" stroke="${palette.muted}" stroke-width="3"/>
  <polyline points="250,650 600,650 800,260 1000,260 1380,650" fill="none" stroke="${palette.gold}" stroke-width="12"/>
  <circle cx="250" cy="650" r="18" fill="${palette.red}"/><circle cx="800" cy="260" r="18" fill="${palette.green}"/>
  <circle cx="1000" cy="260" r="18" fill="${palette.green}"/><circle cx="1380" cy="650" r="18" fill="${palette.red}"/>
  <text x="250" y="780" text-anchor="middle" fill="${palette.cream}" font-family="Microsoft YaHei" font-size="28">0人猜中</text>
  <text x="800" y="780" text-anchor="middle" fill="${palette.cream}" font-family="Microsoft YaHei" font-size="28">1人</text>
  <text x="1000" y="780" text-anchor="middle" fill="${palette.cream}" font-family="Microsoft YaHei" font-size="28">2人</text>
  <text x="1380" y="780" text-anchor="middle" fill="${palette.cream}" font-family="Microsoft YaHei" font-size="28">3人猜中</text>
  <text x="880" y="210" text-anchor="middle" fill="${palette.green}" font-family="Microsoft YaHei" font-size="34" font-weight="700">目标区间：说书人 +3</text>
  <text x="250" y="610" text-anchor="middle" fill="${palette.red}" font-family="Microsoft YaHei" font-size="26">过度模糊：0分</text>
  <text x="1380" y="610" text-anchor="middle" fill="${palette.red}" font-family="Microsoft YaHei" font-size="26">过度直白：0分</text>
`, "计分如何约束提示模糊度");

diagrams.ai = await saveSvg("ai-funnel", [
  box(80, 340, 260, 150, "视觉输入", "图片 / 提示 / 候选", palette.blue),
  box(430, 340, 260, 150, "模型判断", "生成候选行为", palette.gold),
  box(780, 340, 260, 150, "结构解析", "提取 JSON", palette.green),
  box(1130, 340, 260, 150, "规则校验", "归属 / 自投 / ID", palette.red),
  box(1170, 620, 300, 120, "本地降级", "保证合法并推进", palette.gold),
  arrow(340, 415, 430, 415), arrow(690, 415, 780, 415), arrow(1040, 415, 1130, 415),
  arrow(1260, 490, 1300, 620, palette.red),
  `<text x="1430" y="420" fill="${palette.green}" font-family="Microsoft YaHei" font-size="28">合法行为</text>`,
].join(""), "模型负责判断，系统负责合法性");

diagrams.exception = await saveSvg("exception", [
  box(620, 100, 360, 140, "模型请求", "每次行为独立", palette.gold),
  box(90, 360, 280, 130, "正常返回", "校验后采用", palette.green),
  box(460, 360, 280, 130, "超过9秒", "本地策略", palette.red),
  box(830, 360, 280, 130, "JSON / ID错误", "修复或降级", palette.red),
  box(1200, 360, 280, 130, "图片缺失", "可用信息降级", palette.red),
  box(620, 650, 360, 130, "合法玩家行为", "仅当前AI受影响", palette.blue),
  arrow(700, 240, 230, 360), arrow(760, 240, 600, 360), arrow(840, 240, 970, 360), arrow(900, 240, 1340, 360),
  arrow(230, 490, 700, 650), arrow(600, 490, 760, 650), arrow(970, 490, 840, 650), arrow(1340, 490, 900, 650),
].join(""), "外部模型故障不能扩散到整个房间");

diagrams.test = await saveSvg("test-matrix", `
  ${["功能","时序","权限","异常","数据","构建"].map((x,i)=>`<text x="${390+i*185}" y="170" text-anchor="middle" fill="${palette.cream}" font-family="Microsoft YaHei" font-size="25" font-weight="700">${x}</text>`).join("")}
  ${["说书","跟牌","投票","结算","补牌"].map((x,i)=>`<text x="170" y="${285+i*105}" fill="${palette.cream}" font-family="Microsoft YaHei" font-size="25" font-weight="700">${x}</text>`).join("")}
  ${Array.from({length:30},(_,i)=>{const col=i%6,row=Math.floor(i/6);const active=![[0,4],[4,1],[4,2],[5,4]].some(([c,r])=>c===col&&r===row);return `<rect x="${310+col*185}" y="${230+row*105}" width="155" height="70" rx="14" fill="${active?palette.green:palette.panel2}" opacity="${active?0.9:0.55}"/><text x="${387+col*185}" y="${274+row*105}" text-anchor="middle" fill="${active?palette.cream:palette.muted}" font-family="Arial" font-size="30">${active?"✓":"—"}</text>`}).join("")}
`, "测试覆盖不是按钮清单，而是系统假设矩阵");

diagrams.data = await saveSvg("data", `
  <text x="180" y="770" fill="${palette.muted}" font-family="Microsoft YaHei" font-size="24">旧版：约20秒</text>
  <rect x="210" y="220" width="260" height="500" rx="20" fill="${palette.red}"/>
  <text x="340" y="190" text-anchor="middle" fill="${palette.cream}" font-family="Arial" font-size="42" font-weight="700">20,000ms</text>
  <text x="690" y="770" fill="${palette.muted}" font-family="Microsoft YaHei" font-size="24">玩家说书提交</text>
  <rect x="720" y="700" width="260" height="20" rx="10" fill="${palette.green}"/>
  <text x="850" y="660" text-anchor="middle" fill="${palette.cream}" font-family="Arial" font-size="42" font-weight="700">3ms</text>
  <text x="1190" y="770" fill="${palette.muted}" font-family="Microsoft YaHei" font-size="24">玩家跟牌提交</text>
  <rect x="1220" y="708" width="260" height="12" rx="6" fill="${palette.blue}"/>
  <text x="1350" y="668" text-anchor="middle" fill="${palette.cream}" font-family="Arial" font-size="42" font-weight="700">1ms</text>
`, "玩家反馈从等待整组 AI 改为立即生效");

diagrams.arch = await saveSvg("architecture", [
  box(90, 140, 260, 600, "内容层", "作品 · 收藏 · 梦境集", palette.gold),
  box(390, 140, 260, 600, "玩法层", "说书 · 投票 · 计分", palette.green),
  box(690, 140, 260, 600, "规则层", "状态 · 权限 · 边界", palette.red),
  box(990, 140, 260, 600, "AI层", "理解 · 校验 · 降级", palette.blue),
  box(1290, 140, 220, 600, "沉淀层", "灵感 · 档案 · 复盘", palette.gold),
  arrow(350, 440, 390, 440), arrow(650, 440, 690, 440), arrow(950, 440, 990, 440), arrow(1250, 440, 1290, 440),
].join(""), "最终五层系统结构");

diagrams.roadmap = await saveSvg("roadmap", [
  box(70, 330, 250, 170, "规则成立", "8轮回归\n全计分分支", palette.green),
  box(380, 330, 250, 170, "AI稳定", "30次/模型\nP50–P95", palette.blue),
  box(690, 330, 250, 170, "用户理解", "5–8人\n无说明测试", palette.gold),
  box(1000, 330, 250, 170, "真人联网", "重连 / 托管\n权威状态", palette.red),
  box(1310, 330, 220, 170, "内容生态", "审核 / 推荐\n传播转化", palette.gold),
  arrow(320, 415, 380, 415), arrow(630, 415, 690, 415), arrow(940, 415, 1000, 415), arrow(1250, 415, 1310, 415),
].join("").replaceAll("\n", " · "), "下一步不是堆功能，而是逐层降低未知");

const pages = [
  {
    n: 1, kicker: "系统策划作品集", title: "DreamCards", subtitle: "让玩家共同创造梦境卡牌世界",
    hero: "assets/table.png",
    text: `<p class="lead">如何让玩家创造的图片，在收藏、策展、对局和讨论中持续产生新的价值？</p>
      <div class="tags"><span>UGC内容资产化</span><span>四人回合规则</span><span>AI玩家</span><span>实时异步状态</span></div>
      <p class="meta">陈铭｜游戏系统策划（校招）｜独立系统策划 / 原型负责人｜Demo 0.1</p>`
  },
  {
    n: 2, kicker: "一图看懂", title: "一张图片如何从创作进入对局？", image: diagrams.loop,
    text: `<p class="lead">对局制造解释与传播，收藏和复盘保存解释与关系。</p>
      <p>DreamCards 将图片从一次性题库转化为可被创作、发现、收藏、策展和再次传播的内容资产。</p>`
  },
  {
    n: 3, kicker: "项目动机", title: "联想结束后，图片价值去了哪里？",
    image: "assets/card-strip.png",
    text: `<table><tr><th>体验现象</th><th>机制归因</th><th>玩家影响</th></tr>
      <tr><td>图片熟悉后新鲜感下降</td><td>内容供给固定</td><td>联想形成标准答案</td></tr>
      <tr><td>结算后只留下分数</td><td>缺少内容沉淀</td><td>表达价值迅速消失</td></tr>
      <tr><td>玩家只能使用图片</td><td>生产与玩法分离</td><td>缺少长期身份</td></tr></table>
      <p class="callout">最终选择：永久作品身份 + 跨玩家收藏传播，而不是单纯扩充官方图库。</p>`
  },
  {
    n: 4, kicker: "Meta与资源循环", title: "为什么收藏不等于组牌？", image: diagrams.loop,
    text: `<p class="lead">玩家创建的是“梦境集”，不是追求强度的竞技套牌。</p>
      <div class="cols"><div><h3>设计目标</h3><p>让收藏服务主题表达，让图片保持作品属性。</p></div><div><h3>规则</h3><p>每套10张作品，包含封面、名称、简介和创建时间。</p></div><div><h3>待验证</h3><p>10张是否足够表达主题，以及对局曝光能否带来二次收藏。</p></div></div>`
  },
  {
    n: 5, kicker: "玩家决策", title: "为什么一局中每个角色都有事可做？", image: diagrams.roles,
    text: `<table><tr><th>角色</th><th>风险</th><th>收益</th></tr>
      <tr><td>说书人</td><td>提示过直白或过模糊</td><td>控制部分玩家猜中</td></tr>
      <tr><td>跟牌者</td><td>图片关联不足</td><td>通过诱导票得分</td></tr>
      <tr><td>投票者</td><td>被干扰图误导</td><td>识别真实表达</td></tr></table>`
  },
  {
    n: 6, kicker: "失败案例 01", title: "为什么答案会被泄露？", image: "assets/result.png",
    text: `<p class="lead">早期将皇冠放在说书人的牌背上，等于把身份标识绑定到正确答案。</p>
      <ul><li>标题与标签会提前建立语义锚点</li><li>创作者身份可能帮助玩家反推归属</li><li>投票目标提前公开会影响后续判断</li></ul>
      <p class="callout">根因：把信息展示当作 UI 问题，而不是规则权限问题。</p>`
  },
  {
    n: 7, kicker: "信息权限", title: "如何看见进度，却看不见答案？", image: diagrams.info,
    text: `<p class="lead">最终原则：行动状态可见，行动内容保密。</p>
      <p>出牌阶段只公开谁已完成；投票阶段公开完成状态但隐藏目标；结算后才释放图片归属、票流和得分；私人灵感默认不公开。</p>`
  },
  {
    n: 8, kicker: "失败案例 02", title: "为什么玩家提交后会卡住20秒？", image: diagrams.oldFlow,
    text: `<p class="lead">最初以为瓶颈只是模型慢，实质是状态单位设计错误。</p>
      <p>系统把“所有人完成”当成“任何人的行为生效”。玩家已经提交，但牌背、手牌和状态都要等三名AI完成后才更新。</p>`
  },
  {
    n: 9, kicker: "状态机重构", title: "如何把同步表单变成实时牌桌？", image: diagrams.newFlow,
    text: `<p class="lead">新增 AwaitingCards，将等待其他玩家变成正式回合状态。</p>
      <ol><li>玩家提交立即写入并扣牌</li><li>多名AI并行执行</li><li>每名AI完成后独立更新</li><li>满足阶段条件后自动迁移</li></ol>
      <p class="callout">玩家操作反馈由约20秒降至1–3ms。</p>`
  },
  {
    n: 10, kicker: "计分与风险收益", title: "为什么说书人不能让所有人都猜中？", image: diagrams.score,
    text: `<table><tr><th>猜中人数</th><th>说书人</th><th>猜中者</th></tr>
      <tr><td>0人</td><td>0</td><td>其他玩家 +2</td></tr><tr><td>1–2人</td><td>+3</td><td>+3</td></tr><tr><td>3人</td><td>0</td><td>全部 +2</td></tr></table>
      <p>跟牌图片每获得一票，提交者额外 +1；禁止自投。计分让说书人追求“可理解但不明显”。</p>`
  },
  {
    n: 11, kicker: "AI行为设计", title: "为什么不能直接相信模型输出？", image: diagrams.ai,
    text: `<p class="lead">模型负责提出判断，系统负责目标、权限和合法性。</p>
      <div class="cols"><div><h3>说书</h3><p>2–10字；避免主体、颜色和数量；目标约1–2人猜中。</p></div><div><h3>跟牌</h3><p>合理相关但不过分直白；只能从自身手牌选择。</p></div><div><h3>投票</h3><p>排除自己的牌，再判断最可能的说书人图片。</p></div></div>`
  },
  {
    n: 12, kicker: "异常与边界", title: "如果一个AI 50秒不返回，整局怎么办？", image: diagrams.exception,
    text: `<p class="lead">没有硬超时的 fallback 不是完整容错。</p>
      <p>统一设置 9000ms 上限；错误JSON、无效ID、缺图和限流均在当前行为粒度降级。单个模型失败不能覆盖其他玩家结果，也不能阻止阶段推进。</p>`
  },
  {
    n: 13, kicker: "设计失误与迭代", title: "哪些方案看似合理，却破坏了体验？", image: "assets/inspiration.png",
    text: `<table class="small"><tr><th>最初方案</th><th>问题</th><th>最终修改</th></tr>
      <tr><td>同步等待全部AI</td><td>约20秒无反馈</td><td>逐玩家异步状态</td></tr>
      <tr><td>皇冠牌背</td><td>泄露正确答案</td><td>身份只放在座位</td></tr>
      <tr><td>默认展示AI理由</td><td>结算像调试界面</td><td>移入详细复盘</td></tr>
      <tr><td>梦境集独立洗牌</td><td>两人持有同图</td><td>全局双重去重</td></tr>
      <tr><td>报错后才fallback</td><td>慢请求永久阻塞</td><td>9秒硬超时</td></tr></table>`
  },
  {
    n: 14, kicker: "验证过程", title: "如何验证规则真的成立？", image: diagrams.test,
    text: `<p class="lead">测试对象不是按钮，而是即时性、公平性、唯一性和故障隔离。</p>
      <p>覆盖玩家与AI说书、逐人状态、禁止自投、答案保密、计分补牌、模型超时、卡牌唯一性以及正式构建。</p>
      <p class="muted">未覆盖：真实网络延迟、四名真人长局、断线重连和大样本平衡。</p>`
  },
  {
    n: 15, kicker: "数据结果", title: "修改是否真的有效？", image: diagrams.data,
    text: `<div class="kpis"><div><b>3ms</b><span>玩家说书提交</span></div><div><b>1ms</b><span>玩家跟牌提交</span></div><div><b>8.943s</b><span>最慢完整揭晓</span></div><div><b>40/40</b><span>唯一图片</span></div></div>
      <p>已验证11项关键规则。数据证明核心流程和故障隔离成立，但不能证明长局平衡、真人联网体验或UGC留存效果。</p>`
  },
  {
    n: 16, kicker: "最终方案", title: "内容、规则与AI如何连接？", image: diagrams.arch,
    text: `<p class="lead">五层结构分别解决供给、决策、公平、单人席位和长期沉淀。</p>
      <p>最终体验中，玩家始终坐在同一张牌桌前；图片是主要信息；每名玩家完成行动后立即产生反馈；结算后才理解归属、票流和得分。</p>`
  },
  {
    n: 17, kicker: "下一步验证", title: "最应该降低哪些未知？", image: diagrams.roadmap,
    text: `<ul><li>连续8轮覆盖全部计分分支</li><li>每个模型30次视觉选择，记录P50/P90/P95与降级率</li><li>邀请5–8名目标用户进行无说明测试</li><li>再进入WebSocket、断线重连和服务端权威状态</li></ul>`
  },
  {
    n: 18, kicker: "设计反思", title: "这次项目改变了哪些判断？", hero: "assets/result.png",
    text: `<div class="reflection"><p>实时体验不是模型有多快，而是玩家行为何时被系统承认。</p>
      <p>信息隐藏不是越多越好，而是按阶段开放正确粒度。</p>
      <p>AI接入首先是规则与容错问题，其次才是模型能力。</p>
      <p>UGC的难点不是上传，而是身份、传播、收藏和创作者权益闭环。</p></div>
      <p class="callout">系统策划需要把玩家目标、规则激励、信息边界与异常结果连接起来，并用验证证明这些关系成立。</p>`
  },
];

const renderPage = (p) => `
<section class="page page-${p.n} ${p.hero ? "hero-page" : ""}">
  ${p.hero ? `<img class="hero-img" src="${p.hero}"/>` : ""}
  <div class="page-overlay">
    <header><span>${esc(p.kicker)}</span><b>${String(p.n).padStart(2, "0")} / 18</b></header>
    <h1>${esc(p.title)}</h1>
    ${p.subtitle ? `<h2>${esc(p.subtitle)}</h2>` : ""}
    ${p.image ? `<img class="diagram" src="${p.image}"/>` : ""}
    <div class="content">${p.text}</div>
  </div>
</section>`;

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>DreamCards 系统策划作品集</title>
<style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
body { margin:0; background:#080908; color:${palette.cream}; font-family:"Microsoft YaHei","PingFang SC",Arial,sans-serif; }
.page { width:297mm; height:210mm; page-break-after:always; position:relative; overflow:hidden; padding:14mm 17mm 12mm; background:${palette.bg}; border:1px solid #393326; }
.page-overlay { position:relative; z-index:2; height:100%; }
header { display:flex; justify-content:space-between; border-bottom:1px solid #4b4332; padding-bottom:3mm; color:${palette.gold}; font-size:10pt; letter-spacing:1px; }
h1 { font-size:25pt; line-height:1.15; margin:7mm 0 2mm; color:${palette.cream}; }
h2 { font-size:14pt; font-weight:400; color:${palette.gold}; margin:0 0 7mm; }
h3 { color:${palette.gold}; font-size:12pt; margin:0 0 2mm; }
p, li, td, th { font-size:10pt; line-height:1.6; }
p { margin:2.5mm 0; }
.lead { font-size:13pt; color:${palette.cream}; line-height:1.55; }
.muted,.meta { color:${palette.muted}; }
.diagram { width:100%; height:110mm; object-fit:contain; margin:3mm 0 1mm; }
.page-3 .diagram { height:68mm; }
.page-13 .diagram { height:76mm; }
.content { color:#d9d4c8; }
.cols { display:table; width:100%; border-spacing:5mm 0; margin-left:-5mm; }
.cols>div { display:table-cell; width:33.33%; background:${palette.panel}; border-top:2px solid ${palette.gold}; padding:4mm; }
table { width:100%; border-collapse:collapse; margin:4mm 0; }
th { color:${palette.gold}; background:#27271f; text-align:left; }
td,th { padding:2.4mm 3mm; border-bottom:1px solid #464236; }
table.small td, table.small th { font-size:8.5pt; padding:1.8mm 2.5mm; }
.callout { border-left:4px solid ${palette.gold}; background:#211e17; padding:3mm 4mm; color:${palette.cream}; }
.tags span { display:inline-block; margin:2mm 2mm 2mm 0; padding:2mm 4mm; border:1px solid #75623e; color:${palette.gold}; }
.hero-page { padding:0; }
.hero-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:.56; }
.hero-page .page-overlay { padding:14mm 17mm 12mm; background:linear-gradient(90deg,rgba(8,9,8,.96) 0%,rgba(8,9,8,.72) 50%,rgba(8,9,8,.15) 100%); }
.hero-page h1 { margin-top:35mm; font-size:38pt; }
.hero-page h2 { font-size:19pt; }
.hero-page .content { width:57%; }
.hero-page .lead { font-size:16pt; }
.kpis { display:table; width:100%; border-spacing:4mm; margin:3mm -4mm; }
.kpis div { display:table-cell; width:25%; text-align:center; background:${palette.panel}; padding:4mm; border-top:2px solid ${palette.gold}; }
.kpis b { display:block; font-size:22pt; color:${palette.gold}; }
.kpis span { font-size:9pt; color:${palette.muted}; }
.reflection p { font-size:12pt; border-bottom:1px solid #454136; padding:3mm 0; }
ol,ul { margin:2mm 0 2mm 6mm; padding:0; }
</style></head><body>${pages.map(renderPage).join("\n")}</body></html>`;

await fs.writeFile(path.join(outDir, "DreamCards_Portfolio.html"), html, "utf8");
const pageDir = path.join(outDir, "pages");
await fs.mkdir(pageDir, { recursive: true });
const sharedStyle = html.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? "";
for (const page of pages) {
  const standalonePage = renderPage(page).replaceAll('src="assets/', 'src="../assets/');
  const standalone = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">${sharedStyle}
  <style>.page{page-break-after:auto}</style></head><body>${standalonePage}</body></html>`;
  await fs.writeFile(
    path.join(pageDir, `page-${String(page.n).padStart(2, "0")}.html`),
    standalone,
    "utf8",
  );
}
console.log(path.join(outDir, "DreamCards_Portfolio.html"));
