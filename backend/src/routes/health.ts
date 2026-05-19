import { Router } from "express";
import { supabaseService } from "../config/supabase.js";
import { STORAGE_BUCKET } from "../services/storage.service.js";

export const healthRouter = Router();

interface Component {
  ok: boolean;
  latency_ms: number;
  error?: string;
}

async function timed<T>(fn: () => Promise<T>): Promise<Component> {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, latency_ms: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Liveness: Prozess läuft.
healthRouter.get("/live", (_req, res) => {
  res.json({ status: "ok" });
});

// Readiness: Supabase erreichbar?
healthRouter.get("/ready", async (_req, res) => {
  const db = await timed(async () => {
    const { error } = await supabaseService
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
  });

  res.status(db.ok ? 200 : 503).json({
    status: db.ok ? "ok" : "degraded",
    supabase: db,
    latency_ms: db.latency_ms,
  });
});

// Deep-Health: DB + Auth + Storage einzeln messen, jeweils mit Latenz.
// Wird vom Monitoring (Uptime Kuma) als detailliertes Probing verwendet.
healthRouter.get("/deep", async (_req, res) => {
  const [db, auth, storage] = await Promise.all([
    timed(async () => {
      const { error } = await supabaseService
        .from("profiles")
        .select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
    }),
    timed(async () => {
      const { error } = await supabaseService.auth.admin.listUsers({ perPage: 1 });
      if (error) throw new Error(error.message);
    }),
    timed(async () => {
      const { error } = await supabaseService.storage.from(STORAGE_BUCKET).list("", {
        limit: 1,
      });
      if (error) throw new Error(error.message);
    }),
  ]);

  const allOk = db.ok && auth.ok && storage.ok;
  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    components: { db, auth, storage },
  });
});
