# Jev 2048 Autoplay

用 [OpenRouter Jev](https://openrouter.ai/~typesafe/jev-latest)（`~typesafe/jev-latest`）通过 **Decisions API** 自动完玩 2048。

Jev 不做聊天生成，而是对棋盘 `state` 回答一个 `choice` 问题：下一步该往哪个方向滑。

## Setup

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

打开 http://localhost:5173 ，点击 **Autoplay with Jev**。

## How it works

每一步：

1. 本地算出当前合法方向（会真正改变棋盘的方向）
2. `POST /api/decide` → OpenRouter `https://openrouter.ai/api/alpha/decisions`
3. 模型：`~typesafe/jev-latest`
4. 问题类型：`choice`（`up` / `down` / `left` / `right`）
5. 前端按返回的 `choice` 执行移动，并展示 `confidence` 与概率分布

生产构建：

```bash
npm run build
npm start
```

## Manual play

也可用方向键或 WASD 手动玩；自动游玩进行时会锁定手动操作。
