import dns from "node:dns/promises";
import net from "node:net";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { recordEvent } from "../services/audit.service.js";
import {
  createPlatformSchema,
  updatePlatformSchema,
  createListingSchema,
  updateListingSchema,
  markSoldSchema,
} from "../schemas/shop.schema.js";

export const shopRouter = Router();

const PLATFORM_COLS = "id, owner_id, name, url, color, notes, created_at, updated_at";
const LISTING_COLS =
  "id, platform_id, owner_id, title, price, quantity, purchase_price, fees, condition, category, item_url, image_url, notes, status, listed_at, sold_at, sold_price, created_at, updated_at";

// numeric kommt als String aus supabase-js → in Number wandeln.
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

interface RawListing {
  status: string;
  price: unknown;
  quantity: number;
  purchase_price: unknown;
  fees: unknown;
  sold_price: unknown;
  sold_at: string | null;
  platform_id: string;
}

function mapListing(row: Record<string, unknown>) {
  return {
    ...row,
    price: num(row.price),
    purchase_price: numOrNull(row.purchase_price),
    fees: numOrNull(row.fees),
    sold_price: numOrNull(row.sold_price),
  };
}

// ─── Stats-Berechnung (alle Beträge bereits als Number) ──────────────
function computeStats(listings: RawListing[]) {
  let active = 0;
  let sold = 0;
  let cancelled = 0;
  let activeValue = 0;
  let revenue = 0;
  let cost = 0;

  // letzte 12 Monate (inkl. aktueller) als Fenster
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const byMonth = new Map<string, { revenue: number; profit: number; sold_count: number }>();
  for (const m of months) byMonth.set(m, { revenue: 0, profit: 0, sold_count: 0 });

  for (const l of listings) {
    const price = num(l.price);
    const qty = l.quantity || 1;
    if (l.status === "active") {
      active += 1;
      activeValue += price * qty;
    } else if (l.status === "cancelled") {
      cancelled += 1;
    } else if (l.status === "sold") {
      sold += 1;
      const sp = num(l.sold_price);
      const c = num(l.purchase_price) + num(l.fees);
      revenue += sp;
      cost += c;
      const month = l.sold_at ? l.sold_at.slice(0, 7) : null;
      if (month && byMonth.has(month)) {
        const bucket = byMonth.get(month)!;
        bucket.revenue += sp;
        bucket.profit += sp - c;
        bucket.sold_count += 1;
      }
    }
  }

  const total = active + sold + cancelled;
  return {
    listings: total,
    active,
    sold,
    cancelled,
    active_value: round2(activeValue),
    revenue: round2(revenue),
    cost: round2(cost),
    profit: round2(revenue - cost),
    avg_sale_price: sold > 0 ? round2(revenue / sold) : 0,
    sell_through: total > 0 ? Math.round((sold / total) * 100) : 0,
    revenue_by_month: months.map((m) => ({ month: m, ...byMonth.get(m)!, revenue: round2(byMonth.get(m)!.revenue), profit: round2(byMonth.get(m)!.profit) })),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Bild-Proxy ──────────────────────────────────────────────────────
// Viele Marktplatz-Bilder (z.B. Cardmarket) sind hotlink-geschützt
// (Referer-Prüfung) → der Browser kann sie nicht direkt laden. Der Proxy
// holt das Bild server-seitig mit passendem Referer (= Origin der Bild-URL)
// und liefert es von eigener Domain. SSRF-Schutz: nur http(s), keine
// privaten/loopback Hosts, nur image/* Content-Type, Größenlimit.
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function isPrivateIp(ip: string): boolean {
  if (net.isIP(ip) === 4) {
    const p = ip.split(".").map(Number);
    if (p[0] === 10 || p[0] === 127 || p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    return false;
  }
  const v = ip.toLowerCase();
  if (v === "::1") return true;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return false;
}

shopRouter.get("/image-proxy", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const raw = (req.query.url as string | undefined)?.trim();
    if (!raw) throw errors.badRequest("url fehlt");

    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw errors.badRequest("Ungültige URL");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw errors.badRequest("Nur http(s) erlaubt");
    }

    // SSRF: Hostname auflösen, private Ziele ablehnen.
    try {
      const addrs = await dns.lookup(url.hostname, { all: true });
      if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
        throw errors.badRequest("Host nicht erlaubt");
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AppError") throw e;
      throw errors.badRequest("Host nicht auflösbar");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const upstream = await fetch(url.toString(), {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MyHub/1.0)",
          Referer: `${url.protocol}//${url.host}/`,
          Accept: "image/*,*/*;q=0.8",
        },
      });
      if (!upstream.ok) throw errors.badRequest(`Bild nicht erreichbar (HTTP ${upstream.status})`);
      const type = upstream.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) throw errors.badRequest("Kein Bild");
      const len = Number(upstream.headers.get("content-length") ?? 0);
      if (len > MAX_IMAGE_BYTES) throw errors.badRequest("Bild zu groß");

      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.byteLength > MAX_IMAGE_BYTES) throw errors.badRequest("Bild zu groß");

      res.setHeader("Content-Type", type);
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.send(buf);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AppError") return next(err);
    logger.warn({ err }, "shop image-proxy failed");
    next(errors.badRequest("Bild konnte nicht geladen werden"));
  }
});

// =====================================================================
// Plattformen
// =====================================================================
shopRouter.get("/platforms", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const [{ data: platforms, error: pErr }, { data: listings, error: lErr }] = await Promise.all([
      client.from("sales_platforms").select(PLATFORM_COLS).order("name", { ascending: true }),
      client.from("shop_listings").select("platform_id, status, price, quantity, sold_price"),
    ]);
    if (pErr) throw errors.internal(`Plattformen laden fehlgeschlagen: ${pErr.message}`);
    if (lErr) throw errors.internal(`Inserate laden fehlgeschlagen: ${lErr.message}`);

    // Mini-Stats je Plattform
    const stats = new Map<string, { active: number; sold: number; revenue: number; active_value: number }>();
    for (const l of listings ?? []) {
      const s = stats.get(l.platform_id as string) ?? { active: 0, sold: 0, revenue: 0, active_value: 0 };
      if (l.status === "active") {
        s.active += 1;
        s.active_value += num(l.price) * ((l.quantity as number) || 1);
      } else if (l.status === "sold") {
        s.sold += 1;
        s.revenue += num(l.sold_price);
      }
      stats.set(l.platform_id as string, s);
    }

    const items = (platforms ?? []).map((p) => {
      const s = stats.get(p.id as string) ?? { active: 0, sold: 0, revenue: 0, active_value: 0 };
      return { ...p, active: s.active, sold: s.sold, revenue: round2(s.revenue), active_value: round2(s.active_value) };
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

shopRouter.get("/platforms/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("sales_platforms")
      .select(PLATFORM_COLS)
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw errors.internal("Plattform laden fehlgeschlagen");
    if (!data) throw errors.notFound("Plattform nicht gefunden");
    res.json({ platform: data });
  } catch (err) {
    next(err);
  }
});

shopRouter.post("/platforms", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = createPlatformSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("sales_platforms")
      .insert({ ...body, owner_id: req.user.id })
      .select(PLATFORM_COLS)
      .single();
    if (error || !data) throw errors.internal(`Anlegen fehlgeschlagen: ${error?.message}`);
    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "sales_platform",
      resource_id: data.id,
      metadata: { name: data.name },
      ip: req.ip,
    });
    res.status(201).json({ platform: data });
  } catch (err) {
    next(err);
  }
});

shopRouter.patch("/platforms/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updatePlatformSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("sales_platforms")
      .update(body)
      .eq("id", req.params.id)
      .select(PLATFORM_COLS)
      .maybeSingle();
    if (error) throw errors.internal(`Update fehlgeschlagen: ${error.message}`);
    if (!data) throw errors.notFound("Plattform nicht gefunden");
    res.json({ platform: data });
  } catch (err) {
    next(err);
  }
});

shopRouter.delete("/platforms/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data: existing } = await client
      .from("sales_platforms")
      .select("id, name")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!existing) throw errors.notFound("Plattform nicht gefunden");
    const { error } = await client.from("sales_platforms").delete().eq("id", req.params.id);
    if (error) throw errors.internal("Löschen fehlgeschlagen");
    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "sales_platform",
      resource_id: existing.id,
      metadata: { name: existing.name },
      ip: req.ip,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// =====================================================================
// Inserate
// =====================================================================
shopRouter.get("/platforms/:platformId/listings", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    let query = client
      .from("shop_listings")
      .select(LISTING_COLS)
      .eq("platform_id", req.params.platformId)
      .order("listed_at", { ascending: false })
      .order("created_at", { ascending: false });
    const status = (req.query.status as string | undefined)?.trim();
    if (status && ["active", "sold", "cancelled"].includes(status)) {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error) throw errors.internal(`Inserate laden fehlgeschlagen: ${error.message}`);
    res.json({ items: (data ?? []).map(mapListing) });
  } catch (err) {
    next(err);
  }
});

shopRouter.post("/platforms/:platformId/listings", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = createListingSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);

    // Plattform-Ownership prüfen (klare 404 statt Insert-Fehler).
    const { data: platform } = await client
      .from("sales_platforms")
      .select("id")
      .eq("id", req.params.platformId)
      .maybeSingle();
    if (!platform) throw errors.notFound("Plattform nicht gefunden");

    const { data, error } = await client
      .from("shop_listings")
      .insert({
        ...body,
        platform_id: req.params.platformId,
        owner_id: req.user.id,
      })
      .select(LISTING_COLS)
      .single();
    if (error || !data) throw errors.internal(`Anlegen fehlgeschlagen: ${error?.message}`);
    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "shop_listing",
      resource_id: data.id,
      metadata: { title: data.title, platform_id: req.params.platformId },
      ip: req.ip,
    });
    res.status(201).json({ listing: mapListing(data) });
  } catch (err) {
    next(err);
  }
});

shopRouter.patch("/listings/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateListingSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("shop_listings")
      .update(body)
      .eq("id", req.params.id)
      .select(LISTING_COLS)
      .maybeSingle();
    if (error) throw errors.internal(`Update fehlgeschlagen: ${error.message}`);
    if (!data) throw errors.notFound("Inserat nicht gefunden");
    res.json({ listing: mapListing(data) });
  } catch (err) {
    next(err);
  }
});

shopRouter.post("/listings/:id/sell", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = markSoldSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const soldAt = body.sold_at ?? new Date().toISOString().slice(0, 10);
    const { data, error } = await client
      .from("shop_listings")
      .update({ status: "sold", sold_price: body.sold_price, sold_at: soldAt })
      .eq("id", req.params.id)
      .select(LISTING_COLS)
      .maybeSingle();
    if (error) throw errors.internal(`Verkauf speichern fehlgeschlagen: ${error.message}`);
    if (!data) throw errors.notFound("Inserat nicht gefunden");
    res.json({ listing: mapListing(data) });
  } catch (err) {
    next(err);
  }
});

shopRouter.delete("/listings/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data: existing } = await client
      .from("shop_listings")
      .select("id, title")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!existing) throw errors.notFound("Inserat nicht gefunden");
    const { error } = await client.from("shop_listings").delete().eq("id", req.params.id);
    if (error) throw errors.internal("Löschen fehlgeschlagen");
    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "shop_listing",
      resource_id: existing.id,
      metadata: { title: existing.title },
      ip: req.ip,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// =====================================================================
// Statistiken
// =====================================================================
shopRouter.get("/stats", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const [{ data: platforms }, { data: listings, error }] = await Promise.all([
      client.from("sales_platforms").select("id, name, color"),
      client
        .from("shop_listings")
        .select("platform_id, status, price, quantity, purchase_price, fees, sold_price, sold_at"),
    ]);
    if (error) throw errors.internal(`Statistik laden fehlgeschlagen: ${error.message}`);
    const rows = (listings ?? []) as unknown as RawListing[];

    const totals = computeStats(rows);

    // by_platform
    const byPlatformMap = new Map<string, RawListing[]>();
    for (const l of rows) {
      const arr = byPlatformMap.get(l.platform_id) ?? [];
      arr.push(l);
      byPlatformMap.set(l.platform_id, arr);
    }
    const by_platform = (platforms ?? []).map((p) => {
      const s = computeStats(byPlatformMap.get(p.id as string) ?? []);
      return {
        platform_id: p.id,
        name: p.name,
        color: p.color,
        active: s.active,
        sold: s.sold,
        active_value: s.active_value,
        revenue: s.revenue,
        profit: s.profit,
      };
    });

    res.json({ platforms: (platforms ?? []).length, ...totals, by_platform });
  } catch (err) {
    next(err);
  }
});

shopRouter.get("/platforms/:id/stats", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data: listings, error } = await client
      .from("shop_listings")
      .select("platform_id, status, price, quantity, purchase_price, fees, sold_price, sold_at")
      .eq("platform_id", req.params.id);
    if (error) throw errors.internal(`Statistik laden fehlgeschlagen: ${error.message}`);
    res.json(computeStats((listings ?? []) as unknown as RawListing[]));
  } catch (err) {
    next(err);
  }
});
