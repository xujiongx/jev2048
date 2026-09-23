import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Game2048 from "./pages/Game2048";
import Blackjack from "./pages/Blackjack";
import "./styles/base.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/2048" element={<Game2048 />} />
        <Route path="/blackjack" element={<Blackjack />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
