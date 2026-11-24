import { useState, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { useLanguage } from '../messages/LanguageContext'
import { applyTheme, currentTheme, type Theme } from './theme'
import './theme.css'

/** A small window on the sky. The sun and the moon sit on a wheel that makes half a turn. */
export function ThemeSwitch() {
  const { t } = useLanguage()
  const [theme, setTheme] = useState(currentTheme)

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const next: Theme = theme === 'night' ? 'day' : 'night'

    const change = () => {
      applyTheme(next)
      // The browser takes its picture of the new page right after this function.
      flushSync(() => setTheme(next))
    }

    const prefersLessMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersLessMotion || !document.startViewTransition) {
      change()
      return
    }

    // The new colours spread from the switch (see theme.css).
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect()
    const rootStyle = document.documentElement.style
    rootStyle.setProperty('--reveal-x', `${left + width / 2}px`)
    rootStyle.setProperty('--reveal-y', `${top + height / 2}px`)
    document.startViewTransition(change)
  }

  return (
    <button
      type="button"
      role="switch"
      className="theme-switch"
      aria-checked={theme === 'night'}
      aria-label={t.nav.nightMode}
      title={t.nav.nightMode}
      onClick={handleClick}
    >
      <svg viewBox="0 0 64 32" aria-hidden="true">
        <g className="sky-stars">
          <circle cx="11" cy="9" r="1.2" />
          <circle cx="20" cy="17" r="0.8" />
          <circle cx="48" cy="7" r="1" />
          <circle cx="55" cy="16" r="1.3" />
        </g>
        <g className="sky-wheel">
          <circle className="sky-sun" cx="32" cy="13" r="7" />
          <path
            className="sky-moon"
            transform="translate(32 55) rotate(180)"
            d="M2-8A8 8 0 1 0 8 3 6.8 6.8 0 0 1 2-8z"
          />
        </g>
        <path className="sky-hill" d="M0 27Q16 20 33 26T64 24V32H0z" />
      </svg>
    </button>
  )
}
