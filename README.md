# Jev 2048 Autoplay

用 [OpenRouter Jev](https://openrouter.ai/~typesafe/jev-latest)（`~typesafe/jev-latest`）通过 **Decisions API** 自动完玩 2048。

Jev 不做聊天生成，而是对棋盘 `state` 回答一个 `choice` 问题：下一步该往哪个方向滑。

## 本地开发

1. 在 [OpenRouter Keys](https://openrouter.ai/keys) 创建 API Key
2. 配置环境变量：

```bash
cp .env.example .env
# 编辑 .env，填入 OPENROUTER_API_KEY
```

3. 安装并启动：

```bash
npm install
npm run dev
```

打开 http://localhost:5173 ，点击 **用 Jev 自动玩**。

## 部署到 Vercel

本仓库已包含 `api/decide.js` 与 `vercel.json`。部署后务必在 Vercel 项目设置里添加环境变量：

- `OPENROUTER_API_KEY` = 你的 OpenRouter 密钥

然后重新部署。缺少该变量或未推送 `api/decide.js` 时，会出现 `/api/decide` 404。

## 工作原理

每一步：

1. 本地算出当前合法方向
2. `POST /api/decide` → OpenRouter Decisions API
3. 模型：`~typesafe/jev-latest`
4. 前端按返回的 `choice` 执行移动，并展示置信度与概率

本地生产模式：

```bash
npm run build
npm start
```

## 手动游玩

可在棋盘上滑动、使用方向键或 WASD；自动游玩进行时会锁定手动操作。
