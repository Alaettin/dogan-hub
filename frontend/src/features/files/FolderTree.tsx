import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
  FolderInput,
} from "lucide-react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { Dropdown, DropdownItem } from "../../components/ui/Dropdown";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { useDeleteFolder, useUpdateFolder, type Folder } from "./useFolders";
import { buildFolderTree, type FolderNode } from "./folder-tree";
import { MoveDialog } from "./MoveDialog";
import { ShareFolderDialog } from "./ShareFolderDialog";
import { cn } from "../../lib/cn";
import "./files.css";

interface FolderTreeProps {
  folders: Folder[];
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}

export function FolderTree({ folders, currentFolderId, onNavigate }: FolderTreeProps) {
  const tree = buildFolderTree(folders);

  return (
    <div className="folder-tree">
      <div className="folder-tree__header">
        <span className="folder-tree__title">Ordner</span>
      </div>
      {tree.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px" }}>
          Noch keine Ordner.
        </p>
      ) : (
        tree.map((node) => (
          <FolderNodeRow
            key={node.id}
            node={node}
            level={0}
            currentFolderId={currentFolderId}
            onNavigate={onNavigate}
          />
        ))
      )}
    </div>
  );
}

interface FolderNodeRowProps {
  node: FolderNode;
  level: number;
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}

function FolderNodeRow({ node, level, currentFolderId, onNavigate }: FolderNodeRowProps) {
  const [expanded, setExpanded] = useState(true);
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const confirm = useConfirm();

  const update = useUpdateFolder(node.id);
  const remove = useDeleteFolder(node.id);

  const active = currentFolderId === node.id;
  const hasChildren = node.children.length > 0;

  useEffect(() => setRenameValue(node.name), [node.name]);

  return (
    <div className="folder-node">
      <div className={cn("folder-node__row", active && "folder-node__row--active")}>
        {hasChildren ? (
          <button
            type="button"
            className="folder-node__chevron"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-label={expanded ? "Einklappen" : "Ausklappen"}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="folder-node__chevron folder-node__chevron--spacer" />
        )}
        <button
          type="button"
          className="folder-node__main"
          onClick={() => onNavigate(node.id)}
        >
          <FolderIcon size={14} style={{ color: "var(--text-accent)", flexShrink: 0 }} />
          <span className="folder-node__name">{node.name}</span>
        </button>
        <Dropdown
          align="end"
          trigger={
            <button
              type="button"
              className="folder-node__menu"
              aria-label="Ordner-Optionen"
            >
              <MoreHorizontal size={14} />
            </button>
          }
        >
          <DropdownItem
            icon={<Pencil size={12} />}
            label="Umbenennen"
            onClick={() => setRenameOpen(true)}
          />
          <DropdownItem
            icon={<FolderInput size={12} />}
            label="Verschieben"
            onClick={() => setMoveOpen(true)}
          />
          <DropdownItem
            icon={<Share2 size={12} />}
            label="Freigeben"
            onClick={() => setShareOpen(true)}
          />
          <DropdownItem
            icon={<Trash2 size={12} />}
            label="Löschen"
            danger
            onClick={async () => {
              const ok = await confirm({
                title: "Ordner löschen?",
                description: `"${node.name}" mit allen Unterordnern und Dateien wird unwiderruflich gelöscht.`,
                confirmLabel: "Löschen",
                destructive: true,
              });
              if (ok) await remove.mutateAsync();
            }}
          />
        </Dropdown>
      </div>

      {hasChildren && expanded && (
        <div className="folder-node__children">
          {node.children.map((child) => (
            <FolderNodeRow
              key={child.id}
              node={child}
              level={level + 1}
              currentFolderId={currentFolderId}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}

      <GlassDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Ordner umbenennen"
      >
        <div className="db-form">
          <GlassInput
            label="Neuer Name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
          />
          <div className="db-form__actions">
            <GlassButton variant="ghost" onClick={() => setRenameOpen(false)}>
              Abbrechen
            </GlassButton>
            <GlassButton
              variant="primary"
              disabled={!renameValue.trim() || update.isPending}
              onClick={async () => {
                await update.mutateAsync({ name: renameValue.trim() });
                setRenameOpen(false);
              }}
            >
              Speichern
            </GlassButton>
          </div>
        </div>
      </GlassDialog>

      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title={`"${node.name}" verschieben`}
        description="Wähle den neuen Eltern-Ordner."
        currentParentId={node.parent_id}
        excludeFolderId={node.id}
        onConfirm={async (targetId) => {
          await update.mutateAsync({ parent_id: targetId });
        }}
      />

      <ShareFolderDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        folderId={node.id}
        folderName={node.name}
      />
    </div>
  );
}
