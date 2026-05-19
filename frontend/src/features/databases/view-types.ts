import type { FieldType } from "./fields/field-types";

export const VIEW_TYPES = ["table", "cards", "list"] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

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

export interface ViewConfig {
  view_type: ViewType;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  filters?: FilterCondition[];
  columns?: string[];
}

export const FILTER_OP_LABEL: Record<FilterOp, string> = {
  eq: "ist",
  neq: "ist nicht",
  contains: "enthält",
  gt: "größer als",
  gte: "größer / gleich",
  lt: "kleiner als",
  lte: "kleiner / gleich",
  is_empty: "ist leer",
  is_not_empty: "ist nicht leer",
};

export const FILTER_OPS_WITHOUT_VALUE = new Set<FilterOp>(["is_empty", "is_not_empty"]);

// Welche Operator sind für welchen Feld-Typ sinnvoll?
export function validOpsForFieldType(type: FieldType | "created_at"): FilterOp[] {
  switch (type) {
    case "boolean":
      return ["eq", "neq"];
    case "number":
    case "currency":
    case "rating":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"];
    case "date":
    case "datetime":
    case "created_at":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"];
    case "select":
      return ["eq", "neq", "is_empty", "is_not_empty"];
    case "multiselect":
      return ["contains", "is_empty", "is_not_empty"];
    case "text":
    case "longtext":
    case "url":
    case "email":
    case "phone":
    default:
      return ["eq", "neq", "contains", "is_empty", "is_not_empty"];
  }
}

// ─── URL-State-Codec ─────────────────────────────────────────────────

export function encodeViewToParams(config: ViewConfig): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set("view", config.view_type);
  if (config.sort) sp.set("sort", config.sort);
  if (config.order) sp.set("order", config.order);
  if (config.search && config.search.trim()) sp.set("search", config.search.trim());
  if (config.filters && config.filters.length > 0) {
    sp.set("filter", JSON.stringify(config.filters));
  }
  return sp;
}

export function decodeViewFromParams(sp: URLSearchParams): ViewConfig {
  const viewParam = sp.get("view");
  const view_type: ViewType = (VIEW_TYPES as readonly string[]).includes(viewParam ?? "")
    ? (viewParam as ViewType)
    : "table";

  const sort = sp.get("sort") ?? undefined;
  const orderRaw = sp.get("order");
  const order = orderRaw === "asc" || orderRaw === "desc" ? orderRaw : undefined;
  const search = sp.get("search") ?? undefined;

  let filters: FilterCondition[] | undefined;
  const filterRaw = sp.get("filter");
  if (filterRaw) {
    try {
      const parsed = JSON.parse(filterRaw);
      if (Array.isArray(parsed)) filters = parsed;
    } catch {
      // invalid filter param → ignore
    }
  }

  return { view_type, sort, order, search, filters };
}

// Vergleicht zwei View-Configs — für "ist aktive Saved View?"-Highlight
export function viewConfigsEqual(a: ViewConfig, b: ViewConfig): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

function normalize(c: ViewConfig): ViewConfig {
  return {
    view_type: c.view_type,
    sort: c.sort,
    order: c.sort ? c.order ?? "desc" : undefined,
    search: c.search && c.search.trim() ? c.search.trim() : undefined,
    filters: c.filters && c.filters.length > 0 ? c.filters : undefined,
    columns: c.columns && c.columns.length > 0 ? c.columns : undefined,
  };
}
