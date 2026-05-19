import type { FieldDefinition } from "../schemas/database.schema.js";

export interface DatabaseTemplate {
  key: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  schema: FieldDefinition[];
}

const tpl = (
  key: string,
  name: string,
  icon: string,
  color: string,
  description: string,
  fields: Array<Omit<FieldDefinition, "id" | "position"> & { id?: string }>,
): DatabaseTemplate => ({
  key,
  name,
  icon,
  color,
  description,
  schema: fields.map((f, idx) => ({
    id: f.id ?? `f${idx + 1}`,
    position: idx,
    visible_in_table: idx < 4,
    ...f,
  })),
});

export const DATABASE_TEMPLATES: DatabaseTemplate[] = [
  tpl("cars", "Autos", "car", "indigo", "Fahrzeuge mit TÜV, Versicherung und Wartung", [
    { key: "marke", label: "Marke", type: "text", required: true },
    { key: "modell", label: "Modell", type: "text", required: true },
    { key: "baujahr", label: "Baujahr", type: "number" },
    { key: "kennzeichen", label: "Kennzeichen", type: "text" },
    { key: "tuev", label: "TÜV bis", type: "date" },
    { key: "versicherung_bis", label: "Versicherung bis", type: "date" },
    { key: "notizen", label: "Notizen", type: "longtext" },
  ]),
  tpl("contracts", "Verträge", "file-text", "cyan", "Verträge mit Laufzeit und Kündigungsfrist", [
    { key: "titel", label: "Titel", type: "text", required: true },
    { key: "anbieter", label: "Anbieter", type: "text" },
    {
      key: "kategorie",
      label: "Kategorie",
      type: "select",
      options: [
        { value: "energie", label: "Energie" },
        { value: "internet", label: "Internet & Mobilfunk" },
        { value: "versicherung", label: "Versicherung" },
        { value: "miete", label: "Miete" },
        { value: "sonstiges", label: "Sonstiges" },
      ],
    },
    { key: "start", label: "Start", type: "date" },
    { key: "ende", label: "Ende", type: "date" },
    { key: "kosten", label: "Kosten", type: "currency" },
    { key: "kuendigungsfrist", label: "Kündigungsfrist", type: "text" },
    { key: "notizen", label: "Notizen", type: "longtext" },
  ]),
  tpl("books", "Bücher", "book", "purple", "Bücher-Sammlung mit Bewertung", [
    { key: "titel", label: "Titel", type: "text", required: true },
    { key: "autor", label: "Autor", type: "text" },
    { key: "isbn", label: "ISBN", type: "text" },
    { key: "gelesen", label: "Gelesen", type: "boolean" },
    { key: "bewertung", label: "Bewertung", type: "rating" },
    { key: "notizen", label: "Notizen", type: "longtext" },
  ]),
  tpl("receipts", "Belege", "receipt", "amber", "Quittungen und Belege für die Buchhaltung", [
    { key: "bezeichnung", label: "Bezeichnung", type: "text", required: true },
    { key: "betrag", label: "Betrag", type: "currency", required: true },
    { key: "datum", label: "Datum", type: "date", required: true },
    {
      key: "kategorie",
      label: "Kategorie",
      type: "select",
      options: [
        { value: "lebensmittel", label: "Lebensmittel" },
        { value: "tanken", label: "Tanken" },
        { value: "buero", label: "Büro" },
        { value: "reise", label: "Reise" },
        { value: "sonstiges", label: "Sonstiges" },
      ],
    },
    { key: "erstattbar", label: "Erstattbar", type: "boolean" },
  ]),
  tpl("subscriptions", "Abos", "repeat", "pink", "Wiederkehrende Zahlungen", [
    { key: "dienst", label: "Dienst", type: "text", required: true },
    { key: "kosten", label: "Kosten pro Periode", type: "currency", required: true },
    {
      key: "intervall",
      label: "Intervall",
      type: "select",
      options: [
        { value: "monatlich", label: "Monatlich" },
        { value: "vierteljaehrlich", label: "Vierteljährlich" },
        { value: "jaehrlich", label: "Jährlich" },
      ],
    },
    { key: "naechste_zahlung", label: "Nächste Zahlung", type: "date" },
    { key: "kuendbar_bis", label: "Kündbar bis", type: "date" },
    { key: "notizen", label: "Notizen", type: "longtext" },
  ]),
  tpl(
    "passwords",
    "Konten",
    "key",
    "slate",
    "Account-Referenzen (KEINE Passwort-Speicherung — nutze einen echten Manager)",
    [
      { key: "dienst", label: "Dienst", type: "text", required: true },
      { key: "benutzername", label: "Benutzername", type: "text" },
      { key: "url", label: "URL", type: "url" },
      { key: "notizen", label: "Notizen", type: "longtext" },
    ],
  ),
  tpl("devices", "Geräte & Garantien", "monitor", "emerald", "Geräte mit Kaufdatum und Garantie", [
    { key: "bezeichnung", label: "Bezeichnung", type: "text", required: true },
    { key: "hersteller", label: "Hersteller", type: "text" },
    { key: "modell", label: "Modell", type: "text" },
    { key: "kaufdatum", label: "Kaufdatum", type: "date" },
    { key: "garantie_bis", label: "Garantie bis", type: "date" },
    { key: "seriennummer", label: "Seriennummer", type: "text" },
    { key: "kaufpreis", label: "Kaufpreis", type: "currency" },
  ]),
];

export function findTemplate(key: string): DatabaseTemplate | undefined {
  return DATABASE_TEMPLATES.find((t) => t.key === key);
}
