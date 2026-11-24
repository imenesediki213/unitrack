import type { Placement, Problem } from '../scheduler'

// Fictional data for the puzzle of the main page. It needs no account and no database.
// People and rooms use their name as id, and slots their time.

const PEOPLE = ['O. Tebbal', 'K. Belkadi', 'L. Haddad', 'Y. Merabet'] as const
const DAY = '2027-06-14'

export type PuzzleProjectId = 'encryption' | 'intrusion' | 'plants'

export const puzzle = {
  projects: [
    { id: 'encryption', people: ['O. Tebbal', 'K. Belkadi'], hasCompleteJury: true },
    { id: 'intrusion', people: ['K. Belkadi', 'L. Haddad'], hasCompleteJury: true },
    { id: 'plants', people: ['L. Haddad', 'Y. Merabet'], hasCompleteJury: true },
  ],
  slots: ['10:15', '11:30', '14:00'].map((id) => ({ id, day: DAY })),
  roomIds: ['Amphi A', 'B12'],
  availability: new Map(PEOPLE.map((person) => [person, new Set(['10:15', '11:30', '14:00'])])),
  maxPerDay: 3,
  fixed: [],
} satisfies Problem

/** The project that the visitor has to move. */
export const MOVABLE_ID: PuzzleProjectId = 'intrusion'

export const startPlacements: Placement[] = [
  { projectId: 'encryption', slotId: '10:15', roomId: 'Amphi A' },
  { projectId: 'intrusion', slotId: '10:15', roomId: 'B12' },
  { projectId: 'plants', slotId: '11:30', roomId: 'Amphi A' },
]
