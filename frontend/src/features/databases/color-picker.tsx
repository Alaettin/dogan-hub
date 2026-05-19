import { cn } from "../../lib/cn";

export interface ColorOption {
  key: string;
  label: string;
  swatch: string; // CSS color used for swatch + accent
  accent: string; // ring/border color
}

export const COLOR_OPTIONS: ColorOption[] = [
  { key: "indigo", label: "Indigo", swatch: "#818cf8", accent: "rgba(129, 140, 248, 0.45)" },
  { key: "cyan", label: "Cyan", swatch: "#22d3ee", accent: "rgba(34, 211, 238, 0.45)" },
  { key: "purple", label: "Purple", swatch: "#a855f7", accent: "rgba(168, 85, 247, 0.45)" },
  { key: "pink", label: "Pink", swatch: "#ec4899", accent: "rgba(236, 72, 153, 0.45)" },
  { key: "amber", label: "Amber", swatch: "#f59e0b", accent: "rgba(245, 158, 11, 0.45)" },
  { key: "emerald", label: "Emerald", swatch: "#10b981", accent: "rgba(16, 185, 129, 0.45)" },
  { key: "rose", label: "Rose", swatch: "#f43f5e", accent: "rgba(244, 63, 94, 0.45)" },
  { key: "slate", label: "Slate", swatch: "#94a3b8", accent: "rgba(148, 163, 184, 0.45)" },
];

const COLOR_MAP = new Map(COLOR_OPTIONS.map((c) => [c.key, c]));

export function getColorOption(key: string | null | undefined): ColorOption {
  if (!key) return COLOR_OPTIONS[0];
  return COLOR_MAP.get(key) ?? COLOR_OPTIONS[0];
}

interface ColorPickerProps {
  value?: string;
  onChange: (key: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="color-picker">
      {COLOR_OPTIONS.map((c) => (
        <button
          key={c.key}
          type="button"
          className={cn("color-picker__item", value === c.key && "color-picker__item--active")}
          onClick={() => onChange(c.key)}
          aria-label={c.label}
          aria-pressed={value === c.key}
          style={{
            background: c.swatch,
            ...(value === c.key ? { boxShadow: `0 0 0 3px ${c.accent}` } : {}),
          }}
        />
      ))}
    </div>
  );
}
