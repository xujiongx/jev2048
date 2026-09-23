import type { CSSProperties, DetailedHTMLProps, HTMLAttributes } from "react";

type PlayingCardElementProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  cid?: string;
  suit?: string;
  rank?: string | number;
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
