import { expect, it } from 'vitest'
import { conflictingCells } from '../planning/board'
import { findConflicts } from '../scheduler'
import { MOVABLE_ID, puzzle, startPlacements } from './puzzle'

it('starts with one conflict', () => {
  expect(findConflicts(puzzle, startPlacements)).toMatchObject([
    { type: 'personDoubleBooked', personId: 'K. Belkadi', slotId: '10:15' },
  ])
})

it('is solved by the 14:00 cells, and not by the free cell at 11:30', () => {
  const forbidden = conflictingCells(puzzle, startPlacements, MOVABLE_ID)

  expect(forbidden).toContain('11:30|B12')
  expect(forbidden).not.toContain('14:00|Amphi A')
  expect(forbidden).not.toContain('14:00|B12')
})
