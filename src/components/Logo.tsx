/** A U whose right arm grows into a leaf: in French, "feuille" is a leaf and a sheet of paper. */
export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M9 9v13a10 10 0 0 0 20 0v-3"
        fill="none"
        stroke="var(--blue)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path className="logo-leaf" d="M29 20C24 13 26 5 36 2c3 9 0 16-7 18z" fill="var(--leaf)" />
      <circle cx="19" cy="17" r="3.6" fill="var(--sun)" />
    </svg>
  )
}
