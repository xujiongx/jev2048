import type { DecisionEntry } from "../types";

const MOVE_LABEL: Record<string, string> = {
  up: "上",
  down: "下",
  left: "左",
  right: "右",
};

export function DecisionLog({ entries }: { entries: DecisionEntry[] }) {
  return (
    <aside className="log-panel">
      <div className="log-head">
        <h2>Jev 决策记录</h2>
        <p>每一行是一次 Decisions API 的选择，附带校准后的概率分布。</p>
      </div>
      {entries.length === 0 ? (
        <p className="log-empty">开始自动游玩或点一次「单步」后，这里会显示决策。</p>
      ) : (
        <ul className="log-list">
          {entries.map((entry) => (
            <li key={entry.id} className="log-item">
              <div className="log-row">
                <span className={`move-pill move-${entry.move}`}>
                  {MOVE_LABEL[entry.move] ?? entry.move}
                </span>
                <span className="conf">
                  {(entry.confidence * 100).toFixed(0)}%
                </span>
                <span className="meta">
                  #{entry.id} · {entry.latencyMs}ms · 最高{entry.highest}
                </span>
              </div>
              <div className="prob-bars">
                {Object.entries(entry.probabilities)
                  .sort((a, b) => b[1] - a[1])
                  .map(([label, p]) => (
                    <div key={label} className="prob">
                      <span>{MOVE_LABEL[label] ?? label}</span>
                      <div className="bar">
                        <i style={{ width: `${Math.max(2, p * 100)}%` }} />
                      </div>
                      <span>{(p * 100).toFixed(0)}%</span>
                    </div>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
