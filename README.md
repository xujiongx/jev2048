# Jev Dev Tools

用 [OpenRouter Jev](https://openrouter.ai/~typesafe/jev-latest) 做结构化决策的小实验场。

## 工具

| 路径 | 说明 |
|------|------|
| `/` | 工具集首页 |
| `/2048` | 自动玩 2048（四向滑动 choice） |
| `/blackjack` | 21 点决策助手（要牌 / 停牌） |

21 点牌面 SVG 使用 [Wikimedia Commons · Byron Knoll](https://commons.wikimedia.org/wiki/Category:Playing_cards_set_by_Byron_Knoll) 公开资源。

## 技术栈

- React + Vite + TypeScript
- 路由：`react-router-dom`
- 图标：`lucide-react`（SVG 图标组件，替代传统 iconfont）
- 决策：OpenRouter Jev Decisions API

```bash
cp .env.example .env   # 填入 OPENROUTER_API_KEY
npm install
npm run dev
```

打开 http://localhost:5173

## 部署到 Vercel

推送代码后，在 Vercel 环境变量中配置 `OPENROUTER_API_KEY` 并重新部署。API 位于 `api/decide.js`，通过 `body.game` 区分 `2048` / `blackjack`。
