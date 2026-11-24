import { describe, expect, it } from 'vitest'
import { dayOf, daysLeft, endOfDay, isLate } from './deadline'

describe('report deadline', () => {
  it('keeps the chosen day', () => {
    expect(dayOf(endOfDay('2027-05-31'))).toBe('2027-05-31')
  })

  it('accepts reports until the end of the day', () => {
    const deadline = endOfDay('2027-05-31')
    const at = (time: string) => new Date(`2027-${time}`).toISOString()

    expect(isLate(at('05-31T23:30:00'), deadline)).toBe(false)
    expect(isLate(at('06-01T00:10:00'), deadline)).toBe(true)
    expect(isLate(at('06-01T00:10:00'), null)).toBe(false)
  })

  it('counts calendar days, not hours', () => {
    const deadline = endOfDay('2027-05-31')

    expect(daysLeft(deadline, new Date('2027-05-30T23:59:00'))).toBe(1)
    expect(daysLeft(deadline, new Date('2027-05-31T00:01:00'))).toBe(0)
    expect(daysLeft(deadline, new Date('2027-06-02T08:00:00'))).toBe(-2)
  })
})
