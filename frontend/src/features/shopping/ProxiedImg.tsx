import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { supabase } from "../../lib/supabase";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

// Lädt ein (oft hotlink-geschütztes) externes Bild über den Backend-Proxy
// und zeigt es als Blob. Fällt bei Fehler/leer auf einen Platzhalter zurück.
export function ProxiedImg({ url, className }: { url: string | null; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(null);
    setFailed(false);
    if (!url) return;

    let active = true;
    let objUrl: string | undefined;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const res = await fetch(`${API_BASE}/shop/image-proxy?url=${encodeURIComponent(url)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("proxy failed");
        const blob = await res.blob();
        if (!active) return;
        objUrl = URL.createObjectURL(blob);
        setSrc(objUrl);
      } catch {
        if (active) setFailed(true);
      }
    })();

    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [url]);

  if (!url || failed || !src) {
    return (
      <span className={`${className ?? ""} shop-thumb--ph`.trim()}>
        <Tag size={14} />
      </span>
    );
  }
  return <img className={className} src={src} alt="" loading="lazy" />;
}
