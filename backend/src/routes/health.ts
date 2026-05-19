import { Router } from "express";
import { supabaseService } from "../config/supabase.js";

export const healthRouter = Router();

// Liveness: Prozess läuft.
healthRouter.get("/live", (_req, res) => {
  res.json({ status: "ok" });
});

// Readiness: Supabase erreichbar?
healthRouter.get("/ready", async (_req, res) => {
  const start = Date.now();
  try {
    // Leichtgewichtiger Roundtrip — countOnly mit head=true holt nur Header
    const { error } = await supabaseService
      .from("profiles")
      .select("id", { count: "exact", head: true });

    if (error) {
      res.status(503).json({
        status: "degraded",
        supabase: { ok: false, error: error.message },
        latency_ms: Date.now() - start,
      });
      return;
    }

    res.json({
      status: "ok",
      supabase: { ok: true },
      latency_ms: Date.now() - start,
    });
  } catch (err) {
    res.status(503).json({
      status: "degraded",
      supabase: { ok: false, error: err instanceof Error ? err.message : String(err) },
      latency_ms: Date.now() - start,
    });
  }
});
