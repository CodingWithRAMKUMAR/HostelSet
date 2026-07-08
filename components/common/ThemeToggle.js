import { useTheme } from '../../hooks/useTheme'
const labels = { light: 'Light', dark: 'Dark', system: 'System' }
export default function ThemeToggle({ className = '', compact = false }) {
  const { theme, setTheme, modes } = useTheme()
  if (compact) { const next = theme === 'dark' ? 'light' : 'dark'; return <button type="button" onClick={() => setTheme(next)} className={`dashboard-icon-button ${className}`} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>{theme === 'dark' ? <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg> : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>}</button> }
  return <div className={`inline-flex rounded-full border border-white/20 bg-white/10 p-1 text-xs font-semibold shadow-sm ${className}`} role="group" aria-label="Theme mode">{modes.map(mode => <button key={mode} type="button" onClick={() => setTheme(mode)} aria-label={`Use ${labels[mode]} theme`} aria-pressed={theme === mode} className={`rounded-full px-3 py-1.5 transition focus:outline-none focus:ring-2 focus:ring-orange-300 ${theme === mode ? 'bg-orange-500 text-white shadow' : 'text-current hover:bg-white/15'}`}>{labels[mode]}</button>)}</div>
}
