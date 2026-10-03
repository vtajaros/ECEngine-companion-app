import type { Subject } from '../types'

export const SUBJECT_MAP: Record<string, Subject> = {
  'Mathematics': 'MATH',
  'General Engineering & Applied Sciences': 'GEAS',
  'Electronics Engineering': 'ELECS',
  'Electronics Systems & Technologies': 'EST',
}

export const REVERSE_SUBJECT_MAP: Record<Subject, string> = {
  MATH: 'Mathematics',
  GEAS: 'General Engineering & Applied Sciences',
  ELECS: 'Electronics Engineering',
  EST: 'Electronics Systems & Technologies',
}

export const SUBJECT_THEME_COLORS: Record<
  Subject,
  {
    accent: string
    border: string
    bg: string
    text: string
    activeBorder: string
    activeBg: string
    activeText: string
  }
> = {
  MATH: {
    accent: '#f59e0b',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    text: 'text-amber-400',
    activeBorder: 'border-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.25)]',
    activeBg: 'bg-amber-500/15',
    activeText: 'text-amber-300 font-bold',
  },
  GEAS: {
    accent: '#3b82f6',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    text: 'text-blue-400',
    activeBorder: 'border-[#3b82f6] shadow-[0_0_12px_rgba(59,130,246,0.25)]',
    activeBg: 'bg-blue-500/15',
    activeText: 'text-blue-300 font-bold',
  },
  ELECS: {
    accent: '#ef4444',
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    text: 'text-red-400',
    activeBorder: 'border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.25)]',
    activeBg: 'bg-red-500/15',
    activeText: 'text-red-300 font-bold',
  },
  EST: {
    accent: '#22c55e',
    border: 'border-green-500/30',
    bg: 'bg-green-500/5',
    text: 'text-green-400',
    activeBorder: 'border-[#22c55e] shadow-[0_0_12px_rgba(34,197,94,0.25)]',
    activeBg: 'bg-green-500/15',
    activeText: 'text-green-300 font-bold',
  },
}

export function getSubjectFilterClasses(subject: string, isActive: boolean) {
  if (!isActive) return 'text-text-muted hover:text-text-primary hover:bg-surface border border-transparent'
  
  switch (subject) {
    case 'MATH': return 'bg-[#f59e0b] text-[#111] shadow-[0_0_10px_rgba(245,158,11,0.3)] border-[#f59e0b]'
    case 'GEAS': return 'bg-[#3b82f6] text-[#fff] shadow-[0_0_10px_rgba(59,130,246,0.3)] border-[#3b82f6]'
    case 'ELECS': return 'bg-[#ef4444] text-[#fff] shadow-[0_0_10px_rgba(239,68,68,0.3)] border-[#ef4444]'
    case 'EST': return 'bg-[#22c55e] text-[#111] shadow-[0_0_10px_rgba(34,197,94,0.3)] border-[#22c55e]'
    default: return 'bg-accent text-[#0D0D0D] shadow-[0_0_10px_rgba(0,255,65,0.3)] border-accent'
  }
}

export function getSubjectBadgeClasses(subject: string) {
  switch (subject) {
    case 'MATH': return 'text-[#f59e0b] bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.2)]'
    case 'GEAS': return 'text-[#3b82f6] bg-[rgba(59,130,246,0.1)] border-[rgba(59,130,246,0.2)]'
    case 'ELECS': return 'text-[#ef4444] bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.2)]'
    case 'EST': return 'text-[#22c55e] bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.2)]'
    default: return 'text-accent bg-[rgba(0,255,65,0.1)] border-[rgba(0,255,65,0.2)]'
  }
}
