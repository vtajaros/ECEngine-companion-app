/**
 * tosClassification.ts
 * Utilities and lookups for Table of Specifications (TOS) category classification.
 * Supports both parent topics (x.0) and decimal subtopics (x.x) across all PRC ECE subjects.
 */

import { TOS_DATA, TOSSubject, TOSTopic } from './tosData'
import { Subject } from '../types'

export interface FlatTosTopic {
  id: string              // e.g. "ELECS-1.0" or "ELECS-1.1"
  subject: Subject        // "MATH" | "GEAS" | "ELECS" | "EST"
  name: string            // e.g. "1.0 DC Electrical Circuits" or "1.1 Resistive Network"
  title: string           // e.g. "DC Electrical Circuits" or "Resistive Network"
  code: string            // e.g. "1.0" or "1.1"
  parentTopicId?: string  // e.g. undefined for parent topic, "ELECS-1.0" for subtopic
  isSubtopic: boolean     // false for parent topic, true for decimal subtopic
  fullLabel: string       // e.g. "ELECS 1.0 DC Electrical Circuits" or "ELECS 1.1 Resistive Network"
  shortBadge: string      // e.g. "ELECS · 1.0 DC Electrical Circuits" or "ELECS · 1.1 Resistive Network"
  subtopics?: string[]    // list of subtopic names if it is a parent topic
}

export interface TosTopicGroup {
  parent: FlatTosTopic
  subtopics: FlatTosTopic[]
}

/** Flattened list of the 34 parent TOS topics (x.0) */
export const ALL_PARENT_TOS_TOPICS: FlatTosTopic[] = TOS_DATA.flatMap((subj: TOSSubject) =>
  subj.topics.map((t: TOSTopic) => {
    const match = t.name.match(/^(\d+\.0)\s+(.*)$/)
    const code = match ? match[1] : ''
    const title = match ? match[2] : t.name
    return {
      id: t.id,
      subject: subj.code as Subject,
      name: t.name,
      title,
      code,
      isSubtopic: false,
      fullLabel: `${subj.code} ${t.name}`,
      shortBadge: `${subj.code} · ${t.name}`,
      subtopics: t.subtopics.map(s => s.name),
    }
  })
)

/** Flattened list of all 181 decimal subtopics (x.x) */
export const ALL_TOS_SUBTOPICS: FlatTosTopic[] = TOS_DATA.flatMap((subj: TOSSubject) =>
  subj.topics.flatMap((t: TOSTopic) =>
    t.subtopics.map(sub => {
      const match = sub.name.match(/^(\d+\.\d+)\s*(.*)$/)
      const code = match ? match[1] : ''
      const title = match ? match[2] : sub.name
      const id = `${subj.code}-${code}`
      return {
        id,
        subject: subj.code as Subject,
        name: sub.name,
        title,
        code,
        parentTopicId: t.id,
        isSubtopic: true,
        fullLabel: `${subj.code} ${sub.name}`,
        shortBadge: `${subj.code} · ${sub.name}`,
      }
    })
  )
)

/** All 215 TOS items (both parent topics and decimal subtopics) */
export const ALL_TOS_TOPICS: FlatTosTopic[] = [
  ...ALL_PARENT_TOS_TOPICS,
  ...ALL_TOS_SUBTOPICS,
]

/** Map for O(1) topic lookup by topic id (case-insensitive) */
const TOPIC_BY_ID_MAP = new Map<string, FlatTosTopic>(
  ALL_TOS_TOPICS.map(t => [t.id.toUpperCase(), t])
)

/** Normalize a subject string to canonical Subject code */
export function normalizeSubjectCode(subj?: string | null): Subject | null {
  if (!subj) return null
  const s = subj.toUpperCase().trim()
  if (s.startsWith('MATH')) return 'MATH'
  if (s.startsWith('GEAS')) return 'GEAS'
  if (s.includes('SYSTEM') || s.startsWith('EST') || s.includes('COMM')) return 'EST'
  if (s.startsWith('ELEC')) return 'ELECS'
  return null
}

/** Get topic or subtopic by ID (case-insensitive) */
export function getTosTopicById(id?: string | null): FlatTosTopic | null {
  if (!id) return null
  return TOPIC_BY_ID_MAP.get(id.toUpperCase().trim()) ?? null
}

/** Get topics under a specific subject. By default returns parent topics (x.0) */
export function getTosTopicsBySubject(
  subject?: string | null,
  options?: { includeSubtopics?: boolean }
): FlatTosTopic[] {
  const code = normalizeSubjectCode(subject)
  const list = options?.includeSubtopics ? ALL_TOS_TOPICS : ALL_PARENT_TOS_TOPICS
  if (!code) return list
  return list.filter(t => t.subject === code)
}

/** Get only parent topics under a subject */
export function getTosParentTopicsBySubject(subject?: string | null): FlatTosTopic[] {
  return getTosTopicsBySubject(subject, { includeSubtopics: false })
}

/** Get parent topics with their respective decimal subtopics grouped for UI select dropdowns */
export function getTosTopicGroupsBySubject(subject?: string | null): TosTopicGroup[] {
  const code = normalizeSubjectCode(subject)
  const subjectsToInclude = code ? TOS_DATA.filter(s => s.code === code) : TOS_DATA

  return subjectsToInclude.flatMap(subj =>
    subj.topics.map(t => {
      const parentMatch = t.name.match(/^(\d+\.0)\s*(.*)$/)
      const parentCode = parentMatch ? parentMatch[1] : ''
      const parentTitle = parentMatch ? parentMatch[2] : t.name
      const parentTopic: FlatTosTopic = {
        id: t.id,
        subject: subj.code as Subject,
        name: t.name,
        title: parentTitle,
        code: parentCode,
        isSubtopic: false,
        fullLabel: `${subj.code} ${t.name}`,
        shortBadge: `${subj.code} · ${t.name}`,
        subtopics: t.subtopics.map(s => s.name),
      }

      const subtopics: FlatTosTopic[] = t.subtopics.map(sub => {
        const subMatch = sub.name.match(/^(\d+\.\d+)\s*(.*)$/)
        const subCode = subMatch ? subMatch[1] : ''
        const subTitle = subMatch ? subMatch[2] : sub.name
        const subId = `${subj.code}-${subCode}`
        return {
          id: subId,
          subject: subj.code as Subject,
          name: sub.name,
          title: subTitle,
          code: subCode,
          parentTopicId: t.id,
          isSubtopic: true,
          fullLabel: `${subj.code} ${sub.name}`,
          shortBadge: `${subj.code} · ${sub.name}`,
        }
      })

      return {
        parent: parentTopic,
        subtopics,
      }
    })
  )
}

/** Format badge label for display in UI */
export function formatTosBadge(id?: string | null): string | null {
  const topic = getTosTopicById(id)
  if (!topic) return null
  return topic.shortBadge
}

/** Styling helpers for subject theme */
export function getSubjectColorClasses(subject?: Subject | string | null): {
  badgeBg: string
  badgeBorder: string
  badgeText: string
} {
  const code = normalizeSubjectCode(subject)
  switch (code) {
    case 'MATH':
      return {
        badgeBg: 'bg-blue-500/10',
        badgeBorder: 'border-blue-500/30',
        badgeText: 'text-blue-400',
      }
    case 'GEAS':
      return {
        badgeBg: 'bg-purple-500/10',
        badgeBorder: 'border-purple-500/30',
        badgeText: 'text-purple-400',
      }
    case 'ELECS':
      return {
        badgeBg: 'bg-amber-500/10',
        badgeBorder: 'border-amber-500/30',
        badgeText: 'text-amber-400',
      }
    case 'EST':
      return {
        badgeBg: 'bg-emerald-500/10',
        badgeBorder: 'border-emerald-500/30',
        badgeText: 'text-emerald-400',
      }
    default:
      return {
        badgeBg: 'bg-accent/10',
        badgeBorder: 'border-accent/30',
        badgeText: 'text-accent',
      }
  }
}
