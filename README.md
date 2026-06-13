# DreamCards 梦境图鉴

DreamCards 是一个受联想推理桌游启发的多人卡牌社区 Demo。玩家可以上传图片作品、收藏作品、构筑牌组，并在本地模拟房间或单人 AI 模式中游玩。

## 作品集文档

- [项目说明与个人职责](./docs/portfolio/README.md)
- [系统设计文档](./docs/portfolio/SYSTEM_DESIGN.md)
- [测试与迭代报告](./docs/portfolio/PLAYTEST_REPORT.md)

本项目不使用 Dixit 名字或官方图片，不包含 NFT、区块链、支付系统、复杂账号系统或真实联网匹配。

## 技术栈

- 前端：React + TypeScript + TailwindCSS + Vite
- 后端：Node.js + Express
- 数据库：SQLite，使用 Node 24 内置 `node:sqlite`
- 图片存储：本地 `server/uploads`
- AI：OpenAI-compatible API，可选 SiliconFlow / OpenRouter / DashScope

## 运行

```bash
cd dreamcards
npm install
npm run dev
```

默认地址：

```text
前端：http://localhost:5173
后端：http://localhost:4000
```

也可以分别启动：

```bash
npm run server:dev
npm run client:dev
```

## 本地账户

- 首次打开页面后可直接注册本地账户。
- 密码使用 Node.js `scrypt` 加盐哈希后保存在 `server/data/dreamcards.sqlite`。
- 登录会话保存在本地 SQLite；浏览器的 `localStorage` 只保存随机会话令牌，不保存密码。
- 注册后会自动创建一套 10 张卡牌的“初见梦境”牌组。
- 当前阶段没有云端同步。更换电脑、删除数据库或清理站点数据后，账户不会自动迁移。

## 多人匹配

- 登录后进入“匹配”，选择一个正好包含 10 张作品的梦境集。
- 当前匹配人数固定为 4 人；四个不同账号进入队列后会自动创建同一房间。
- 说书人提交图片和提示，其他三人各出一张图片；说书人不投票，其他玩家不能投自己的图片。
- 投票完成后服务端统一计分，说书人开启下一轮，系统轮换说书人并把每人手牌补回 6 张。
- 房间和匹配队列目前保存在 Node.js 进程内存中，服务端重启后进行中的房间会清空。
- 前端通过短轮询同步房间状态。局域网或云端部署后，不同设备可连接同一个后端参与对局。

## 卡牌身份系统

卡牌没有名称。玩家在游戏过程中只能看到图片，不能看到名称、标签、创作者、编号、收藏数或使用次数。

公开身份由系统自动生成：

```json
{
  "cardId": "card_x9ab21",
  "creatorName": "Alice",
  "creatorSequence": 7,
  "imageUrl": "/uploads/card_x9ab21.png"
}
```

作品编号规则：

- Alice 上传第一张作品：`Alice#1`
- Alice 上传第二张作品：`Alice#2`
- Bob 上传第一张作品：`Bob#1`

`creatorSequence` 按创作者独立递增，用户不能修改。

## 游戏内展示规则

对局中只展示图片：

- 手牌：只显示图片
- 匿名提交牌：只显示图片
- 投票阶段：只显示图片
- 说书人不参与投票
- 玩家不能投自己的牌

结算后才显示作品身份和历史：

- 作品：`Alice#7`
- 创作者：`Alice`
- 首次上传：`2026-06-05`
- 被使用次数
- 被收藏次数

## 已实现功能

- 卡牌创建：上传图片，系统自动记录创作者与作品序号
- 创作者署名：原始创作者和作品序号永久保留
- 收藏系统：收藏的是作品，不是名称
- 牌组构筑：每套牌组最多 10 张作品
- 模拟四人房间：本地合并牌组、洗牌、提交、投票、结算
- 单人模式：玩家与 3 个 AI 玩家进行一局本地模拟
- 图鉴系统：统计已发现作品，展示最近发现的作品编号
- 玩家主页：展示创作数、收藏数、最受欢迎作品

## AI 人机配置

AI 服务统一封装在：

```text
server/services/aiService.ts
```

当前三位 AI 通过 GitHub Models 分别使用三个视觉模型：

- `AI_Alice`：OpenAI GPT-4.1 mini
- `AI_Bob`：Mistral Small 3.1
- `AI_Carol`：Microsoft Phi-4 Multimodal

这些模型都会直接读取手牌和候选牌图片，而不是依赖前端不可见的标签。GitHub Models 的免费 API 用于开发与实验，额度和可用性可能随 GitHub 政策调整。

配置步骤：

1. 在 GitHub Settings 中创建 fine-grained personal access token。
2. 为令牌授予 `Models: read` 权限。
3. 复制环境变量模板：

```bash
copy .env.example .env
```

4. 在 `.env` 中填写令牌：

```env
GITHUB_MODELS_TOKEN=github_pat_xxx
GITHUB_MODELS_BASE_URL=https://models.github.ai/inference
AI_ALICE_MODEL=openai/gpt-4.1-mini
AI_BOB_MODEL=mistral-ai/mistral-small-2503
AI_CAROL_MODEL=microsoft/phi-4-multimodal-instruct
```

没有 GitHub PAT 也能运行。AI 调用失败、限流、图片解析失败、JSON 解析失败或返回无效 cardId 时，对应玩家会自动 fallback 到本地策略。

## 数据库

首次启动后端会自动创建：

```text
server/data/dreamcards.sqlite
```

主要表：

- `users`
- `cards`
- `collections`
- `discoveries`
- `decks`
- `deck_cards`

`cards` 保存后台 AI 标签 `tags`，但公开 API 和前端页面不会展示标签。标签仅用于 AI 出牌、AI 投票和 AI 生成提示词。

## 开发备注

- 上传图片保存在本机 `server/uploads`
- SQLite 数据保存在本机 `server/data/dreamcards.sqlite`
- 如果部署到云服务，应把 SQLite 与上传目录替换为云数据库和云存储，避免实例重启导致数据丢失
