import type { LucideIcon } from "lucide-react";
import { FileText, ListChecks, List } from "lucide-react";
import type { NoteType } from "./useNotes";

// Zentrale Typ-Metadaten (Label + Icon + Akzentfarbe) — von Übersicht,
// Create-Dialog, Detail-Header und Dashboard-Widget gemeinsam genutzt.
export const NOTE_TYPE_META: Record<NoteType, { label: string; icon: LucideIcon; color: string }> = {
  text: { label: "Text", icon: FileText, color: "#818cf8" },
  checklist: { label: "Checkliste", icon: ListChecks, color: "#10b981" },
  list: { label: "Liste", icon: List, color: "#f59e0b" },
};
