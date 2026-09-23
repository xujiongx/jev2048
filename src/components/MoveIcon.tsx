import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  type LucideIcon,
} from "lucide-react";

const MOVE_ICON: Record<string, LucideIcon> = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
};

const MOVE_LABEL: Record<string, string> = {
  up: "上",
  down: "下",
  left: "左",
  right: "右",
};

export function MoveIcon({
  move,
  size = 14,
}: {
  move: string;
  size?: number;
}) {
  const Icon = MOVE_ICON[move];
  if (!Icon) return <span>{MOVE_LABEL[move] ?? move}</span>;
  return (
    <span className="move-icon" title={MOVE_LABEL[move] ?? move}>
      <Icon size={size} strokeWidth={2.4} aria-hidden />
      <span className="sr-only">{MOVE_LABEL[move] ?? move}</span>
    </span>
  );
}

export { MOVE_LABEL };
