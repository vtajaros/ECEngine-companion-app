import { useState, useMemo } from 'react'
import { BookOpen, LayoutGrid, X, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { ALL_PARENT_TOS_TOPICS } from '../lib/tosClassification'

export interface TosTopicDrawerProps {
  isOpen: boolean
  onClose: () => void
  selectedTosFolder: string | 'all'
  onSelect: (id: string | 'all') => void
  tosDeckCountByFolder: Record<string, number>
  totalCount: number
  activeSubject: string // 'ALL' | 'MATH' | 'GEAS' | 'ELECS' | 'EST'
}

interface TosSubjectDef {
  code: string
  id: string
  name: string
}

const TOS_SUBJECT_ROOTS: TosSubjectDef[] = [
  { code: 'MATH', id: 'tos_subj_MATH', name: 'Mathematics' },
  { code: 'GEAS', id: 'tos_subj_GEAS', name: 'GEAS' },
  { code: 'ELECS', id: 'tos_subj_ELECS', name: 'ELECS' },
  { code: 'EST', id: 'tos_subj_EST', name: 'EST' },
]

export function TosTopicDrawer({
  isOpen,
  onClose,
  selectedTosFolder,
  onSelect,
  tosDeckCountByFolder,
  totalCount,
  activeSubject,
}: TosTopicDrawerProps) {
  // Keep track of which subject sections are expanded when activeSubject === 'ALL'
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({
    MATH: true,
    GEAS: true,
    ELECS: true,
    EST: true,
  })

  const toggleSubjectExpanded = (code: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedSubjects((prev) => ({
      ...prev,
      [code]: !prev[code],
    }))
  }

  // Pre-calculate count for each subject root by summing its parent topics
  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const subj of TOS_SUBJECT_ROOTS) {
      const parents = ALL_PARENT_TOS_TOPICS.filter((p) => p.subject === subj.code)
      let sum = 0
      for (const p of parents) {
        sum += tosDeckCountByFolder[`tos_parent_${p.id}`] ?? 0
      }
      counts[subj.id] = sum
    }
    return counts
  }, [tosDeckCountByFolder])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 w-[78vw] max-w-[300px] sm:max-w-[280px] bg-neutral-950/90 backdrop-blur-md border-l border-neutral-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-[#00ff41]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-100">
              ToS Topics
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close ToS topics"
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 no-scrollbar">
          {/* "ALL" row */}
          <button
            type="button"
            onClick={() => onSelect('all')}
            className={`w-full flex items-center justify-between text-left rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all active:scale-[0.98] ${
              selectedTosFolder === 'all'
                ? 'bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/30 shadow-[0_0_10px_rgba(0,255,65,0.15)] font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <LayoutGrid
                size={15}
                className={selectedTosFolder === 'all' ? 'text-[#00ff41]' : 'text-neutral-500'}
              />
              <span className="truncate">ALL TOPICS</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="rounded-full bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 text-[10px] font-mono font-normal normal-case text-neutral-400">
                {totalCount}
              </span>
              {selectedTosFolder === 'all' && <Check size={14} className="text-[#00ff41]" />}
            </div>
          </button>

          {/* When activeSubject is ALL: Render Nested Subject Roots + Parent Topics */}
          {activeSubject === 'ALL' ? (
            TOS_SUBJECT_ROOTS.map((subj) => {
              const isSubjSelected = selectedTosFolder === subj.id
              const isExpanded = expandedSubjects[subj.code] ?? true
              const parentTopics = ALL_PARENT_TOS_TOPICS.filter((p) => p.subject === subj.code)
              const count = subjectCounts[subj.id] ?? 0

              return (
                <div key={subj.id} className="space-y-1">
                  {/* Subject Root Row */}
                  <div
                    onClick={() => onSelect(subj.id)}
                    className={`w-full flex items-center justify-between rounded-xl py-2 px-2 text-xs font-bold uppercase tracking-wider cursor-pointer transition-all active:scale-[0.98] ${
                      isSubjSelected
                        ? 'bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/30 shadow-[0_0_10px_rgba(0,255,65,0.15)]'
                        : 'text-neutral-300 hover:text-white hover:bg-neutral-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => toggleSubjectExpanded(subj.code, e)}
                        className="p-1 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <span className="truncate">{subj.name}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="rounded-full bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 text-[10px] font-mono font-normal normal-case text-neutral-400">
                        {count}
                      </span>
                      {isSubjSelected && <Check size={14} className="text-[#00ff41]" />}
                    </div>
                  </div>

                  {/* Nested Parent Topics under Subject */}
                  {isExpanded && (
                    <div className="pl-4 space-y-1 border-l border-neutral-800/60 ml-3">
                      {parentTopics.map((parent) => {
                        const parentFolderId = `tos_parent_${parent.id}`
                        const isParentSelected = selectedTosFolder === parentFolderId
                        const parentCount = tosDeckCountByFolder[parentFolderId] ?? 0

                        return (
                          <button
                            key={parentFolderId}
                            type="button"
                            onClick={() => onSelect(parentFolderId)}
                            className={`w-full flex items-center justify-between text-left rounded-lg py-1.5 px-2.5 text-[11px] font-medium transition-all active:scale-[0.98] ${
                              isParentSelected
                                ? 'bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/30 font-semibold'
                                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-transparent'
                            }`}
                          >
                            <span className="truncate pr-1">{parent.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0 ml-1">
                              <span className="rounded bg-neutral-900/80 border border-neutral-800/80 px-1 py-0.2 text-[9px] font-mono text-neutral-400">
                                {parentCount}
                              </span>
                              {isParentSelected && <Check size={13} className="text-[#00ff41]" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            /* When a specific subject filter is active: Show only parent topics for that subject */
            <div className="space-y-1">
              {ALL_PARENT_TOS_TOPICS.filter((p) => p.subject === activeSubject).map((parent) => {
                const parentFolderId = `tos_parent_${parent.id}`
                const isParentSelected = selectedTosFolder === parentFolderId
                const parentCount = tosDeckCountByFolder[parentFolderId] ?? 0

                return (
                  <button
                    key={parentFolderId}
                    type="button"
                    onClick={() => onSelect(parentFolderId)}
                    className={`w-full flex items-center justify-between text-left rounded-xl py-2 px-3 text-xs font-medium transition-all active:scale-[0.98] ${
                      isParentSelected
                        ? 'bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/30 font-semibold shadow-[0_0_10px_rgba(0,255,65,0.15)]'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-transparent'
                    }`}
                  >
                    <span className="truncate pr-1">{parent.name}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-1">
                      <span className="rounded-full bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">
                        {parentCount}
                      </span>
                      {isParentSelected && <Check size={14} className="text-[#00ff41]" />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

export default TosTopicDrawer
