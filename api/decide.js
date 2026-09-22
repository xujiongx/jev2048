import { decideMove } from "../server/decide.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "仅支持 POST" });
    return;
  }

  try {
    const siteUrl =
      (req.headers["x-forwarded-proto"] && req.headers["x-forwarded-host"]
        ? `${req.headers["x-forwarded-proto"]}://${req.headers["x-forwarded-host"]}`
        : null) ?? "https://openrouter.ai";

    const result = await decideMove(
      req.body,
      process.env.OPENROUTER_API_KEY ?? "",
      siteUrl,
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "未知错误",
    });
  }
}
