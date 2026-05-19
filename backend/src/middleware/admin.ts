import type { NextFunction, Request, Response } from "express";
import { supabaseService } from "../config/supabase.js";
import { errors } from "../lib/errors.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      isAdmin?: boolean;
    }
  }
}

// Muss NACH requireAuth eingesetzt werden — nutzt req.user.id.
// Prüft profile.role per Service-Role-Client (kein RLS-Bypass, einfacher Read).
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw errors.unauthorized();

    const { data: profile, error } = await supabaseService
      .from("profiles")
      .select("role")
      .eq("id", req.user.id)
      .maybeSingle();

    if (error) throw errors.internal("Failed to verify admin role");
    if (!profile || profile.role !== "admin") {
      throw errors.forbidden("Admin role required");
    }

    req.isAdmin = true;
    next();
  } catch (err) {
    next(err);
  }
}
