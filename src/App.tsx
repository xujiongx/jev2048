import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import "./styles/base.css";

const Game2048 = lazy(() => import("./pages/Game2048"));
const Blackjack = lazy(() => import("./pages/Blackjack"));
const Lines = lazy(() => import("./pages/Lines"));
const Minesweeper = lazy(() => import("./pages/Minesweeper"));
const Rps = lazy(() => import("./pages/Rps"));

function PageFallback() {
  return <div className="page-fallback">加载中…</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/2048" element={<Game2048 />} />
          <Route path="/blackjack" element={<Blackjack />} />
          <Route path="/lines" element={<Lines />} />
          <Route path="/minesweeper" element={<Minesweeper />} />
          <Route path="/rps" element={<Rps />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
