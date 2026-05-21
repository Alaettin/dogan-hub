// Hilfsfunktionen für den Umgang mit PostgREST-Filtern (supabase-js .or()/.and()).

// Escapt einen Nutzerwert für die Verwendung INNERHALB eines in doppelte
// Anführungszeichen gesetzten PostgREST-Filterwerts, z.B.
//   .or(`title.ilike."%${escapeLikeValue(term)}%"`)
// Dadurch können Sonderzeichen (".", ",", "(", ")") den Filter weder zerbrechen
// noch zusätzliche Bedingungen einschleusen. Backslash und doppeltes
// Anführungszeichen müssen escaped werden; die Reihenfolge ist wichtig
// (erst Backslash, dann Quote).
export function escapeLikeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
