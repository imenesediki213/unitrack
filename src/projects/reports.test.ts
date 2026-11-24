import { describe, expect, it, vi } from 'vitest'
import { checkReportFile } from './reports'

// The check needs no server, so the client that expects one is left out.
vi.mock('../lib/supabase', () => ({ supabase: {}, unwrap: () => {} }))

const pdf = { type: 'application/pdf' }

describe('checkReportFile', () => {
  it('accepts a PDF', async () => {
    await expect(checkReportFile(new Blob(['%PDF-1.7 …'], pdf))).resolves.toBeUndefined()
  })

  it('rejects another file renamed to .pdf', async () => {
    await expect(checkReportFile(new Blob(['MZ…'], pdf))).rejects.toThrow('not_pdf')
  })

  it('rejects another type', async () => {
    const file = new Blob(['%PDF-1.7'], { type: 'text/plain' })
    await expect(checkReportFile(file)).rejects.toThrow('not_pdf')
  })

  it('rejects a file over 20 MB', async () => {
    const file = new Blob([new Uint8Array(20 * 1024 * 1024 + 1)], pdf)
    await expect(checkReportFile(file)).rejects.toThrow('file_too_large')
  })
})
