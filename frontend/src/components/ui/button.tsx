import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[.98]',
  { variants: {
    variant: {
      default: 'bg-brand text-white shadow-card hover:bg-brand-700',
      primary: 'bg-gradient-to-br from-brand to-accent text-white shadow-fab hover:brightness-110',
      secondary: 'border border-line bg-surface text-ink shadow-card hover:bg-canvas',
      ghost: 'text-muted hover:bg-canvas hover:text-ink',
      danger: 'bg-bad text-white shadow-card hover:bg-[#a03e37]'
    },
    size: { default: 'h-11', sm: 'h-9 min-h-9 px-3', icon: 'h-11 w-11 p-0' }
  }, defaultVariants: { variant: 'default', size: 'default' } }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
})
Button.displayName = 'Button'
