import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers,
  X,
  Search,
  Check,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react'
import type { Subject } from '../../types'
import {
  ALL_PARENT_TOS_TOPICS,
  ALL_TOS_SUBTOPICS,
  type FlatTosTopic,
} from '../../lib/tosClassification'

interface GauntletTopicModalProps {
  isOpen: boolean
  onClose: () => void
  selectedTopicIds: string[]
  onApply: (topicIds: string[]) => void
  activeSubjects?: Subject[]
}

const SUBJECT_TABS: Array<'ALL' | Subject> = ['ALL', 'MATH', 'GEAS', 'ELECS', 'EST']

const SUBJECT_COLOR: Record<Subject, string> = {
  MATH: '#f59e0b',
  GEAS: '#3b82f6',
  ELECS: '#ef4444',
  EST: '#22c55e',
}

export const GauntletTopicModal: React.FC<GauntletTopicModalProps> = ({
  isOpen,
  onClose,
  selectedTopicIds,
  onApply,
  activeSubjects,
}) => {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedTopicIds)
  const [activeTab, setActiveTab] = useState<'ALL' | Subject>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showGranular, setShowGranular] = useState(false)

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSelected(selectedTopicIds)
      setSearchQuery('')
      if (activeSubjects && activeSubjects.length === 1) {
        setActiveTab(activeSubjects[0])
      } else {
        setActiveTab('ALL')
      }
    }
  }, [isOpen, selectedTopicIds, activeSubjects])

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Source list depending on granular toggle
  const topicsPool = useMemo(() => {
    return showGranular ? ALL_TOS_SUBTOPICS : ALL_PARENT_TOS_TOPICS
  }, [showGranular])

  // Filtered topics by tab and search
  const displayedTopics = useMemo(() => {
    let list = topicsPool
    if (activeTab !== 'ALL') {
      list = list.filter((t) => t.subject === activeTab)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q)
      )
    }
    return list
  }, [topicsPool, activeTab, searchQuery])

  const toggleTopic = (id: string) => {
    setLocalSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSelectAllVisible = () => {
    const visibleIds = displayedTopics.map((t) => t.id)
    setLocalSelected((prev) => Array.from(new Set([...prev, ...visibleIds])))
  }

  const handleClearVisible = () => {
    const visibleIds = new Set(displayedTopics.map((t) => t.id))
    setLocalSelected((prev) => prev.filter((id) => !visibleIds.has(id)))
  }

  const handleClearAll = () => {
    setLocalSelected([])
  }

  const handleApply = () => {
    onApply(localSelected)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center bg-black/80 backdrop-blur-sm select-none">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full sm:max-w-2xl h-[92vh] sm:h-[88vh] bg-neutral-950 sm:border border-neutral-800 sm:rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden rounded-t-2xl"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/90 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/30 flex items-center justify-center text-[#00FF41]">
                  <Layers size={17} />
                </div>
                <div>
                  <h2 className="font-display text-xs sm:text-sm font-bold text-neutral-100 tracking-wider uppercase">
                    TOPIC FOCUS SELECTION
                  </h2>
                  <p className="text-[10px] font-rajdhani font-semibold text-neutral-400 uppercase tracking-wider">
                    Check topics to include in your session pool
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors active:scale-95"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Controls Bar: Search + Granular Toggle */}
            <div className="p-3 border-b border-neutral-800/80 bg-neutral-900/50 flex flex-col gap-2 shrink-0">
              {/* Search Input */}
              <div className="relative w-full">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search topics by name, code, or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-8 py-2 text-xs font-rajdhani font-semibold text-neutral-100 placeholder:text-neutral-500 focus:border-[#00FF41]/60 focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Granular Subtopics Toggle Bar */}
              <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800/80">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={13} className="text-neutral-400" />
                  <span className="text-[11px] font-display font-semibold text-neutral-300 uppercase tracking-wide">
                    {showGranular
                      ? `Granular Subtopics (${ALL_TOS_SUBTOPICS.length})`
                      : `Parent Topics (${ALL_PARENT_TOS_TOPICS.length})`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGranular((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    showGranular ? 'bg-[#00FF41]' : 'bg-neutral-800'
                  }`}
                  role="switch"
                  aria-checked={showGranular}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-neutral-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                      showGranular ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Subject Tabs & Bulk Selection Buttons */}
            <div className="px-3 py-2 border-b border-neutral-800/80 bg-neutral-900/30 flex flex-col gap-2 shrink-0">
              {/* Subject Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
                {SUBJECT_TABS.map((tab) => {
                  const active = activeTab === tab
                  const color = tab === 'ALL' ? '#00FF41' : SUBJECT_COLOR[tab]
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1 rounded-lg font-display font-bold text-xs tracking-wider transition-all select-none active:scale-95 shrink-0 ${
                        active
                          ? 'bg-neutral-800 border text-white shadow-sm'
                          : 'text-neutral-400 hover:text-white border border-transparent'
                      }`}
                      style={active ? { borderColor: color, color } : undefined}
                    >
                      {tab}
                    </button>
                  )
                })}
              </div>

              {/* Action buttons: Select All Visible / Clear Visible / Clear All */}
              <div className="flex items-center justify-between text-xs font-rajdhani font-semibold">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 active:scale-95 transition-all"
                  >
                    Select {activeTab === 'ALL' ? 'All' : activeTab}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearVisible}
                    className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 active:scale-95 transition-all"
                  >
                    Deselect {activeTab === 'ALL' ? 'All' : activeTab}
                  </button>
                </div>
                {localSelected.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[#00FF41] hover:underline flex items-center gap-1 text-[11px] font-mono active:scale-95 transition-all"
                  >
                    <RotateCcw size={11} /> Reset All
                  </button>
                )}
              </div>
            </div>

            {/* Topics Checklist Body */}
            <div className="p-3 sm:p-4 overflow-y-auto space-y-1.5 flex-1 min-h-0">
              {displayedTopics.length === 0 ? (
                <div className="py-16 text-center text-neutral-500 font-rajdhani font-semibold text-sm">
                  No topics match your current filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {displayedTopics.map((topic: FlatTosTopic) => {
                    const isChecked = localSelected.includes(topic.id)
                    const subColor = SUBJECT_COLOR[topic.subject]

                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => toggleTopic(topic.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 active:scale-[0.99] select-none ${
                          isChecked
                            ? 'bg-neutral-900 border-[#00FF41]/60 shadow-[0_0_12px_rgba(0,255,65,0.12)]'
                            : 'bg-neutral-900/40 border-neutral-800/80 hover:border-neutral-700'
                        }`}
                      >
                        {/* Checkbox indicator */}
                        <div
                          className={`w-4 h-4 rounded mt-0.5 shrink-0 flex items-center justify-center border transition-all ${
                            isChecked
                              ? 'bg-[#00FF41] border-[#00FF41] text-neutral-950'
                              : 'border-neutral-700 bg-neutral-900'
                          }`}
                        >
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>

                        {/* Topic Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="text-[9px] font-display font-bold px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: `${subColor}22`,
                                color: subColor,
                                border: `1px solid ${subColor}44`,
                              }}
                            >
                              {topic.subject}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-neutral-400">
                              {topic.code}
                            </span>
                          </div>
                          <p
                            className={`text-xs font-rajdhani font-semibold mt-0.5 leading-snug line-clamp-2 ${
                              isChecked ? 'text-neutral-100 font-bold' : 'text-neutral-300'
                            }`}
                          >
                            {topic.title}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer: Summary and Apply */}
            <div className="px-4 py-3 border-t border-neutral-800 bg-neutral-900/90 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-mono text-neutral-400 shrink-0">
                  Selected:
                </span>
                {localSelected.length === 0 ? (
                  <span className="text-[11px] font-mono text-[#00FF41] font-bold truncate">
                    All Topics (Pool)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-[#00FF41]/15 border border-[#00FF41]/30 text-[#00FF41] font-display font-bold text-[11px] truncate">
                    {localSelected.length} {localSelected.length === 1 ? 'Topic' : 'Topics'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl text-xs font-display font-bold uppercase tracking-wider text-neutral-400 hover:text-white bg-neutral-800 border border-neutral-700/80 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-4 py-2 rounded-xl text-xs font-display font-bold uppercase tracking-wider text-neutral-950 bg-[#00FF41] hover:bg-[#00e63a] shadow-[0_0_15px_rgba(0,255,65,0.3)] active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Sparkles size={14} />
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
