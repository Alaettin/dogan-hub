import express from "express";
import cors from "cors";

const PORT = Number(process.env.PORT) || 4000;
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();

app.use(cors({ origin: CORS_ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "dogan-hub-backend", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[dogan-hub-backend] listening on http://localhost:${PORT}`);
});
