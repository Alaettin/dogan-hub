/**
 * RLS-Tests für die übrigen Tabellen (Etappe 5 — Security-Hardening).
 *
 * Deckt ab:
 * - files              (owner_id-based Policy)
 * - database_views     (owner_id-based Policy)
 * - audit_log          (Select-own + Admin-Read, kein User-Insert/Update/Delete)
 * - entry_files        (Bridge — User muss BEIDE Seiten besitzen)
 *
 * Läuft gegen die echte Cloud-DB. Test-User werden am Ende gelöscht
 * (cascade räumt alle abhängigen Rows auf).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const skipReason =
  !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY
    ? "Supabase env vars missing — RLS test skipped"
    : null;

describe.skipIf(skipReason !== null)("RLS: cross-cutting (files, views, audit, entry_files)", () => {
  const PASSWORD = "rls-cross-test-2026-secure";
  let admin: SupabaseClient;
  let userA: { id: string; client: SupabaseClient };
  let userB: { id: string; client: SupabaseClient };
  const created = {
    databaseId: "",
    entryId: "",
    fileId: "",
    viewId: "",
  };

  async function createUser(prefix: string): Promise<{ id: string; client: SupabaseClient }> {
    const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !data?.user) throw error ?? new Error("createUser failed");

    const signIn = await createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!).auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (signIn.error || !signIn.data.session) throw signIn.error ?? new Error("signIn failed");

    const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${signIn.data.session.access_token}` } },
    });

    return { id: data.user.id, client };
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    userA = await createUser("rls-cross-a");
    userB = await createUser("rls-cross-b");

    // User A erstellt: database + entry + file + database_view + entry_file-Bridge
    const { data: db } = await userA.client
      .from("databases")
      .insert({ owner_id: userA.id, name: "Cross-DB", schema: [] })
      .select()
      .single();
    if (!db) throw new Error("db create failed");
    created.databaseId = db.id;

    const { data: entry } = await userA.client
      .from("entries")
      .insert({ database_id: db.id, owner_id: userA.id, data: { foo: "bar" } })
      .select()
      .single();
    if (!entry) throw new Error("entry create failed");
    created.entryId = entry.id;

    // File: muss owner_id setzen + unique storage_path
    const { data: file } = await userA.client
      .from("files")
      .insert({
        owner_id: userA.id,
        name: "test.txt",
        storage_path: `${userA.id}/rls-cross-test/${Date.now()}-test.txt`,
        mime_type: "text/plain",
        size_bytes: 100,
      })
      .select()
      .single();
    if (!file) throw new Error("file create failed");
    created.fileId = file.id;

    const { data: view, error: viewErr } = await userA.client
      .from("database_views")
      .insert({
        database_id: db.id,
        owner_id: userA.id,
        name: "Default-View",
        view_type: "table",
        config: { columns: [] },
      })
      .select()
      .single();
    if (viewErr || !view) throw viewErr ?? new Error("view create failed");
    created.viewId = view.id;

    // Bridge: Entry + File von A
    const { error: bridgeErr } = await userA.client
      .from("entry_files")
      .insert({ entry_id: entry.id, file_id: file.id });
    if (bridgeErr) throw bridgeErr;

    // Audit-Event via Service-Role schreiben (Backend tut das normalerweise so).
    await admin.from("audit_log").insert({
      user_id: userA.id,
      action: "create",
      resource_type: "file",
      resource_id: file.id,
    });
  });

  afterAll(async () => {
    if (userA?.id) await admin.auth.admin.deleteUser(userA.id);
    if (userB?.id) await admin.auth.admin.deleteUser(userB.id);
  });

  // ─── files ─────────────────────────────────────────────────────────
  it("files: User B sees no files of User A", async () => {
    const { data } = await userB.client.from("files").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("files: User B cannot UPDATE User A's file", async () => {
    const { data } = await userB.client
      .from("files")
      .update({ name: "Hacked.txt" })
      .eq("id", created.fileId)
      .select();
    expect(data ?? []).toHaveLength(0);

    const { data: intact } = await admin.from("files").select("name").eq("id", created.fileId).single();
    expect(intact?.name).toBe("test.txt");
  });

  it("files: User B cannot DELETE User A's file", async () => {
    const { data } = await userB.client.from("files").delete().eq("id", created.fileId).select();
    expect(data ?? []).toHaveLength(0);

    const { data: stillExists } = await admin.from("files").select("id").eq("id", created.fileId).single();
    expect(stillExists?.id).toBe(created.fileId);
  });

  // ─── database_views ────────────────────────────────────────────────
  it("database_views: User B sees no views of User A", async () => {
    const { data } = await userB.client.from("database_views").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("database_views: User B cannot UPDATE User A's view", async () => {
    const { data } = await userB.client
      .from("database_views")
      .update({ name: "Hacked" })
      .eq("id", created.viewId)
      .select();
    expect(data ?? []).toHaveLength(0);
  });

  // ─── entry_files (Bridge) ──────────────────────────────────────────
  it("entry_files: User B sees no bridges of User A", async () => {
    const { data } = await userB.client.from("entry_files").select("entry_id, file_id");
    expect(data ?? []).toHaveLength(0);
  });

  it("entry_files: User B cannot attach User A's file to their own entry", async () => {
    // User B legt erst eine eigene DB + Entry an, dann versucht er die Datei
    // von User A daran zu hängen. Das muss von der "files muss B gehören"-Policy
    // blockiert werden.
    const { data: bDb } = await userB.client
      .from("databases")
      .insert({ owner_id: userB.id, name: "B-DB", schema: [] })
      .select()
      .single();
    if (!bDb) throw new Error("B-DB create failed");

    const { data: bEntry } = await userB.client
      .from("entries")
      .insert({ database_id: bDb.id, owner_id: userB.id, data: {} })
      .select()
      .single();
    if (!bEntry) throw new Error("B-entry create failed");

    const { error } = await userB.client
      .from("entry_files")
      .insert({ entry_id: bEntry.id, file_id: created.fileId });

    // RLS-WITH-CHECK soll greifen — entweder Error oder leeres data
    expect(error).not.toBeNull();
  });

  // ─── audit_log ─────────────────────────────────────────────────────
  it("audit_log: User B sees no audit-events of User A", async () => {
    const { data } = await userB.client
      .from("audit_log")
      .select("id")
      .eq("user_id", userA.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("audit_log: User A cannot INSERT audit-events (only service role)", async () => {
    const { data, error } = await userA.client.from("audit_log").insert({
      user_id: userA.id,
      action: "create",
      resource_type: "fake",
    }).select();

    // Kein INSERT-Policy = Deny. Entweder Error oder leeres data.
    if (error) {
      expect(error).toBeDefined();
    } else {
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("audit_log: User A cannot UPDATE audit-events (append-only)", async () => {
    const { data: events } = await admin
      .from("audit_log")
      .select("id")
      .eq("user_id", userA.id)
      .limit(1);
    const eventId = events?.[0]?.id;
    if (!eventId) throw new Error("no audit event to test against");

    const { data } = await userA.client
      .from("audit_log")
      .update({ resource_type: "tampered" })
      .eq("id", eventId)
      .select();
    expect(data ?? []).toHaveLength(0);
  });

  it("audit_log: User A cannot DELETE audit-events (append-only)", async () => {
    const { data: events } = await admin
      .from("audit_log")
      .select("id")
      .eq("user_id", userA.id)
      .limit(1);
    const eventId = events?.[0]?.id;
    if (!eventId) throw new Error("no audit event to test against");

    const { data } = await userA.client
      .from("audit_log")
      .delete()
      .eq("id", eventId)
      .select();
    expect(data ?? []).toHaveLength(0);

    const { data: stillExists } = await admin.from("audit_log").select("id").eq("id", eventId).single();
    expect(stillExists?.id).toBe(eventId);
  });
});
