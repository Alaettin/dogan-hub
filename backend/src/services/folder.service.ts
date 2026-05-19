import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Markiert alle Dateien im Sub-Tree eines Folders als gelöscht (Soft-Delete).
 * Verwendet folders.path-Prefix-Match: alle Folders im Subtree haben einen
 * path, der entweder identisch oder ein Präfix des Root-Folders ist.
 *
 * Folder-Cascade-Delete erfolgt anschliessend separat — der Caller entscheidet
 * (user-scoped oder service-role).
 */
export async function softDeleteFolderTreeFiles(
  client: SupabaseClient,
  rootFolder: { id: string; path: string },
): Promise<{ softDeletedFileCount: number }> {
  // 1. Alle Folders im Subtree finden (incl. Root). Filter clientseitig,
  //    weil supabase-js' .like() unsere path-Werte mit Sonderzeichen nicht
  //    zuverlässig escapt.
  const { data: allFolders, error: folderErr } = await client
    .from("folders")
    .select("id, path");
  if (folderErr) throw new Error(`Subtree query failed: ${folderErr.message}`);

  const subtreeIds = (allFolders ?? [])
    .filter(
      (f: { id: string; path: string }) =>
        f.path === rootFolder.path || f.path.startsWith(`${rootFolder.path}/`),
    )
    .map((f) => f.id);

  if (subtreeIds.length === 0) return { softDeletedFileCount: 0 };

  // 2. Files im Subtree soft-deleten. Setzt folder_id = null wie der
  //    Einzelfile-Delete-Pfad — damit Restore in einen intakten Zustand
  //    zurückkehrt (statt in einen gelöschten Folder).
  const { count, error: updateErr } = await client
    .from("files")
    .update(
      { deleted_at: new Date().toISOString(), folder_id: null },
      { count: "exact" },
    )
    .in("folder_id", subtreeIds)
    .is("deleted_at", null);
  if (updateErr) throw new Error(`Soft-delete failed: ${updateErr.message}`);

  return { softDeletedFileCount: count ?? 0 };
}
