import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";
// Runtime ESM module shared with Vercel / Express
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- plain .mjs, no TS types
import { decideMove } from "./server/decide.mjs";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function isDecidePath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0];
  return path === "/api/decide";
}

function jevApiPlugin(apiKey: string): Plugin {
  const handler = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
    if (req.method !== "POST" || !isDecidePath(req.url)) {
      next();
      return;
    }

    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const result = await decideMove(body, apiKey, "http://localhost:5173");
      sendJson(res, result.status, result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "未知错误";
      sendJson(res, 500, { error: message });
    }
  };

  return {
    name: "jev-decisions-api",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = env.OPENROUTER_API_KEY ?? "";

  return {
    plugins: [
      react(),
      jevApiPlugin(apiKey),
      {
        // Avoid CORS-tainted stylesheets being dropped on some mobile WebViews.
        name: "strip-stylesheet-crossorigin",
        transformIndexHtml(html) {
          return html.replace(
            /<link rel="stylesheet" crossorigin\s+/g,
            '<link rel="stylesheet" ',
          );
        },
      },
    ],
    server: {
      port: 5173,
      host: true,
    },
  };
});