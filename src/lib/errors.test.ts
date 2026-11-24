import { describe, expect, it } from 'vitest'
import { en } from '../messages/en'
import { errorText } from './errors'

describe('errorText', () => {
  it('recognises the names raised by the database', () => {
    expect(errorText(en, { code: 'P0001', message: 'role_in_use' })).toBe(en.errors.role_in_use)
  })

  it('recognises codes', () => {
    expect(errorText(en, { code: '23P01', message: 'conflicting key value' })).toBe(
      en.errors['23P01'],
    )
  })

  it('recognises an unreachable server', () => {
    expect(errorText(en, new TypeError('Failed to fetch'))).toBe(en.errors.network)
  })

  it('never shows an unknown technical message', () => {
    expect(errorText(en, new Error('toString'))).toBe(en.errors.unknown)
  })
})
