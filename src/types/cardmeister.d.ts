import type { CSSProperties, DetailedHTMLProps, HTMLAttributes } from "react";

type PlayingCardElementProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  cid?: string;
  suit?: string;
  rank?: string | number;
  /** Extra attrs injected into the root <svg> (e.g. width/height for retina). */
  svg?: string;
  style?: CSSProperties;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "playing-card": PlayingCardElementProps;
    }
  }
}

export {};
