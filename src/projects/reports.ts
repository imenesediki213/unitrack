import { supabase, unwrap } from '../lib/supabase'
import type { Decision, ReportVersion } from '../lib/types'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const LINK_LIFETIME_SECONDS = 60

export function listVersions(projectId: string): Promise<ReportVersion[]> {
  return unwrap(
    supabase
      .from('report_versions')
      .select('id, version_number, file_path, uploaded_at, decision, comment')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false }),
  )
}

/** Throws an error that has a translated message when the file is not acceptable. */
export async function checkReportFile(file: Blob): Promise<void> {
  if (file.size > MAX_FILE_SIZE) throw new Error('file_too_large')

  // The extension and the type come from the file name, so the content is checked too.
  const start = await file.slice(0, 5).text()
  if (file.type !== 'application/pdf' || start !== '%PDF-') throw new Error('not_pdf')
}

export async function submitVersion(projectId: string, file: File): Promise<void> {
  await checkReportFile(file)
  const path = `${projectId}/${crypto.randomUUID()}.pdf`
  await unwrap(
    supabase.storage.from('reports').upload(path, file, { contentType: 'application/pdf' }),
  )
  await unwrap(
    supabase.from('report_versions').insert({ project_id: projectId, file_path: path }),
  )
}

export function reviewVersion(
  versionId: string,
  decision: Exclude<Decision, 'pending'>,
  comment: string,
): Promise<void> {
  return unwrap(
    supabase
      .from('report_versions')
      .update({ decision, comment: comment.trim() || null })
      .eq('id', versionId),
  )
}

/** The bucket is private, so each download needs a short-lived link. */
export async function downloadReport(version: ReportVersion): Promise<void> {
  const { signedUrl } = await unwrap<{ signedUrl: string }>(
    supabase.storage.from('reports').createSignedUrl(version.file_path, LINK_LIFETIME_SECONDS, {
      download: `rapport-v${version.version_number}.pdf`,
    }),
  )
  window.location.assign(signedUrl)
}
