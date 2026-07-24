import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type Theme } from '@/lib/theme'

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor }
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-canvas p-1.5">
    {options.map(({ value, label, icon: Icon }) =>
      <button key={value} type="button" onClick={() => setTheme(value)} aria-pressed={theme === value}
        className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition ${theme === value ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'}`}>
        <Icon size={18}/>{label}
      </button>)}
  </div>
}
