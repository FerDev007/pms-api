import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn('min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink shadow-card transition placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/20', className)} {...props} />
))
Input.displayName = 'Input'
