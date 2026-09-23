import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function BackNav({ to = "/", label = "工具集" }: { to?: string; label?: string }) {
  return (
    <nav className="topnav">
      <Link to={to} className="back-link">
        <ArrowLeft size={16} strokeWidth={2.25} aria-hidden />
        <span>{label}</span>
      </Link>
    </nav>
  );
}
