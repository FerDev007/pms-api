import { cn } from '@/lib/utils'

export function Badge({ children, className, tone = 'neutral' }: { children: React.ReactNode; className?: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold', tone === 'good' && 'border-good-line bg-good-soft text-good', tone === 'warn' && 'border-warn-line bg-warn-soft text-warn', tone === 'bad' && 'border-bad-line bg-bad-soft text-bad', tone === 'neutral' && 'border-line bg-canvas text-muted', className)}>{children}</span>
}
