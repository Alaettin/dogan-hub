import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

export const FILTER_OPS = [
  "eq",
  "neq",
  "contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "is_empty",
  "is_not_empty",
] as const;

export type FilterOp = (typeof FILTER_OPS)[number];

export interface FilterCondition {
  field: string;
  op: FilterOp;
  value?: unknown;
}

const ALLOWED_KEY = /^[a-z][a-z0-9_]*$/;

// Wendet eine FilterCondition auf einen Supabase-Query-Builder an.
// jsonb-Pfad: data->>field liest als text. Number/Date werden als ISO/string
// verglichen — für MVP akzeptabel.
export function applyFilter<T>(
  query: PostgrestFilterBuilder<any, any, any, any, T>,
  cond: FilterCondition,
): PostgrestFilterBuilder<any, any, any, any, T> {
  if (!ALLOWED_KEY.test(cond.field)) return query;
  const path = `data->>${cond.field}`;
  const v = cond.value;
  const s = v === undefined || v === null ? "" : String(v);

  switch (cond.op) {
    case "eq":
      return query.eq(path, s);
    case "neq":
      return query.neq(path, s);
    case "contains":
      // ilike escape: %_ raus aus user-input
      return query.ilike(path, `%${escapeIlikeValue(s)}%`);
    case "gt":
      return query.gt(path, s);
    case "gte":
      return query.gte(path, s);
    case "lt":
      return query.lt(path, s);
    case "lte":
      return query.lte(path, s);
    case "is_empty":
      return query.is(path, null);
    case "is_not_empty":
      return query.not(path, "is", null);
    default:
      return query;
  }
}

function escapeIlikeValue(v: string): string {
  return v.replace(/[%_]/g, "\\$&");
}
