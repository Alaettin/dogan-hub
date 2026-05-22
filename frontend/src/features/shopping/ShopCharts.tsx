import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { formatEur, formatEurCompact } from "../../lib/money";
import { getColorOption } from "../databases/color-picker";
import type { GlobalStats, MonthPoint } from "./useShopping";

const REVENUE_COLOR = "#10b981";
const PROFIT_COLOR = "#818cf8";
const STATUS_COLORS: Record<string, string> = {
  Aktiv: "#38bdf8",
  Verkauft: "#10b981",
  Entfernt: "#94a3b8",
};

const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function monthLabel(m: string): string {
  const idx = Number(m.slice(5, 7)) - 1;
  return MONTHS_SHORT[idx] ?? m;
}

const tooltipStyle = {
  background: "rgba(20, 16, 38, 0.95)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  fontSize: 12,
  color: "#fff",
};

export function RevenueChart({ data }: { data: MonthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={REVENUE_COLOR} stopOpacity={0.4} />
            <stop offset="100%" stopColor={REVENUE_COLOR} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="prof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PROFIT_COLOR} stopOpacity={0.35} />
            <stop offset="100%" stopColor={PROFIT_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={monthLabel}
          tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatEurCompact(v)}
          tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(m) => monthLabel(String(m))}
          formatter={(v: number, name) => [formatEur(v), name === "revenue" ? "Umsatz" : "Gewinn"]}
        />
        <Area type="monotone" dataKey="revenue" stroke={REVENUE_COLOR} strokeWidth={2} fill="url(#rev)" />
        <Area type="monotone" dataKey="profit" stroke={PROFIT_COLOR} strokeWidth={2} fill="url(#prof)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StatusDonut({
  active,
  sold,
  cancelled,
}: {
  active: number;
  sold: number;
  cancelled: number;
}) {
  const data = [
    { name: "Aktiv", value: active },
    { name: "Verkauft", value: sold },
    { name: "Entfernt", value: cancelled },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <div className="shop-chart__empty">Noch keine Daten.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.name} fill={STATUS_COLORS[d.name]} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => [v, n]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RevenueByPlatform({ data }: { data: GlobalStats["by_platform"] }) {
  const rows = data.filter((d) => d.revenue > 0).map((d) => ({
    name: d.name,
    revenue: d.revenue,
    fill: getColorOption(d.color).swatch,
  }));
  if (rows.length === 0) return <div className="shop-chart__empty">Noch keine Verkäufe.</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => formatEurCompact(v)} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v: number) => [formatEur(v), "Umsatz"]} />
        <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
          {rows.map((r) => (
            <Cell key={r.name} fill={r.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
