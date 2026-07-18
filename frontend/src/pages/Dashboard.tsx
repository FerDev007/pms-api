import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, ChevronRight, CircleAlert, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import type { Dashboard, Page, Supply } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ErrorState, Loading, PageHeader, StockBadge } from '@/components/common'
import { formatDate, movementLabel } from '@/lib/utils'

export function DashboardPage() {
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/pms/dashboard') })
  const low = useQuery({ queryKey: ['supplies', 'low'], queryFn: () => api<Page<Supply>>('/pms/suministros?estado=bajo&page_size=5') })
  if (dashboard.isLoading) return <Loading label="Revisando el almacén"/>
  if (!dashboard.data) return <ErrorState message={dashboard.error?.message} retry={() => dashboard.refetch()}/>
  const data = dashboard.data
  return <>
    <PageHeader eyebrow="Resumen de hoy" title="Todo lo que imprime, en orden." description="Existencias y equipos en una sola vista, sin perseguir hojas de cálculo."/>
    <section className="grid gap-4 md:grid-cols-[1.2fr_.8fr]">
      <Card className="relative flex min-h-56 flex-col justify-between overflow-hidden border-0 bg-gradient-to-br from-brand via-brand to-accent p-6 text-white shadow-lift sm:p-7">
        <div aria-hidden className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10"/>
        <div aria-hidden className="absolute -bottom-16 right-16 h-36 w-36 rounded-full bg-white/5"/>
        <div><p className="text-xs font-bold uppercase tracking-[.14em] text-white/70">Piezas disponibles</p><div className="mt-3 font-display text-6xl font-semibold leading-none sm:text-7xl">{data.stock_total}</div></div>
        <div className="mt-8 flex flex-wrap gap-2"><Badge className="border-white/25 bg-white/15 text-white">{data.suministros_total} suministros</Badge><Badge className="border-transparent bg-[#e9dcc2] text-[#5c451a]">{data.stock_bajo} requieren atención</Badge></div>
      </Card>
      <Card className="flex flex-col justify-between">
        <div className="flex items-center justify-between"><div><p className="eyebrow">Red de equipos</p><h2 className="section-title mt-1">Estado del piso</h2></div><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"><Printer size={20}/></span></div>
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-canvas p-3"><span className="mx-auto mb-1.5 block h-2 w-2 rounded-full bg-good"/><strong className="font-display text-2xl text-ink sm:text-3xl">{data.equipos.disponibles}</strong><span className="block text-xs text-muted">En línea</span></div>
          <div className="rounded-xl bg-canvas p-3"><span className="mx-auto mb-1.5 block h-2 w-2 rounded-full bg-bad"/><strong className="font-display text-2xl text-ink sm:text-3xl">{data.equipos.sin_conexion}</strong><span className="block text-xs text-muted">Sin conexión</span></div>
          <div className="rounded-xl bg-canvas p-3"><span className="mx-auto mb-1.5 block h-2 w-2 rounded-full bg-warn"/><strong className="font-display text-2xl text-ink sm:text-3xl">{data.equipos.obsoletos}</strong><span className="block text-xs text-muted">Sin actualizar</span></div>
        </div>
        <Link to="/equipos" className="mt-6 flex min-h-11 items-center justify-between rounded-xl bg-brand-soft px-4 text-sm font-semibold text-brand transition hover:bg-line">Ver equipos <ChevronRight size={18}/></Link>
      </Card>
    </section>
    <section className="mt-8 grid gap-6 lg:grid-cols-2">
      <div><div className="mb-3 flex items-center justify-between"><h2 className="section-title">Necesitan atención</h2><Link className="text-sm font-semibold text-brand hover:underline" to="/inventario?estado=bajo">Ver inventario</Link></div>
        <div className="grid grid-cols-1 gap-3">{low.data?.items.length ? low.data.items.map(item => <Link key={item.id} to={`/inventario/${item.id}`} className="row-card min-h-20 p-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-warn-soft text-warn"><CircleAlert size={20}/></span><span className="min-w-0 flex-1"><strong className="block truncate text-ink">{item.nombre}</strong><span className="font-mono text-xs text-muted">{item.sku}</span></span><StockBadge stock={item.stock} minimum={item.stock_minimo}/></Link>) : <p className="empty-note">No hay suministros con stock bajo.</p>}</div>
      </div>
      <div><div className="mb-3 flex items-center justify-between"><h2 className="section-title">Últimos movimientos</h2><Link className="text-sm font-semibold text-brand hover:underline" to="/movimientos">Ver historial</Link></div>
        <div className="grid grid-cols-1 gap-3">{data.movimientos_recientes.length ? data.movimientos_recientes.map(item => <Link key={item.id} to={`/movimientos/${item.id}`} className="row-card min-h-20 p-3"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${item.tipo_transaccion.includes('salida') ? 'bg-bad-soft text-bad' : 'bg-good-soft text-good'}`}>{item.tipo_transaccion.includes('salida') ? <ArrowUpRight/> : <ArrowDownLeft/>}</span><span className="min-w-0 flex-1"><strong className="block truncate text-ink">{item.suministro.nombre}</strong><span className="text-xs text-muted">{movementLabel(item.tipo_transaccion)} · {formatDate(item.fecha)}</span></span><span className="font-mono font-semibold text-ink">{item.stock_despues}</span></Link>) : <p className="empty-note">Aún no hay movimientos registrados.</p>}</div>
      </div>
    </section>
  </>
}
