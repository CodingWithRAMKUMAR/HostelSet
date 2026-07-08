import { useTheme } from '../../hooks/useTheme'

const labels = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

export default function ThemeToggle({ className = '', compact = false }) {
  const { theme, setTheme, modes } = useTheme()

  return (
    <div className={`inline-flex rounded-full border border-white/20 bg-white/10 p-1 text-xs font-semibold shadow-sm ${className}`} role="group" aria-label="Theme mode">
      {modes.map(mode => (
        <button
          key={mode}
          type="button"
          onClick={() => setTheme(mode)}
          aria-label={`Use ${labels[mode]} theme`}
          aria-pressed={theme === mode}
          className={`rounded-full ${compact ? 'px-2 py-1' : 'px-3 py-1.5'} transition focus:outline-none focus:ring-2 focus:ring-orange-300 ${
            theme === mode
              ? 'bg-orange-500 text-white shadow'
              : 'text-current hover:bg-white/15'
          }`}
        >
          {compact ? labels[mode][0] : labels[mode]}
        </button>
      ))}
    </div>
  )
}
