import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Tag,
} from "lucide-react";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Dropdown, DropdownItem } from "../../components/ui/Dropdown";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { cn } from "../../lib/cn";
import { formatEur } from "../../lib/money";
import { getColorOption } from "../databases/color-picker";
import {
  usePlatform,
  usePlatformStats,
  useListings,
  useDeletePlatform,
  useDeleteListing,
  type Listing,
  type ListingStatus,
} from "./useShopping";
import { StatsBlock, StatusBadge } from "./StatsBlock";
import { ProxiedImg } from "./ProxiedImg";
import { PlatformDialog } from "./PlatformDialog";
import { ListingDialog } from "./ListingDialog";
import { SellDialog } from "./SellDialog";
import "./shopping.css";

const FILTERS: { v: ListingStatus | ""; label: string }[] = [
  { v: "", label: "Alle" },
  { v: "active", label: "Aktiv" },
  { v: "sold", label: "Verkauft" },
  { v: "cancelled", label: "Entfernt" },
];

const dateFmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
function fmtDate(d: string | null): string {
  return d ? dateFmt.format(new Date(d)) : "—";
}

export function ShoppingPlatformDetailPage() {
  const { platformId } = useParams<{ platformId: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const platform = usePlatform(platformId);
  const stats = usePlatformStats(platformId);
  const [filter, setFilter] = useState<ListingStatus | "">("");
  const listings = useListings(platformId, filter);

  const deletePlatform = useDeletePlatform();
  const deleteListing = useDeleteListing();

  const [editPlatform, setEditPlatform] = useState(false);
  const [listingDialog, setListingDialog] = useState<{ open: boolean; listing: Listing | null }>({
    open: false,
    listing: null,
  });
  const [sell, setSell] = useState<{ open: boolean; listing: Listing | null }>({
    open: false,
    listing: null,
  });

  if (!platformId) return null;
  const color = getColorOption(platform.data?.color);
  const items = listings.data ?? [];

  async function onDeletePlatform() {
    const ok = await confirm({
      title: "Plattform löschen?",
      description: `„${platform.data?.name}" und alle zugehörigen Inserate werden unwiderruflich gelöscht.`,
      destructive: true,
    });
    if (!ok) return;
    await deletePlatform.mutateAsync(platformId!);
    navigate("/shopping");
  }

  async function onDeleteListing(l: Listing) {
    const ok = await confirm({
      title: "Inserat löschen?",
      description: `„${l.title}" wird gelöscht.`,
      destructive: true,
    });
    if (ok) await deleteListing.mutateAsync(l.id);
  }

  return (
    <div className="shop-page">
      <Link to="/shopping" className="shop-back">
        <ArrowLeft size={14} /> Alle Plattformen
      </Link>

      <header className="shop-header">
        <div className="shop-detail-title">
          <span className="shop-detail-dot" style={{ background: color.swatch }} />
          <div>
            <h1 className="shop-header__title">{platform.data?.name ?? "…"}</h1>
            {platform.data?.url && (
              <a className="shop-header__link" href={platform.data.url} target="_blank" rel="noreferrer">
                {platform.data.url.replace(/^https?:\/\//, "")} <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
        <div className="shop-header__actions">
          <GlassButton variant="primary" onClick={() => setListingDialog({ open: true, listing: null })}>
            <Plus size={14} /> Neues Inserat
          </GlassButton>
          <Dropdown
            align="end"
            trigger={
              <button className="shop-icon-btn" aria-label="Plattform-Optionen">
                <MoreHorizontal size={16} />
              </button>
            }
          >
            <DropdownItem icon={<Pencil size={12} />} label="Bearbeiten" onClick={() => setEditPlatform(true)} />
            <DropdownItem icon={<Trash2 size={12} />} label="Löschen" danger onClick={onDeletePlatform} />
          </Dropdown>
        </div>
      </header>

      {stats.data && <StatsBlock stats={stats.data} />}

      <section>
        <div className="shop-list-toolbar">
          <div className="shop-filter">
            {FILTERS.map((ff) => (
              <button
                key={ff.v}
                className={cn("shop-filter__btn", filter === ff.v && "shop-filter__btn--active")}
                onClick={() => setFilter(ff.v)}
              >
                {ff.label}
              </button>
            ))}
          </div>
        </div>

        <GlassPanel className="shop-table-wrap">
          {listings.isLoading ? (
            <div className="shop-muted shop-table-empty">Lade…</div>
          ) : items.length === 0 ? (
            <div className="shop-table-empty">
              <Tag size={22} />
              <p>Keine Inserate{filter ? " mit diesem Status" : ""}.</p>
            </div>
          ) : (
            <table className="shop-table">
              <thead>
                <tr>
                  <th />
                  <th>Titel</th>
                  <th>Status</th>
                  <th className="shop-num">Preis</th>
                  <th className="shop-num">Menge</th>
                  <th>Eingestellt</th>
                  <th>Verkauft</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id}>
                    <td className="shop-thumb-cell">
                      <ProxiedImg url={l.image_url} className="shop-thumb" />
                    </td>
                    <td>
                      <div className="shop-cell-title">
                        <span className="shop-cell-title__name">{l.title}</span>
                        {(l.category || l.condition) && (
                          <span className="shop-cell-title__meta">
                            {[l.category, l.condition].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td><StatusBadge status={l.status} /></td>
                    <td className="shop-num">
                      {l.status === "sold" ? (
                        <span className="shop-sold-price">{formatEur(l.sold_price)}</span>
                      ) : (
                        formatEur(l.price)
                      )}
                    </td>
                    <td className="shop-num">{l.quantity}</td>
                    <td>{fmtDate(l.listed_at)}</td>
                    <td>{fmtDate(l.sold_at)}</td>
                    <td className="shop-row-actions" onClick={(e) => e.stopPropagation()}>
                      {l.item_url && (
                        <a className="shop-icon-btn shop-icon-btn--sm" href={l.item_url} target="_blank" rel="noreferrer" title="Original öffnen">
                          <ExternalLink size={14} />
                        </a>
                      )}
                      {l.status !== "sold" && (
                        <button className="shop-icon-btn shop-icon-btn--sm" title="Als verkauft markieren" onClick={() => setSell({ open: true, listing: l })}>
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                      <Dropdown
                        align="end"
                        trigger={
                          <button className="shop-icon-btn shop-icon-btn--sm" aria-label="Optionen">
                            <MoreHorizontal size={14} />
                          </button>
                        }
                      >
                        <DropdownItem icon={<Pencil size={12} />} label="Bearbeiten" onClick={() => setListingDialog({ open: true, listing: l })} />
                        <DropdownItem icon={<Trash2 size={12} />} label="Löschen" danger onClick={() => onDeleteListing(l)} />
                      </Dropdown>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassPanel>
      </section>

      {platform.data && (
        <PlatformDialog open={editPlatform} onOpenChange={setEditPlatform} platform={platform.data} />
      )}
      <ListingDialog
        open={listingDialog.open}
        onOpenChange={(o) => setListingDialog((s) => ({ ...s, open: o }))}
        platformId={platformId}
        listing={listingDialog.listing}
      />
      <SellDialog
        open={sell.open}
        onOpenChange={(o) => setSell((s) => ({ ...s, open: o }))}
        listing={sell.listing}
      />
    </div>
  );
}
