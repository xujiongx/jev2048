import {
  ArrowRight,
  Bomb,
  Bot,
  Grid3x3,
  Hand,
  Hash,
  Layers,
  Spade,
} from "lucide-react";
import { Link } from "react-router-dom";
import "./home.css";

const TOOLS = [
  {
    to: "/2048",
    title: "自动玩 2048",
    tag: "choice · 四向滑动",
    blurb:
      "把棋盘交给 Jev，每一步选出最优滑动方向，自动冲到 2048。也支持手势与键盘手动玩。",
    accent: "ember",
    Icon: Grid3x3,
  },
  {
    to: "/blackjack",
    title: "21 点决策助手",
    tag: "choice · 要牌 / 停牌",
    blurb:
      "自动发牌或手动指定牌面，Jev 根据点数与庄家明牌判断是否继续要牌，并可自动打完一局。",
    accent: "felt",
    Icon: Spade,
  },
  {
    to: "/lines",
    title: "连棋决策",
    tag: "choice · 井字 / 四子",
    blurb:
      "极小动作空间的可视化 demo：Jev 在合法落子里选赢棋、防守或占中心。",
    accent: "sky",
    Icon: Hash,
  },
  {
    to: "/minesweeper",
    title: "扫雷推理",
    tag: "choice · 点开 / 插旗",
    blurb:
      "把数字约束盘面交给 Jev，看它如何推断安全格与地雷，适合讲概率推理。",
    accent: "slate",
    Icon: Bomb,
  },
  {
    to: "/rps",
    title: "猜拳策略",
    tag: "choice · 石头剪刀布",
    blurb:
      "对手有模仿、循环、偏科等套路；Jev 根据历史频率猜下一手，连打看连胜。",
    accent: "rose",
    Icon: Hand,
  },
] as const;

export default function Home() {
  return (
    <div className="hub">
      <div className="hub-atmosphere" aria-hidden="true" />
      <header className="hub-hero">
        <p className="hub-eyebrow">
          <Bot size={14} strokeWidth={2.25} aria-hidden />
          OpenRouter · ~typesafe/jev-latest
        </p>
        <h1 className="hub-brand">Jev Dev Tools</h1>
        <p className="hub-lede">
          结构化决策模型的小实验场。每个工具把局面交给 Jev，用校准后的概率做下一步动作。
        </p>
      </header>

      <section className="hub-grid" aria-label="工具列表">
        {TOOLS.map((tool) => (
          <Link
            key={tool.to}
            to={tool.to}
            className={`hub-card hub-card-${tool.accent}`}
          >
            <span className="hub-card-icon" aria-hidden>
              <tool.Icon size={22} strokeWidth={2} />
            </span>
            <span className="hub-tag">
              <Layers size={12} strokeWidth={2.25} aria-hidden />
              {tool.tag}
            </span>
            <h2>{tool.title}</h2>
            <p>{tool.blurb}</p>
            <span className="hub-go">
              进入
              <ArrowRight size={16} strokeWidth={2.25} aria-hidden />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
