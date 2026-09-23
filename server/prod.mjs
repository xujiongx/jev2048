import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import dotenv from "dotenv";
import { decideMove } from "./decide.mjs";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const apiKey = process.env.OPENROUTER_API_KEY ?? "";
const port = Number(process.env.PORT ?? 4173);

const app = express();
app.use(express.json({ limit: "32kb" }));

app.post("/api/decide", async (req, res) => {
  try {
    const result = await decideMove(
      req.body,
      apiKey,
      `http://localhost:${port}`,
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "未知错误",
    });
  }
});

app.use(express.static(dist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(dist, "index.html"));
});

app.listen(port, () => {
  console.log(`Jev Dev Tools running at http://localhost:${port}`);
});
