import { useEffect, useState } from "react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { useSellListing, type Listing } from "./useShopping";

interface SellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: Listing | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export function SellDialog({ open, onOpenChange, listing }: SellDialogProps) {
  const sell = useSellListing();
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(today());

  useEffect(() => {
    if (open && listing) {
      setPrice(String(listing.price));
      setDate(today());
    }
  }, [open, listing]);

  async function submit() {
    if (!listing) return;
    const sold_price = Number(price.replace(",", "."));
    if (!Number.isFinite(sold_price) || sold_price < 0) return;
    await sell.mutateAsync({ id: listing.id, sold_price, sold_at: date });
    onOpenChange(false);
  }

  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Als verkauft markieren"
      description={listing?.title}
    >
      <div className="db-form">
        <div className="shop-form-grid">
          <GlassInput
            label="Verkaufspreis (€)"
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            autoFocus
          />
          <GlassInput
            label="Verkauft am"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="db-form__actions">
          <GlassButton variant="ghost" onClick={() => onOpenChange(false)} disabled={sell.isPending}>
            Abbrechen
          </GlassButton>
          <GlassButton variant="primary" onClick={() => void submit()} disabled={sell.isPending}>
            Verkauft
          </GlassButton>
        </div>
      </div>
    </GlassDialog>
  );
}
