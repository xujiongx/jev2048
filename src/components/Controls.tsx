type Props = {
  autoplay: boolean;
  busy: boolean;
  delayMs: number;
  stopAtWin: boolean;
  canStep: boolean;
  showContinue: boolean;
  onToggleAutoplay: () => void;
  onStep: () => void;
  onReset: () => void;
  onDelayChange: (ms: number) => void;
  onStopAtWinChange: (v: boolean) => void;
  onContinue: () => void;
};

export function Controls({
  autoplay,
  busy,
  delayMs,
  stopAtWin,
  canStep,
  showContinue,
  onToggleAutoplay,
  onStep,
  onReset,
  onDelayChange,
  onStopAtWinChange,
  onContinue,
}: Props) {
  return (
    <div className="controls">
      <div className="btn-row">
        <button
          type="button"
          className={`btn primary ${autoplay ? "active" : ""}`}
          onClick={onToggleAutoplay}
          disabled={!autoplay && (!canStep || busy)}
        >
          {autoplay ? "停止" : "用 Jev 自动玩"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={onStep}
          disabled={autoplay || busy || !canStep}
        >
          {busy ? "思考中…" : "单步"}
        </button>
        <button type="button" className="btn ghost" onClick={onReset}>
          新游戏
        </button>
        {showContinue && (
          <button type="button" className="btn ghost" onClick={onContinue}>
            继续冲分
          </button>
        )}
      </div>

      <label className="slider">
        <span>步间延迟 · {delayMs}ms</span>
        <input
          type="range"
          min={100}
          max={1500}
          step={50}
          value={delayMs}
          onChange={(e) => onDelayChange(Number(e.target.value))}
        />
      </label>

      <label className="check">
        <input
          type="checkbox"
          checked={stopAtWin}
          onChange={(e) => onStopAtWinChange(e.target.checked)}
        />
        达到 2048 时停止
      </label>
    </div>
  );
}
