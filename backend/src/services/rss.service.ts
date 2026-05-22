import { XMLParser } from "fast-xml-parser";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger.js";

// =====================================================================
// RSS-Service: fetch + parse (RSS 2.0 / Atom / RDF) + refresh + OPML.
// Bewusst ohne externe Reader-Lib — fast-xml-parser reicht und hält die
// Abhängigkeiten klein. Items werden per Upsert (onConflict feed_id,guid)
// dedupliziert.
// =====================================================================

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "MyHub-RSS/1.0 (+https://myhub.local)";
const MAX_ITEMS_PER_REFRESH = 100;

export interface ParsedItem {
  guid: string;
  title: string;
  link: string | null;
  author: string | null;
  summary: string | null;
  content: string | null;
  imageUrl: string | null;
  publishedAt: string | null; // ISO oder null
}

export interface ParsedFeed {
  title: string;
  description: string | null;
  siteUrl: string | null;
  items: ParsedItem[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  processEntities: true,
  // CDATA wird automatisch in #text gemerged.
});

// ─── kleine Helfer ───────────────────────────────────────────────────

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// Liefert reinen Text aus String oder { "#text", "@_type" }-Objekt.
function textOf(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return (obj["#text"] as string).trim() || null;
  }
  return null;
}

function toIso(value: unknown): string | null {
  const raw = textOf(value);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstImageFrom(html: string | null): string | null {
  if (!html) return null;
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return m ? m[1] : null;
}

// ─── Atom-Link-Auflösung ─────────────────────────────────────────────
function atomLink(link: unknown): string | null {
  const links = asArray(link);
  if (links.length === 0) return null;
  // bevorzugt rel="alternate" (oder kein rel), sonst erster mit href.
  let chosen: Record<string, unknown> | undefined;
  for (const l of links) {
    if (typeof l !== "object" || l === null) continue;
    const obj = l as Record<string, unknown>;
    const rel = obj["@_rel"];
    if (rel === undefined || rel === "alternate") {
      chosen = obj;
      break;
    }
    if (!chosen) chosen = obj;
  }
  const href = chosen?.["@_href"];
  return typeof href === "string" ? href : null;
}

// ─── Parser ──────────────────────────────────────────────────────────

export function parseFeed(xml: string): ParsedFeed {
  const root = parser.parse(xml);

  // RSS 2.0
  if (root?.rss?.channel) {
    const channel = root.rss.channel;
    const items = asArray(channel.item).map(parseRssItem).filter(Boolean) as ParsedItem[];
    return {
      title: textOf(channel.title) ?? "",
      description: textOf(channel.description),
      siteUrl: textOf(channel.link),
      items,
    };
  }

  // Atom
  if (root?.feed) {
    const feed = root.feed;
    const items = asArray(feed.entry).map(parseAtomEntry).filter(Boolean) as ParsedItem[];
    return {
      title: textOf(feed.title) ?? "",
      description: textOf(feed.subtitle),
      siteUrl: atomLink(feed.link),
      items,
    };
  }

  // RDF (RSS 1.0)
  const rdf = root?.["rdf:RDF"] ?? root?.RDF;
  if (rdf) {
    const channel = rdf.channel ?? {};
    const items = asArray(rdf.item).map(parseRssItem).filter(Boolean) as ParsedItem[];
    return {
      title: textOf(channel.title) ?? "",
      description: textOf(channel.description),
      siteUrl: textOf(channel.link),
      items,
    };
  }

  throw new Error("Unbekanntes Feed-Format (weder RSS, Atom noch RDF)");
}

function mediaImage(node: Record<string, unknown>): string | null {
  // enclosure (RSS), media:content / media:thumbnail (Media RSS)
  for (const enc of asArray(node.enclosure)) {
    if (typeof enc === "object" && enc) {
      const o = enc as Record<string, unknown>;
      const type = String(o["@_type"] ?? "");
      const url = o["@_url"];
      if (typeof url === "string" && (type.startsWith("image") || !type)) return url;
    }
  }
  for (const key of ["media:content", "media:thumbnail"]) {
    for (const m of asArray(node[key])) {
      if (typeof m === "object" && m) {
        const url = (m as Record<string, unknown>)["@_url"];
        if (typeof url === "string") return url;
      }
    }
  }
  return null;
}

function parseRssItem(node: unknown): ParsedItem | null {
  if (typeof node !== "object" || node === null) return null;
  const o = node as Record<string, unknown>;

  const link = textOf(o.link);
  const guidRaw = o.guid;
  const guid = textOf(guidRaw) ?? link ?? textOf(o.title);
  if (!guid) return null;

  const content = textOf(o["content:encoded"]) ?? textOf(o.description);
  const descText = textOf(o.description);
  const summary = descText ? stripHtml(descText).slice(0, 600) : null;

  return {
    guid,
    title: textOf(o.title) ?? "(ohne Titel)",
    link,
    author: textOf(o.author) ?? textOf(o["dc:creator"]),
    summary,
    content,
    imageUrl: mediaImage(o) ?? firstImageFrom(content),
    publishedAt: toIso(o.pubDate) ?? toIso(o["dc:date"]),
  };
}

function parseAtomEntry(node: unknown): ParsedItem | null {
  if (typeof node !== "object" || node === null) return null;
  const o = node as Record<string, unknown>;

  const link = atomLink(o.link);
  const guid = textOf(o.id) ?? link ?? textOf(o.title);
  if (!guid) return null;

  const content = textOf(o.content) ?? textOf(o.summary);
  const summaryRaw = textOf(o.summary) ?? content;
  const summary = summaryRaw ? stripHtml(summaryRaw).slice(0, 600) : null;

  let author: string | null = null;
  const authorNode = asArray(o.author)[0];
  if (authorNode && typeof authorNode === "object") {
    author = textOf((authorNode as Record<string, unknown>).name);
  }

  return {
    guid,
    title: textOf(o.title) ?? "(ohne Titel)",
    link,
    author,
    summary,
    content,
    imageUrl: mediaImage(o) ?? firstImageFrom(content),
    publishedAt: toIso(o.published) ?? toIso(o.updated),
  };
}

// ─── Fetch ───────────────────────────────────────────────────────────

export async function fetchAndParse(feedUrl: string): Promise<ParsedFeed> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml, */*" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const xml = await res.text();
    return parseFeed(xml);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Refresh (Upsert) ────────────────────────────────────────────────

export interface FeedRow {
  id: string;
  owner_id: string;
  feed_url: string;
  title: string;
}

export interface RefreshResult {
  inserted: number;
  feedTitle: string;
}

// Aktualisiert einen Feed: fetch + parse + Items upserten + Feed-Status setzen.
// Wirft NICHT — bei Fehler wird status='error' gesetzt und der Fehler geloggt.
export async function refreshFeed(
  client: SupabaseClient,
  feed: FeedRow,
): Promise<RefreshResult> {
  try {
    const parsed = await fetchAndParse(feed.feed_url);
    const items = parsed.items.slice(0, MAX_ITEMS_PER_REFRESH);

    let inserted = 0;
    if (items.length > 0) {
      const rows = items.map((it) => ({
        feed_id: feed.id,
        owner_id: feed.owner_id,
        guid: it.guid,
        title: it.title,
        link: it.link,
        author: it.author,
        summary: it.summary,
        content: it.content,
        image_url: it.imageUrl,
        published_at: it.publishedAt,
      }));
      // ignoreDuplicates: bestehende Artikel (gelesen/Favorit) bleiben unberührt.
      const { data, error } = await client
        .from("rss_items")
        .upsert(rows, { onConflict: "feed_id,guid", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(`Upsert fehlgeschlagen: ${error.message}`);
      inserted = data?.length ?? 0;
    }

    const newTitle = feed.title?.trim() ? feed.title : parsed.title || feed.feed_url;
    await client
      .from("rss_feeds")
      .update({
        title: newTitle,
        description: parsed.description,
        site_url: parsed.siteUrl,
        status: "active",
        last_error: null,
        error_count: 0,
        last_fetched_at: new Date().toISOString(),
      })
      .eq("id", feed.id);

    return { inserted, feedTitle: newTitle };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err: message, feedId: feed.id, url: feed.feed_url }, "rss.refreshFeed failed");
    // error_count hochzählen via RPC-frei: aktuellen Wert lesen ist teuer →
    // wir setzen status=error + last_error; Cron filtert weiter nach status.
    await client
      .from("rss_feeds")
      .update({
        status: "error",
        last_error: message.slice(0, 500),
        last_fetched_at: new Date().toISOString(),
      })
      .eq("id", feed.id);
    throw err;
  }
}

// ─── OPML ────────────────────────────────────────────────────────────

export interface OpmlOutline {
  title: string;
  feedUrl: string;
  siteUrl: string | null;
}

export interface OpmlFolder {
  name: string;
  feeds: OpmlOutline[];
}

const opmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ExportFeed {
  title: string;
  feed_url: string;
  site_url: string | null;
  folder_id: string | null;
}
export interface ExportFolder {
  id: string;
  name: string;
}

// Baut eine OPML 2.0 Datei. Feeds in Ordnern werden geschachtelt,
// Feeds ohne Ordner top-level.
export function buildOpml(feeds: ExportFeed[], folders: ExportFolder[]): string {
  const byFolder = new Map<string | null, ExportFeed[]>();
  for (const f of feeds) {
    const key = f.folder_id;
    const arr = byFolder.get(key) ?? [];
    arr.push(f);
    byFolder.set(key, arr);
  }

  const outline = (f: ExportFeed) =>
    `      <outline type="rss" text="${escapeXml(f.title || f.feed_url)}" title="${escapeXml(
      f.title || f.feed_url,
    )}" xmlUrl="${escapeXml(f.feed_url)}"${f.site_url ? ` htmlUrl="${escapeXml(f.site_url)}"` : ""}/>`;

  const lines: string[] = [];
  for (const folder of folders) {
    const folderFeeds = byFolder.get(folder.id) ?? [];
    lines.push(`    <outline text="${escapeXml(folder.name)}" title="${escapeXml(folder.name)}">`);
    for (const f of folderFeeds) lines.push(outline(f));
    lines.push("    </outline>");
  }
  for (const f of byFolder.get(null) ?? []) lines.push(outline(f).replace(/^ {6}/, "    "));

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>MyHub RSS Export</title>
  </head>
  <body>
${lines.join("\n")}
  </body>
</opml>`;
}

// Parst OPML → Liste von Ordnern (top-level outlines mit Kindern) und
// top-level Feeds (ohne Ordner, Sammelordner null).
export function parseOpml(xml: string): { folders: OpmlFolder[]; rootFeeds: OpmlOutline[] } {
  const root = opmlParser.parse(xml);
  const body = root?.opml?.body;
  if (!body) throw new Error("Keine OPML-<body> gefunden");

  const folders: OpmlFolder[] = [];
  const rootFeeds: OpmlOutline[] = [];

  const toOutline = (o: Record<string, unknown>): OpmlOutline | null => {
    const xmlUrl = o["@_xmlUrl"];
    if (typeof xmlUrl !== "string" || !xmlUrl) return null;
    const title = (o["@_title"] ?? o["@_text"]) as string | undefined;
    const html = o["@_htmlUrl"];
    return {
      title: title?.trim() || xmlUrl,
      feedUrl: xmlUrl,
      siteUrl: typeof html === "string" ? html : null,
    };
  };

  for (const o of asArray(body.outline)) {
    if (typeof o !== "object" || o === null) continue;
    const obj = o as Record<string, unknown>;
    const children = asArray(obj.outline);
    const direct = toOutline(obj);
    if (direct) {
      // outline mit xmlUrl = Feed direkt unter body
      rootFeeds.push(direct);
    } else if (children.length > 0) {
      // outline ohne xmlUrl mit Kindern = Ordner
      const name = ((obj["@_title"] ?? obj["@_text"]) as string | undefined)?.trim() || "Ordner";
      const feeds = children
        .map((c) => (typeof c === "object" && c ? toOutline(c as Record<string, unknown>) : null))
        .filter(Boolean) as OpmlOutline[];
      if (feeds.length > 0) folders.push({ name, feeds });
    }
  }

  return { folders, rootFeeds };
}
