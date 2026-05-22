// Geld-Formatierung — global EUR, deutsche Lokalisierung.

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const eurCompact = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatEur(value: number | null | undefined): string {
  return eur.format(value ?? 0);
}

// Kompakt für Achsen/Charts (z.B. "1,2 Tsd. €").
export function formatEurCompact(value: number | null | undefined): string {
  return eurCompact.format(value ?? 0);
}
