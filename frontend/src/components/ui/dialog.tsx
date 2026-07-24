import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({ className, children, ...props }: DialogPrimitive.DialogContentProps) {
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fade-in fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm" />
    <DialogPrimitive.Content className={cn('sheet-in fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl border border-line bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-float sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:right-auto sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl', className)} {...props}>
      <span aria-hidden className="mx-auto mb-4 block h-1.5 w-10 rounded-full bg-line sm:hidden" />
      {children}
      <DialogPrimitive.Close aria-label="Cerrar" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"><X size={20}/></DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
}

export function DialogHeader({ title, description }: { title: string; description?: string }) {
  return <div className="mb-6 pr-10"><DialogPrimitive.Title className="text-xl font-bold tracking-tight text-ink">{title}</DialogPrimitive.Title>{description && <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description>}</div>
}
