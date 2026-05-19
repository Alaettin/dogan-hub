import { createHash } from "node:crypto";
import { supabaseService } from "../config/supabase.js";
import { logger } from "../lib/logger.js";

export type AuditAction = "create" | "update" | "delete" | "login" | "logout";

export interface AuditEntry {
  user_id: string;
  action: AuditAction;
  resource_type: string;
  resource_id?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}

const IP_HASH_SALT = process.env.AUDIT_IP_HASH_SALT ?? "dogan-hub-audit-salt-v1";

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(IP_HASH_SALT).update(ip).digest("hex").slice(0, 16);
}

// Schreibt einen audit_log-Eintrag mit Service-Role-Client (umgeht RLS-INSERT-Block).
// Failures werden geloggt aber nie geworfen — Audit darf den Request niemals brechen.
export async function recordEvent(entry: AuditEntry): Promise<void> {
  try {
    const { error } = await supabaseService.from("audit_log").insert({
      user_id: entry.user_id,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id ?? null,
      metadata: entry.metadata ?? null,
      ip_hash: hashIp(entry.ip),
    });
    if (error) {
      logger.warn({ err: error, entry }, "audit.recordEvent failed");
    }
  } catch (err) {
    logger.warn({ err, entry }, "audit.recordEvent threw");
  }
}
