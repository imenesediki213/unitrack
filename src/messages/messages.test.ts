import { describe, expect, it } from 'vitest'
import { formatDay, formatList, formatTime } from './format'
import { messages, parseLanguage } from './language'

describe('language', () => {
  it('is French unless English was chosen', () => {
    expect(parseLanguage(null)).toBe('fr')
    expect(parseLanguage('de')).toBe('fr')
    expect(parseLanguage('en')).toBe('en')
  })

  // TypeScript already rejects a missing key. This finds keys left empty.
  it.each(['fr', 'en'] as const)('has no empty message in "%s"', (language) => {
    expect(emptyMessages(messages[language])).toEqual([])
  })
})

describe('formats', () => {
  it('writes a day in both languages without shifting it', () => {
    expect(formatDay('fr', '2027-06-15')).toBe('mardi 15 juin 2027')
    expect(formatDay('en', '2027-06-15')).toBe('Tuesday, June 15, 2027')
  })

  it('drops the seconds', () => {
    expect(formatTime('09:30:00')).toBe('09:30')
  })

  it('joins a list', () => {
    expect(formatList('fr', ['A', 'B', 'C'])).toBe('A, B et C')
  })
})

function emptyMessages(group: object, path = ''): string[] {
  return Object.entries(group).flatMap(([key, value]) => {
    if (typeof value === 'string') return value.trim() ? [] : [path + key]
    if (typeof value === 'object') return emptyMessages(value, `${path}${key}.`)
    return []
  })
}
