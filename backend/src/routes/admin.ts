import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { supabaseService } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { recordEvent } from "../services/audit.service.js";

export const adminRouter = Router();

const inviteSchema = z.object({
  email: z.string().email().max(254),
});

const updateSchema = z
  .object({
    display_name: z.string().trim().min(1).max(80).optional(),
    role: z.enum(["admin", "user"]).optional(),
    email: z.string().email().max(254).optional(),
  })
  .refine(
    (v) => v.display_name !== undefined || v.role !== undefined || v.email !== undefined,
    { message: "Nothing to update" },
  );

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: "admin" | "user";
  created_at: string;
  updated_at: string;
}

// ─── GET /api/admin/users ────────────────────────────────────────────
// Listet alle Profile + zugehörige auth.user-Email (per listUsers).
adminRouter.get("/users", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const { data: profiles, error: profileError } = await supabaseService
      .from("profiles")
      .select("id, display_name, avatar_url, role, created_at, updated_at")
      .order("created_at", { ascending: true });
    if (profileError) throw errors.internal("Failed to load profiles");

    // listUsers paginiert (default 50). MVP: alles bis perPage=200 in einem Call.
    const { data: usersData, error: usersError } =
      await supabaseService.auth.admin.listUsers({ perPage: 200 });
    if (usersError) throw errors.internal("Failed to load auth users");

    const emailById = new Map(
      usersData.users.map((u) => [u.id, u.email ?? null] as const),
    );

    const items = (profiles as ProfileRow[] | null ?? []).map((p) => ({
      id: p.id,
      email: emailById.get(p.id) ?? null,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/users/invite ────────────────────────────────────
// Schickt Magic-Link-Einladung. profiles-Eintrag entsteht via on_auth_user_created-Trigger.
adminRouter.post("/users/invite", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const { email } = inviteSchema.parse(req.body);

    const { data, error } = await supabaseService.auth.admin.inviteUserByEmail(email);
    if (error) {
      // Supabase liefert bei „User existiert" einen 422 — wir mappen auf 409.
      if (error.status === 422 || error.code === "email_exists") {
        throw errors.conflict(`User mit Email ${email} existiert bereits`);
      }
      throw errors.internal(`Invite failed: ${error.message}`);
    }

    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "user_invite",
      resource_id: data.user?.id ?? null,
      metadata: { email },
      ip: req.ip,
    });

    res.status(201).json({
      id: data.user?.id ?? null,
      email,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/users/:id ──────────────────────────────────────
// Ändert display_name, role und/oder email. Felder werden unabhängig persistiert,
// je geänderter Spalte ein eigenes Audit-Event. Self-Demote bleibt blockiert.
adminRouter.patch("/users/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const targetId = req.params.id;
    const body = updateSchema.parse(req.body);

    if (targetId === req.user.id && body.role && body.role !== "admin") {
      throw errors.badRequest("Du kannst dich nicht selbst herabstufen");
    }

    // ─── Profile-Spalten (display_name, role) ──────────────────────
    const profilePatch: Record<string, unknown> = {};
    if (body.display_name !== undefined) profilePatch.display_name = body.display_name;
    if (body.role !== undefined) profilePatch.role = body.role;

    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabaseService
        .from("profiles")
        .update(profilePatch)
        .eq("id", targetId);
      if (error) throw errors.internal(`Profile update failed: ${error.message}`);
    }

    // ─── auth.users.email ──────────────────────────────────────────
    if (body.email !== undefined) {
      const { error } = await supabaseService.auth.admin.updateUserById(targetId, {
        email: body.email,
      });
      if (error) {
        if (error.status === 422 || error.code === "email_exists") {
          throw errors.conflict(`Email ${body.email} ist bereits in Verwendung`);
        }
        if (error.status === 404) throw errors.notFound("User nicht gefunden");
        throw errors.internal(`Email update failed: ${error.message}`);
      }
    }

    // ─── Aktualisiertes Profil + Email zurückgeben ─────────────────
    const { data: profile, error: readError } = await supabaseService
      .from("profiles")
      .select("id, display_name, avatar_url, role, created_at, updated_at")
      .eq("id", targetId)
      .maybeSingle();
    if (readError) throw errors.internal(`Read failed: ${readError.message}`);
    if (!profile) throw errors.notFound("Profil nicht gefunden");

    const { data: authData } = await supabaseService.auth.admin.getUserById(targetId);

    // Audit-Trail: ein Event pro geänderter Spalte für saubere Filterbarkeit.
    for (const field of ["display_name", "role", "email"] as const) {
      if (body[field] !== undefined) {
        await recordEvent({
          user_id: req.user.id,
          action: "update",
          resource_type: "profile",
          resource_id: targetId,
          metadata: { field, value: body[field] },
          ip: req.ip,
        });
      }
    }

    res.json({
      ...profile,
      email: authData?.user?.email ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────
// Hard-Delete via auth.admin.deleteUser. profiles-Cascade läuft via FK on delete cascade.
adminRouter.delete("/users/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const targetId = req.params.id;

    if (targetId === req.user.id) {
      throw errors.badRequest("Du kannst dich nicht selbst löschen");
    }

    const { error } = await supabaseService.auth.admin.deleteUser(targetId);
    if (error) {
      if (error.status === 404) throw errors.notFound("User nicht gefunden");
      throw errors.internal(`Delete failed: ${error.message}`);
    }

    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "user",
      resource_id: targetId,
      ip: req.ip,
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
