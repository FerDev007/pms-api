import { AlertCircle, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Loading({ label = 'Cargando' }: { label?: string }) {
  return <div className="grid min-h-52 place-items-center text-muted"><div className="flex items-center gap-2.5 text-sm font-medium"><LoaderCircle className="animate-spin text-brand" size={20}/>{label}</div></div>
}

export function Empty({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="rounded-3xl border border-dashed border-line bg-surface/60 p-10 text-center"><span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand"><AlertCircle size={22}/></span><h3 className="text-lg font-bold tracking-tight text-ink">{title}</h3><p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{description}</p>{action && <div className="mt-6">{action}</div>}</div>
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <header className="mb-6 flex items-end justify-between gap-4 sm:mb-8"><div><p className="eyebrow">{eyebrow}</p><h1 className="page-title mt-1.5">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{description}</p>}</div>{action}</header>
}

export function ErrorState({ message, retry }: { message?: string; retry?: () => void }) {
  return <Empty title="No pudimos cargar esta vista" description={message || 'Revisa tu conexión e inténtalo de nuevo.'} action={retry && <Button onClick={retry}>Reintentar</Button>}/>
}

export function StockBadge({ stock, minimum }: { stock: number; minimum: number }) {
  const tone = stock <= 0 ? 'border-bad-line bg-bad-soft text-bad' : stock <= minimum ? 'border-warn-line bg-warn-soft text-warn' : 'border-good-line bg-good-soft text-good'
  return <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-xs font-semibold ${tone}`}>{stock} en stock</span>
}
