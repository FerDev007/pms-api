import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import { Input } from '@/components/ui/input'

export function Field({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-ink"><span>{label}</span><Input {...props}/>{error && <span className="text-xs font-medium text-bad">{error}</span>}</label>
}

export function SelectField({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-ink"><span>{label}</span><select className="min-h-11 rounded-xl border-line bg-surface text-base text-ink shadow-card transition focus:border-brand focus:ring-2 focus:ring-brand/20" {...props}>{children}</select></label>
}

export function FilterSelect({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="min-h-11 w-full truncate rounded-xl border-line bg-surface pr-8 text-sm font-medium text-ink shadow-card transition focus:border-brand focus:ring-2 focus:ring-brand/20" {...props}>{children}</select>
}
