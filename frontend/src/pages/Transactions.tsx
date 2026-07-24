import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Boxes, Camera, History, Minus, Plus, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api, json } from '@/lib/api'
import type { Page, Printer, Supply, Transaction } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FilterSelect } from '@/components/fields'
import { Empty, ErrorState, Loading, PageHeader, StockBadge } from '@/components/common'
import { SUPPLY_COLORS, SUPPLY_TYPES, formatDate, movementLabel, supplyColor, supplyMeta } from '@/lib/utils'

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition ${active?'border-ink bg-ink text-white':'border-line bg-surface text-muted hover:border-ink/40 hover:text-ink'}`}>{children}</button>
}

export function MovementPage() {
  const [params]=useSearchParams(); const navigate=useNavigate(); const client=useQueryClient()
  const [supplyId,setSupplyId]=useState(Number(params.get('suministro'))||0); const [type,setType]=useState<'entrada'|'salida'>('entrada'); const [quantity,setQuantity]=useState(1); const [search,setSearch]=useState(''); const [scanning,setScanning]=useState(false); const [showFilters,setShowFilters]=useState(false)
  const [printerId,setPrinterId]=useState(0); const [tipoSuministro,setTipoSuministro]=useState(''); const [color,setColor]=useState('')
  const video=useRef<HTMLVideoElement>(null)
  const printers=useQuery({queryKey:['printers'],queryFn:()=>api<Printer[]>('/pms/impresoras')})
  const supplies=useQuery({queryKey:['supplies','movement'],queryFn:()=>api<Page<Supply>>('/pms/suministros?page_size=100')})
  const selected=supplies.data?.items.find(item=>item.id===supplyId)
  useEffect(()=>{if(!scanning||!video.current)return;let controls:IScannerControls|undefined;const reader=new BrowserMultiFormatReader();reader.decodeFromVideoDevice(undefined,video.current,(result)=>{if(result){const code=result.getText();const match=supplies.data?.items.find(item=>item.upc===code);if(match){setSupplyId(match.id);setScanning(false);toast.success(`Encontrado: ${match.nombre}`)}else toast.error(`No existe un suministro con UPC ${code}`)}}).then(value=>controls=value).catch(()=>{setScanning(false);toast.error('No se pudo abrir la cámara. Usa la búsqueda manual.')});return()=>controls?.stop()},[scanning,supplies.data])
  const create=useMutation({mutationFn:()=>api<Transaction>('/pms/transacciones',json('POST',{suministro_id:supplyId,cantidad_afectada:quantity,tipo_transaccion:type})),onSuccess:data=>{client.invalidateQueries();toast.success(type==='entrada'?'Entrada registrada':'Salida registrada');navigate(`/movimientos/${data.id}`)},onError:e=>toast.error(e.message)})
  const matches=supplies.data?.items.filter(item=>
    (!printerId||item.impresora_id===printerId)&&
    (!tipoSuministro||item.tipo_suministro===tipoSuministro)&&
    (!color||supplyColor(item.nombre)===color)&&
    (!search||`${item.nombre} ${item.sku} ${item.upc}`.toLowerCase().includes(search.toLowerCase()))
  )??[]
  // Colores realmente presentes para la impresora elegida. Una impresora B/N solo tiene
  // negro, así que no tiene sentido mostrar Cian/Magenta/Amarillo ni la sección Color.
  const relevantes=supplies.data?.items.filter(item=>!printerId||item.impresora_id===printerId)??[]
  const coloresDisponibles=SUPPLY_COLORS.filter(c=>relevantes.some(item=>supplyColor(item.nombre)===c.value))
  const mostrarColor=coloresDisponibles.length>1
  // Si el color elegido deja de existir al cambiar de impresora, se limpia el filtro.
  useEffect(()=>{if(color&&!coloresDisponibles.some(c=>c.value===color))setColor('')},[printerId,supplies.data])// eslint-disable-line react-hooks/exhaustive-deps
  const activeFilters=[printerId,tipoSuministro,color].filter(Boolean).length
  const after=selected?type==='entrada'?selected.stock+quantity:selected.stock-quantity:0
  const insufficient=!!selected&&type==='salida'&&quantity>selected.stock
  return <><PageHeader eyebrow="Acción rápida" title="Registrar movimiento" description={selected?undefined:'Escanea el UPC o encuentra el suministro por nombre.'}/>
    <div className="mx-auto grid max-w-2xl gap-4">
      {!selected?<Card>
        <div className="flex gap-2">
          <label className="relative flex-1"><Search className="absolute left-3.5 top-3 text-muted" size={18}/><Input className="pl-11" placeholder="Nombre, SKU o UPC" value={search} onChange={e=>setSearch(e.target.value)}/></label>
          <Button variant={scanning?'default':'secondary'} size="icon" onClick={()=>setScanning(!scanning)} aria-label={scanning?'Cerrar cámara':'Escanear UPC'}>{scanning?<X size={19}/>:<Camera size={19}/>}</Button>
          <Button variant={showFilters||activeFilters?'default':'secondary'} size="icon" className="relative" onClick={()=>setShowFilters(!showFilters)} aria-label="Filtros"><SlidersHorizontal size={18}/>{activeFilters>0&&<span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-warn text-[10px] font-bold text-white">{activeFilters}</span>}</Button>
        </div>
        {scanning&&<div className="mt-4 overflow-hidden rounded-2xl border-2 border-ink bg-ink shadow-lift"><video ref={video} className="aspect-video w-full object-cover" muted/><p className="p-3 text-center text-xs text-white/80">Centra el código dentro de la imagen.</p></div>}
        {showFilters&&<div className="mt-4 grid gap-4 rounded-2xl bg-canvas p-4">
          <div><p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Impresora</p><div className="flex flex-wrap gap-2">{printers.data?.map(p=><Chip key={p.id} active={printerId===p.id} onClick={()=>setPrinterId(printerId===p.id?0:p.id)}>{p.nombre_para_mostrar}</Chip>)}</div></div>
          <div><p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Tipo</p><div className="flex flex-wrap gap-2">{SUPPLY_TYPES.map(t=><Chip key={t.value} active={tipoSuministro===t.value} onClick={()=>setTipoSuministro(tipoSuministro===t.value?'':t.value)}>{t.label}</Chip>)}</div></div>
          {mostrarColor&&<div><p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Color</p><div className="flex flex-wrap gap-2">{coloresDisponibles.map(c=><Chip key={c.value} active={color===c.value} onClick={()=>setColor(color===c.value?'':c.value)}><span className="h-2.5 w-2.5 rounded-full border border-white/40" style={{background:c.dot}}/>{c.label}</Chip>)}</div></div>}
        </div>}
        <div className="mt-4 grid max-h-[22rem] grid-cols-1 gap-2 overflow-y-auto">
          {supplies.isLoading&&<p className="empty-note">Cargando suministros…</p>}
          {!matches.length&&supplies.data&&<p className="empty-note">Ningún suministro coincide con la búsqueda o los filtros.</p>}
          {matches.map(item=><button type="button" key={item.id} onClick={()=>setSupplyId(item.id)} className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-ink/40 hover:shadow-card">{item.picture_url?<img src={item.picture_url} alt="" className="h-11 w-11 shrink-0 rounded-lg bg-canvas object-contain p-1"/>:<span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-soft text-muted"><Boxes size={18}/></span>}<span className="min-w-0 flex-1"><strong className="block truncate text-sm text-ink">{item.nombre}</strong><small className="block truncate text-xs text-muted">{supplyMeta(item)}</small></span><StockBadge stock={item.stock} minimum={item.stock_minimo}/></button>)}
        </div>
      </Card>
      :<>
      <Card className="flex items-center gap-4 p-4">
        {selected.picture_url?<img src={selected.picture_url} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-canvas object-contain p-1.5"/>:<span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brand-soft text-muted"><Boxes size={24}/></span>}
        <div className="min-w-0 flex-1"><strong className="block truncate text-ink">{selected.nombre}</strong><small className="block truncate text-xs text-muted">{supplyMeta(selected)}</small><div className="mt-1.5"><StockBadge stock={selected.stock} minimum={selected.stock_minimo}/></div></div>
        <Button variant="secondary" size="sm" onClick={()=>setSupplyId(0)}>Cambiar</Button>
      </Card>
      <Card>
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-canvas p-1.5">
          <button type="button" onClick={()=>setType('entrada')} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${type==='entrada'?'bg-surface text-good shadow-card':'text-muted hover:text-ink'}`}><ArrowDownLeft size={18}/>Entrada</button>
          <button type="button" onClick={()=>setType('salida')} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${type==='salida'?'bg-surface text-bad shadow-card':'text-muted hover:text-ink'}`}><ArrowUpRight size={18}/>Salida</button>
        </div>
        <p className="mt-1.5 text-center text-xs text-muted">{type==='entrada'?'Agregar piezas al stock':'Retirar piezas del stock'}</p>
        <div className="mx-auto mt-5 flex max-w-xs items-center gap-3">
          <button type="button" onClick={()=>setQuantity(q=>Math.max(1,q-1))} aria-label="Disminuir cantidad" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink shadow-card transition hover:bg-canvas active:scale-95"><Minus size={18}/></button>
          <Input type="number" inputMode="numeric" min="1" max="9999" aria-label="Cantidad" value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(9999,Number(e.target.value)||1)))} className="h-12 text-center font-mono text-xl font-bold"/>
          <button type="button" onClick={()=>setQuantity(q=>Math.min(9999,q+1))} aria-label="Aumentar cantidad" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink shadow-card transition hover:bg-canvas active:scale-95"><Plus size={18}/></button>
        </div>
        <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-canvas p-4 font-mono text-lg font-bold"><span className="text-muted">{selected.stock}</span><span className="text-muted">→</span><span className={insufficient?'text-bad':type==='entrada'?'text-good':'text-ink'}>{after}</span></div>
        {insufficient&&<p className="mt-3 rounded-xl border border-warn-line bg-warn-soft p-3 text-sm font-medium text-warn">No hay piezas suficientes: el stock actual es {selected.stock}.</p>}
        <Button variant="primary" className="mt-5 w-full" onClick={()=>create.mutate()} disabled={create.isPending||quantity<1||quantity>9999||insufficient}>{create.isPending?'Registrando…':`Confirmar ${type}`}</Button>
      </Card>
      </>}
    </div>
  </>
}

export function TransactionsPage(){
  const [type,setType]=useState('');const [printerId,setPrinterId]=useState('');const [tipoSuministro,setTipoSuministro]=useState('');const [color,setColor]=useState('')
  const printers=useQuery({queryKey:['printers'],queryFn:()=>api<Printer[]>('/pms/impresoras')})
  const transactions=useQuery({queryKey:['transactions',type],queryFn:()=>api<Page<Transaction>>(`/pms/transacciones?page_size=100&tipo=${type}`)})
  const items=(transactions.data?.items??[]).filter(tx=>
    (!printerId||tx.suministro.impresora_id===Number(printerId))&&
    (!tipoSuministro||tx.suministro.tipo_suministro===tipoSuministro)&&
    (!color||supplyColor(tx.suministro.nombre)===color))
  return <><PageHeader eyebrow="Trazabilidad" title="Movimientos" description="Entradas, salidas y reversiones en orden cronológico." action={<Button asChild variant="primary" size="icon"><Link to="/movimientos/nuevo"><span className="sr-only">Nuevo movimiento</span><Plus/></Link></Button>}/>
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <FilterSelect value={type} onChange={e=>setType(e.target.value)} aria-label="Filtrar por movimiento"><option value="">Todos los movimientos</option><option value="entrada">Entradas</option><option value="salida">Salidas</option><option value="reversion_entrada">Reversiones de entrada</option><option value="reversion_salida">Reversiones de salida</option></FilterSelect>
      <FilterSelect value={printerId} onChange={e=>setPrinterId(e.target.value)} aria-label="Filtrar por impresora"><option value="">Todas las impresoras</option>{printers.data?.map(p=><option key={p.id} value={p.id}>{p.nombre_para_mostrar}</option>)}</FilterSelect>
      <FilterSelect value={tipoSuministro} onChange={e=>setTipoSuministro(e.target.value)} aria-label="Filtrar por tipo de suministro"><option value="">Todos los tipos</option>{SUPPLY_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</FilterSelect>
      <FilterSelect value={color} onChange={e=>setColor(e.target.value)} aria-label="Filtrar por color"><option value="">Todos los colores</option>{SUPPLY_COLORS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</FilterSelect>
    </div>
    {transactions.isLoading?<Loading/>:items.length?<div className="grid grid-cols-1 gap-3">{items.map(tx=><Link key={tx.id} to={`/movimientos/${tx.id}`}><Card className="flex items-center gap-4 p-4 transition hover:border-brand/40 hover:shadow-lift"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tx.tipo_transaccion.includes('salida')?'bg-bad-soft text-bad':'bg-good-soft text-good'}`}>{tx.tipo_transaccion.includes('salida')?<ArrowUpRight/>:<ArrowDownLeft/>}</span><span className="min-w-0 flex-1"><strong className="block truncate text-ink">{tx.suministro.nombre}</strong><small className="text-muted">{movementLabel(tx.tipo_transaccion)} · {formatDate(tx.fecha)}</small><small className="block text-muted/80">{tx.usuario?.nombre||'Sistema'}</small></span><span className="text-right"><strong className="block font-mono text-lg text-ink">{tx.stock_despues}</strong><small className="font-mono text-muted">{tx.stock_antes} antes</small></span></Card></Link>)}</div>:<Empty title="Sin movimientos" description="Cambia los filtros o registra una entrada o salida para iniciar el historial."/>}
  </>
}

export function TransactionDetailPage(){
  const {id}=useParams();const navigate=useNavigate();const client=useQueryClient()
  const tx=useQuery({queryKey:['transaction',Number(id)],queryFn:()=>api<Transaction>(`/pms/transacciones/${id}`)})
  const latest=useQuery({queryKey:['transactions','latest'],queryFn:()=>api<Page<Transaction>>('/pms/transacciones?page_size=1')})
  const revert=useMutation({mutationFn:()=>api<Transaction>(`/pms/transacciones/${id}/revertir`,json('POST')),onSuccess:data=>{client.invalidateQueries();toast.success('Movimiento revertido');navigate(`/movimientos/${data.id}`)},onError:e=>toast.error(e.message)})
  if(tx.isLoading)return<Loading/>;if(!tx.data)return<ErrorState message={tx.error?.message}/>
  const item=tx.data;const reversible=latest.data?.items[0]?.id===item.id&&(item.tipo_transaccion==='entrada'||item.tipo_transaccion==='salida')
  return <><button onClick={()=>navigate(-1)} className="mb-5 flex min-h-11 items-center gap-2 text-sm font-semibold text-muted transition hover:text-ink"><ArrowLeft size={18}/>Volver</button><PageHeader eyebrow={`Movimiento #${item.id}`} title={movementLabel(item.tipo_transaccion)} description={formatDate(item.fecha)}/><div className="mx-auto max-w-2xl"><Card className="p-6"><div className="flex items-center justify-between border-b border-line pb-5"><div><p className="eyebrow">Suministro</p><h2 className="mt-1 text-xl font-bold tracking-tight text-ink">{item.suministro.nombre}</h2><p className="font-mono text-xs text-muted">{item.suministro.sku}</p></div><span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand"><History size={24}/></span></div><div className="my-7 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-canvas p-3"><span className="block text-xs text-muted">Antes</span><strong className="font-display text-3xl text-ink sm:text-4xl">{item.stock_antes}</strong></div><div className="rounded-xl bg-brand-soft p-3"><span className="block text-xs text-brand">Cantidad</span><strong className="font-display text-3xl text-brand sm:text-4xl">{item.cantidad_afectada}</strong></div><div className="rounded-xl bg-canvas p-3"><span className="block text-xs text-muted">Después</span><strong className="font-display text-3xl text-ink sm:text-4xl">{item.stock_despues}</strong></div></div><dl className="grid gap-3 border-t border-line pt-5 text-sm"><div className="flex justify-between"><dt className="text-muted">Registrado por</dt><dd className="font-semibold text-ink">{item.usuario?.nombre||'Sistema'}</dd></div>{item.transaccion_revertida_id&&<div className="flex justify-between"><dt className="text-muted">Revierte el movimiento</dt><dd className="text-ink">#{item.transaccion_revertida_id}</dd></div>}</dl>{reversible&&<Button variant="secondary" className="mt-6 w-full" onClick={()=>{if(confirm('¿Revertir el último movimiento?'))revert.mutate()}} disabled={revert.isPending}><RotateCcw/>Revertir movimiento</Button>}</Card></div></>
}
