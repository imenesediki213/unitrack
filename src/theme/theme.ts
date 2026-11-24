export type Theme = 'day' | 'night'

/** The choice made at startup by the script in index.html. */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'night' ? 'night' : 'day'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem('unitrack.theme', theme)
  } catch {
    // Storage is blocked: the choice still applies to this visit.
  }
}
