import type { NextFunction, Request, Response } from "express";
import { supabaseService } from "../config/supabase.js";
import { errors } from "../lib/errors.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  accessToken: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.header("authorization");
    if (!header?.toLowerCase().startsWith("bearer ")) {
      throw errors.unauthorized("Missing bearer token");
    }
    const token = header.slice("bearer ".length).trim();
    if (!token) throw errors.unauthorized("Empty bearer token");

    const { data, error } = await supabaseService.auth.getUser(token);
    if (error || !data?.user) {
      throw errors.unauthorized("Invalid or expired token");
    }
    if (!data.user.email) {
      throw errors.unauthorized("User has no email");
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
      accessToken: token,
    };
    next();
  } catch (err) {
    next(err);
  }
}
