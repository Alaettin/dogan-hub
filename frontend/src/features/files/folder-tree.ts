import type { Folder } from "./useFolders";

export interface FolderNode extends Folder {
  children: FolderNode[];
}

export function buildFolderTree(flat: Folder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  for (const f of flat) byId.set(f.id, { ...f, children: [] });

  const roots: FolderNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Alphabetisch sortieren auf jeder Ebene
  function sortNodes(nodes: FolderNode[]) {
    nodes.sort((a, b) => a.name.localeCompare(b.name, "de"));
    for (const n of nodes) sortNodes(n.children);
  }
  sortNodes(roots);
  return roots;
}

// Pfad vom Root bis zum Ordner mit der gegebenen id — für Breadcrumbs.
export function getFolderPath(folderId: string | null, flat: Folder[]): Folder[] {
  if (!folderId) return [];
  const byId = new Map<string, Folder>(flat.map((f) => [f.id, f]));
  const trail: Folder[] = [];
  let cursor: string | null = folderId;
  while (cursor && byId.has(cursor)) {
    const node: Folder = byId.get(cursor)!;
    trail.unshift(node);
    cursor = node.parent_id;
  }
  return trail;
}
