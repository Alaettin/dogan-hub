import { useEffect, useState } from "react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import {
  useCreateListing,
  useUpdateListing,
  type Listing,
  type ListingStatus,
  type CreateListingInput,
} from "./useShopping";

interface ListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platformId: string;
  listing?: Listing | null;
}

const today = () => new Date().toISOString().slice(0, 10);
const numStr = (n: number | null | undefined) => (n == null ? "" : String(n));
const parseNum = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function ListingDialog({ open, onOpenChange, platformId, listing }: ListingDialogProps) {
  const isEdit = !!listing;
  const create = useCreateListing(platformId);
  const update = useUpdateListing();

  const [f, setF] = useState({
    title: "",
    price: "",
    quantity: "1",
    purchase_price: "",
    fees: "",
    condition: "",
    category: "",
    item_url: "",
    image_url: "",
    listed_at: today(),
    status: "active" as ListingStatus,
    sold_at: today(),
    sold_price: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setF({
      title: listing?.title ?? "",
      price: numStr(listing?.price),
      quantity: String(listing?.quantity ?? 1),
      purchase_price: numStr(listing?.purchase_price),
      fees: numStr(listing?.fees),
      condition: listing?.condition ?? "",
      category: listing?.category ?? "",
      item_url: listing?.item_url ?? "",
      image_url: listing?.image_url ?? "",
      listed_at: listing?.listed_at ?? today(),
      status: listing?.status ?? "active",
      sold_at: listing?.sold_at ?? today(),
      sold_price: numStr(listing?.sold_price),
      notes: listing?.notes ?? "",
    });
  }, [open, listing]);

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const pending = create.isPending || update.isPending;

  async function submit() {
    setError(null);
    const price = parseNum(f.price);
    if (!f.title.trim()) return setError("Bitte einen Titel angeben.");
    if (price == null || price < 0) return setError("Bitte einen gültigen Preis angeben.");

    const payload: CreateListingInput = {
      title: f.title.trim(),
      price,
      quantity: Math.max(1, Number(f.quantity) || 1),
      purchase_price: parseNum(f.purchase_price),
      fees: parseNum(f.fees),
      condition: f.condition.trim() || null,
      category: f.category.trim() || null,
      item_url: f.item_url.trim() || null,
      image_url: f.image_url.trim() || null,
      notes: f.notes.trim() || null,
      status: f.status,
      listed_at: f.listed_at,
      sold_at: f.status === "sold" ? f.sold_at : null,
      sold_price: f.status === "sold" ? parseNum(f.sold_price) ?? price : null,
    };

    try {
      if (isEdit) await update.mutateAsync({ id: listing!.id, ...payload });
      else await create.mutateAsync(payload);
      onOpenChange(false);
    } catch {
      setError("Speichern fehlgeschlagen.");
    }
  }

  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Inserat bearbeiten" : "Neues Inserat"}
      className="shop-listing-dialog"
    >
      <div className="db-form">
        <GlassInput label="Titel" value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus placeholder="z.B. Charizard Holo 1st Ed." />

        <div className="shop-form-grid">
          <GlassInput label="Preis (€)" type="number" min={0} step="0.01" value={f.price} onChange={(e) => set("price", e.target.value)} />
          <GlassInput label="Menge" type="number" min={1} value={f.quantity} onChange={(e) => set("quantity", e.target.value)} />
          <GlassInput label="Einkaufspreis (€)" type="number" min={0} step="0.01" value={f.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} />
          <GlassInput label="Gebühren (€)" type="number" min={0} step="0.01" value={f.fees} onChange={(e) => set("fees", e.target.value)} />
          <GlassInput label="Zustand" value={f.condition} onChange={(e) => set("condition", e.target.value)} placeholder="z.B. Near Mint" />
          <GlassInput label="Kategorie" value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="z.B. Pokémon" />
        </div>

        <GlassInput label="Link zum Inserat (optional)" value={f.item_url} onChange={(e) => set("item_url", e.target.value)} placeholder="https://…" />
        <GlassInput label="Bild-URL (optional)" value={f.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://…/bild.jpg" />

        <div className="shop-form-grid">
          <div>
            <label className="glass-label">Status</label>
            <select className="glass-input" value={f.status} onChange={(e) => set("status", e.target.value)}>
              <option value="active">Aktiv</option>
              <option value="sold">Verkauft</option>
              <option value="cancelled">Entfernt</option>
            </select>
          </div>
          <GlassInput label="Eingestellt am" type="date" value={f.listed_at} onChange={(e) => set("listed_at", e.target.value)} />
          {f.status === "sold" && (
            <>
              <GlassInput label="Verkauft am" type="date" value={f.sold_at} onChange={(e) => set("sold_at", e.target.value)} />
              <GlassInput label="Verkaufspreis (€)" type="number" min={0} step="0.01" value={f.sold_price} onChange={(e) => set("sold_price", e.target.value)} placeholder={f.price} />
            </>
          )}
        </div>

        <GlassInput label="Notizen (optional)" value={f.notes} onChange={(e) => set("notes", e.target.value)} />

        {error && <p className="glass-field-error">{error}</p>}

        <div className="db-form__actions">
          <GlassButton variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Abbrechen
          </GlassButton>
          <GlassButton variant="primary" onClick={() => void submit()} disabled={pending}>
            {isEdit ? "Speichern" : "Anlegen"}
          </GlassButton>
        </div>
      </div>
    </GlassDialog>
  );
}
