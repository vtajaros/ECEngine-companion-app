import { useMemo } from 'react'
import { Folder as FolderIcon, LayoutGrid, X, Check } from 'lucide-react'
import { Folder } from '../services/db.service'

export interface FolderDrawerProps {
  isOpen: boolean
  onClose: () => void
  folders: Folder[]
  selectedFolderId: string | 'all'
  onSelect: (id: string | 'all') => void
  folderCounts: { total: number; byId: Record<string, number> }
}

interface FlattenedFolderItem {
  folder: Folder
  depth: number
}

const UNCATEGORIZED_NAME = 'uncategorized'

/**
 * Flattens root folders and their immediate children into an ordered list,
 * with any root folder literally named "Uncategorized" pushed to the very
 * end (after all other root folders and their children), matching desktop's
 * convention of showing Uncategorized last.
 */
function getFlattenedFolders(folders: Folder[]): FlattenedFolderItem[] {
  const roots = folders.filter((f) => f.parentId === null)
  const normalRoots = roots.filter((f) => f.name.trim().toLowerCase() !== UNCATEGORIZED_NAME)
  const uncategorizedRoots = roots.filter((f) => f.name.trim().toLowerCase() === UNCATEGORIZED_NAME)
  const orderedRoots = [...normalRoots, ...uncategorizedRoots]

  const items: FlattenedFolderItem[] = []
  const visited = new Set<string>()

  for (const root of orderedRoots) {
    items.push({ folder: root, depth: 0 })
    visited.add(root.id)
    const children = folders.filter((f) => f.parentId === root.id)
    for (const child of children) {
      items.push({ folder: child, depth: 1 })
      visited.add(child.id)
    }
  }

  // Fallback for any unvisited orphaned folders
  for (const folder of folders) {
    if (!visited.has(folder.id)) {
      items.push({ folder, depth: folder.parentId ? 1 : 0 })
    }
  }

  return items
}

export function FolderDrawer({
  isOpen,
  onClose,
  folders,
  selectedFolderId,
  onSelect,
  folderCounts,
}: FolderDrawerProps) {
  const flattenedFolders = useMemo(() => getFlattenedFolders(folders), [folders])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/25 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 w-[68vw] max-w-[260px] sm:max-w-[240px] bg-neutral-950/80 backdrop-blur-md border-l border-neutral-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FolderIcon size={18} className="text-[#00ff41]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-100">
              Folders
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close folders"
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Folder List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 no-scrollbar">
          {/* "ALL" row */}
          <button
            type="button"
            onClick={() => onSelect('all')}
            className={`w-full flex items-center justify-between text-left rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all active:scale-[0.98] ${
              selectedFolderId === 'all'
                ? 'bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/30 shadow-[0_0_10px_rgba(0,255,65,0.15)] font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <LayoutGrid
                size={15}
                className={selectedFolderId === 'all' ? 'text-[#00ff41]' : 'text-neutral-500'}
              />
              <span className="truncate">ALL</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="rounded-full bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 text-[10px] font-mono font-normal normal-case text-neutral-400">
                {folderCounts.total}
              </span>
              {selectedFolderId === 'all' && <Check size={14} className="text-[#00ff41]" />}
            </div>
          </button>

          {/* Folder items */}
          {flattenedFolders.map(({ folder, depth }) => {
            const isSelected = selectedFolderId === folder.id
            const count = folderCounts.byId[folder.id] ?? 0
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => onSelect(folder.id)}
                className={`w-full flex items-center justify-between text-left rounded-xl py-2.5 pr-3 text-xs font-semibold uppercase tracking-wider transition-all active:scale-[0.98] ${
                  depth > 0 ? 'pl-7' : 'pl-3'
                } ${
                  isSelected
                    ? 'bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/30 shadow-[0_0_10px_rgba(0,255,65,0.15)] font-bold'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FolderIcon
                    size={14}
                    className={isSelected ? 'text-[#00ff41]' : 'text-neutral-500'}
                  />
                  <span className="truncate">{folder.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="rounded-full bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 text-[10px] font-mono font-normal normal-case text-neutral-400">
                    {count}
                  </span>
                  {isSelected && <Check size={14} className="text-[#00ff41]" />}
                </div>
              </button>
            )
          })}
        </div>
      </aside>
    </>
  )
}

export default FolderDrawer
