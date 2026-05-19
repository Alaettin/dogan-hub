import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import "./views.css";

interface SearchInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Suchen…",
  debounceMs = 300,
}: SearchInputProps) {
  const [draft, setDraft] = useState(value);
  const lastEmitted = useRef(value);

  // Sync external value → draft, falls außerhalb geändert (z.B. Saved-View-Wechsel)
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setDraft(value);
      lastEmitted.current = value;
    }
  }, [value]);

  // Debounced upward propagation
  useEffect(() => {
    if (draft === lastEmitted.current) return;
    const handle = setTimeout(() => {
      lastEmitted.current = draft;
      onChange(draft);
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [draft, debounceMs, onChange]);

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", width: 240 }}>
      <Search
        size={14}
        style={{
          position: "absolute",
          left: 10,
          color: "var(--text-muted)",
          pointerEvents: "none",
        }}
      />
      <input
        type="search"
        className="glass-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        style={{ paddingLeft: 32, paddingRight: draft ? 32 : 12 }}
      />
      {draft && (
        <button
          type="button"
          onClick={() => setDraft("")}
          aria-label="Suche löschen"
          style={{
            position: "absolute",
            right: 8,
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: 2,
            display: "inline-flex",
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
