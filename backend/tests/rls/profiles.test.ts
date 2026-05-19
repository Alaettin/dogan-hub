/**
 * RLS-Smoke-Test für profiles.
 *
 * Verifiziert, dass zwei User sich gegenseitig nicht in die profiles-Tabelle
 * sehen können — Pflicht-Test laut PLAN.md §4f.
 *
 * Voraussetzungen:
 * - .env mit SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY ist befüllt
 * - Migrations 0001 + 0002 sind gepushed
 *
 * Der Test läuft gegen die echte Supabase-Cloud-DB. Test-User werden erzeugt
 * und am Ende wieder gelöscht.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const skipReason =
  !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY
    ? "Supabase env vars missing — RLS test skipped (siehe docs/SUPABASE_SETUP.md)"
    : null;

describe.skipIf(skipReason !== null)("RLS: profiles", () => {
  const PASSWORD = "rls-test-password-2026-secure";
  let admin: SupabaseClient;
  let userAId: string;
  let userBId: string;
  let userAClient: SupabaseClient;
  let userBClient: SupabaseClient;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // User A
    const emailA = `rls-test-a-${Date.now()}@example.test`;
    const { data: createA, error: errA } = await admin.auth.admin.createUser({
      email: emailA,
      password: PASSWORD,
      email_confirm: true,
    });
    if (errA || !createA?.user) throw errA ?? new Error("createA returned no user");
    userAId = createA.user.id;

    // User B
    const emailB = `rls-test-b-${Date.now()}@example.test`;
    const { data: createB, error: errB } = await admin.auth.admin.createUser({
      email: emailB,
      password: PASSWORD,
      email_confirm: true,
    });
    if (errB || !createB?.user) throw errB ?? new Error("createB returned no user");
    userBId = createB.user.id;

    // Sign-in pro User → user-scoped Client mit JWT
    const signA = await createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!).auth.signInWithPassword({
      email: emailA,
      password: PASSWORD,
    });
    const signB = await createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!).auth.signInWithPassword({
      email: emailB,
      password: PASSWORD,
    });
    if (signA.error || !signA.data.session) throw signA.error ?? new Error("signA no session");
    if (signB.error || !signB.data.session) throw signB.error ?? new Error("signB no session");

    userAClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${signA.data.session.access_token}` } },
    });
    userBClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${signB.data.session.access_token}` } },
    });
  });

  afterAll(async () => {
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });

  it("User A sees only their own profile, not User B's", async () => {
    const { data, error } = await userAClient.from("profiles").select("id");
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const ids = (data ?? []).map((row: { id: string }) => row.id);
    expect(ids).toContain(userAId);
    expect(ids).not.toContain(userBId);
  });

  it("User A cannot UPDATE User B's profile", async () => {
    const { data, error } = await userAClient
      .from("profiles")
      .update({ display_name: "Hacked" })
      .eq("id", userBId)
      .select();

    // PostgREST returns empty data when RLS blocks the row, error is null
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    // Verify B's profile is untouched
    const { data: bProfile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", userBId)
      .single();
    expect(bProfile?.display_name).not.toBe("Hacked");
  });

  it("User A cannot DELETE any profile (no DELETE policy = deny)", async () => {
    const { data, error } = await userAClient
      .from("profiles")
      .delete()
      .eq("id", userAId)
      .select();

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    // A's profile still exists
    const { data: aProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userAId)
      .single();
    expect(aProfile?.id).toBe(userAId);
  });
});
