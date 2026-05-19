import {
  Book,
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  Car,
  CircleDollarSign,
  Clipboard,
  Database,
  FileText,
  Folder,
  Gift,
  Globe,
  Hammer,
  HardDrive,
  Heart,
  Home,
  Image,
  Key,
  Laptop,
  Lightbulb,
  ListChecks,
  Map as MapIcon,
  Monitor,
  Music,
  Package,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  TreePine,
  Trophy,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export const ICON_OPTIONS: Array<{ key: string; Icon: LucideIcon }> = [
  { key: "book", Icon: Book },
  { key: "book-open", Icon: BookOpen },
  { key: "briefcase", Icon: Briefcase },
  { key: "calendar", Icon: Calendar },
  { key: "camera", Icon: Camera },
  { key: "car", Icon: Car },
  { key: "circle-dollar-sign", Icon: CircleDollarSign },
  { key: "clipboard", Icon: Clipboard },
  { key: "database", Icon: Database },
  { key: "file-text", Icon: FileText },
  { key: "folder", Icon: Folder },
  { key: "gift", Icon: Gift },
  { key: "globe", Icon: Globe },
  { key: "hammer", Icon: Hammer },
  { key: "hard-drive", Icon: HardDrive },
  { key: "heart", Icon: Heart },
  { key: "home", Icon: Home },
  { key: "image", Icon: Image },
  { key: "key", Icon: Key },
  { key: "laptop", Icon: Laptop },
  { key: "lightbulb", Icon: Lightbulb },
  { key: "list-checks", Icon: ListChecks },
  { key: "map", Icon: MapIcon },
  { key: "monitor", Icon: Monitor },
  { key: "music", Icon: Music },
  { key: "package", Icon: Package },
  { key: "piggy-bank", Icon: PiggyBank },
  { key: "plane", Icon: Plane },
  { key: "receipt", Icon: Receipt },
  { key: "repeat", Icon: Repeat },
  { key: "shopping-bag", Icon: ShoppingBag },
  { key: "sparkles", Icon: Sparkles },
  { key: "star", Icon: Star },
  { key: "target", Icon: Target },
  { key: "tree-pine", Icon: TreePine },
  { key: "trophy", Icon: Trophy },
  { key: "wrench", Icon: Wrench },
];

const ICON_MAP = new Map<string, LucideIcon>(ICON_OPTIONS.map((o) => [o.key, o.Icon]));

export function getIconComponent(key: string | null | undefined): LucideIcon {
  if (!key) return Database;
  return ICON_MAP.get(key) ?? Database;
}

interface IconPickerProps {
  value?: string;
  onChange: (key: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="icon-picker">
      {ICON_OPTIONS.map(({ key, Icon }) => (
        <button
          key={key}
          type="button"
          className={cn("icon-picker__item", value === key && "icon-picker__item--active")}
          onClick={() => onChange(key)}
          aria-label={key}
          aria-pressed={value === key}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
