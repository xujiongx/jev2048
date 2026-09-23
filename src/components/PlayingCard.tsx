import { useEffect, useState } from "react";
import type { Card } from "../blackjack/engine";
import { CARD_BACK_CID, cardLabel, cardmeisterCid } from "../blackjack/cards";

const svgCache = new Map<string, string>();

function decodeCardMeisterDataUri(src: string): string | null {
  if (!src.startsWith("data:image/svg+xml")) return null;
  const raw = src.slice(src.indexOf(",") + 1);
  try {
    // CardMeister only percent-encodes '#'; rest is raw SVG markup.
    return decodeURIComponent(raw);
  } catch {
    return raw.replace(/%23/g, "#");
  }
}

/** CardMeister paints into <img data:svg>; extract markup for crisp inline SVG on retina. */
function extractCardSvg(cid: string): string | null {
  const cached = svgCache.get(cid);
  if (cached) return cached;
  if (typeof document === "undefined" || !customElements.get("playing-card")) {
    return null;
  }

  const host = document.createElement("playing-card");
  host.setAttribute("cid", cid);
  host.style.cssText =
    "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(host);
  const img = host.querySelector("img");
  const src = img?.getAttribute("src") ?? img?.src ?? "";
  host.remove();

  const markup = decodeCardMeisterDataUri(src);
  if (!markup) return null;

  // Force fluid sizing; viewBox keeps proportions.
  const sized = markup.replace(
    /<svg\b([^>]*)>/i,
    (_m, attrs: string) => {
      const cleaned = attrs
        .replace(/\swidth=('|")[^'"]*\1/i, "")
        .replace(/\sheight=('|")[^'"]*\1/i, "");
      return `<svg${cleaned} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`;
    },
  );

  svgCache.set(cid, sized);
  return sized;
}

export function PlayingCard({
  card,
  faceDown = false,
  small = false,
}: {
  card?: Card | null;
  faceDown?: boolean;
  small?: boolean;
}) {
  const showBack = faceDown || !card;
  const label = showBack ? "牌背" : cardLabel(card!);
  const cid = showBack ? CARD_BACK_CID : cardmeisterCid(card!);
  const [svg, setSvg] = useState<string | null>(() => svgCache.get(cid) ?? null);

  useEffect(() => {
    const next = extractCardSvg(cid);
    if (next) {
      setSvg(next);
      return;
    }
    // CardMeister script may still be registering.
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      const markup = extractCardSvg(cid);
      if (markup || tries > 40) {
        window.clearInterval(id);
        if (markup) setSvg(markup);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [cid]);

  return (
    <div
      className={`playing-card ${small ? "small" : ""} ${showBack ? "back" : ""}`}
      title={label}
      role="img"
      aria-label={label}
    >
      {svg ? (
        <div
          className="card-inline-svg"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="card-fallback">{label}</div>
      )}
    </div>
  );
}
