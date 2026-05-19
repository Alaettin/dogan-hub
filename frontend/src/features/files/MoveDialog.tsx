import { useEffect, useMemo, useState } from "react";
import { Folder as FolderIcon, HardDrive } from "lucide-react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { useFolders } from "./useFolders";
import { buildFolderTree, type FolderNode } from "./folder-tree";
import { cn } from "../../lib/cn";
import "./files.css";

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  currentParentId: string | null;
  // ID des Ordners, der bewegt wird — wird im Tree gefiltert (kein Self/Descendant-Target)
  excludeFolderId?: string;
  onConfirm: (targetFolderId: string | null) => Promise<void> | void;
}

export function MoveDialog({
  open,
  onOpenChange,
  title,
  description,
  currentParentId,
  excludeFolderId,
  onConfirm,
}: MoveDialogProps) {
  const folders = useFolders();
  const [target, setTarget] = useState<string | null>(currentParentId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTarget(currentParentId);
      setSaving(false);
    }
  }, [open, currentParentId]);

  const excludedIds = useMemo(() => {
    if (!excludeFolderId || !folders.data) return new Set<string>();
    const set = new Set<string>();
    set.add(excludeFolderId);
    // Alle Descendants ausschließen
    const tree = buildFolderTree(folders.data);
    function collect(node: FolderNode) {
      set.add(node.id);
      node.children.forEach(collect);
    }
    function findAndCollect(nodes: FolderNode[]) {
      for (const n of nodes) {
        if (n.id === excludeFolderId) {
          collect(n);
          return;
        }
        findAndCollect(n.children);
      }
    }
    findAndCollect(tree);
    return set;
  }, [excludeFolderId, folders.data]);

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm(target);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const tree = folders.data ? buildFolderTree(folders.data) : [];

  return (
    <GlassDialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="db-form">
        <div className="move-tree">
          <TreeOption
            icon={<HardDrive size={14} />}
            label="Root"
            active={target === null}
            onClick={() => setTarget(null)}
          />
          {tree.map((node) => (
            <FolderTreeOption
              key={node.id}
              node={node}
              level={1}
              selectedId={target}
              excludedIds={excludedIds}
              onSelect={setTarget}
            />
          ))}
        </div>
        <div className="db-form__actions">
          <GlassButton variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </GlassButton>
          <GlassButton variant="primary" onClick={handleConfirm} disabled={saving}>
            {saving ? "Verschiebe…" : "Verschieben"}
          </GlassButton>
        </div>
      </div>
    </GlassDialog>
  );
}

interface FolderTreeOptionProps {
  node: FolderNode;
  level: number;
  selectedId: string | null;
  excludedIds: Set<string>;
  onSelect: (id: string) => void;
}
function FolderTreeOption({
  node,
  level,
  selectedId,
  excludedIds,
  onSelect,
}: FolderTreeOptionProps) {
  const disabled = excludedIds.has(node.id);

  return (
    <>
      <button
        type="button"
        className={cn(
          "move-tree__option",
          selectedId === node.id && "move-tree__option--active",
        )}
        onClick={() => !disabled && onSelect(node.id)}
        disabled={disabled}
        style={{
          paddingLeft: 10 + level * 16,
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <FolderIcon size={14} />
        {node.name}
      </button>
      {node.children.map((child) => (
        <FolderTreeOption
          key={child.id}
          node={child}
          level={level + 1}
          selectedId={selectedId}
          excludedIds={excludedIds}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

interface TreeOptionProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}
function TreeOption({ icon, label, active, onClick }: TreeOptionProps) {
  return (
    <button
      type="button"
      className={cn("move-tree__option", active && "move-tree__option--active")}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
