import rateLimit from "express-rate-limit";
import type { Request } from "express";

// Allgemeines Rate-Limit für API-Aufrufe.
// Anonyme: 30 req/min/IP, Authentifizierte: 200 req/min/user (PLAN §4 Rate-Limiting).
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  limit: (req: Request) => (req.user ? 200 : 30),
  keyGenerator: (req: Request) => (req.user ? `user:${req.user.id}` : `ip:${req.ip ?? "anon"}`),
  message: { error: { code: "rate_limited", message: "Too many requests" } },
});
