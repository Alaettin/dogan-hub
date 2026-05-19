import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient } from "../config/supabase.js";
import { errors } from "../lib/errors.js";

export const authRouter = Router();

// GET /api/me — aktueller User + Profile
authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();

    const client = getUserScopedClient(req.user.accessToken);
    const { data: profile, error } = await client
      .from("profiles")
      .select("id, display_name, avatar_url, role, created_at, updated_at")
      .eq("id", req.user.id)
      .single();

    if (error || !profile) {
      throw errors.notFound("Profile not found");
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
      },
      profile,
    });
  } catch (err) {
    next(err);
  }
});
