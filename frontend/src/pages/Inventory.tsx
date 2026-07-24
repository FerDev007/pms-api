import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Boxes, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api, json } from '@/lib/api'
import type { Page, Printer, Supply, Transaction } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field, FilterSelect, SelectField } from '@/components/fields'
import { Empty, ErrorState, Loading, PageHeader, StockBadge } from '@/components/common'
import { SUPPLY_COLORS, SUPPLY_TYPES, formatDate, movementLabel, supplyColor } from '@/lib/utils'

const emptySupply = {nombre:'', sku:'', upc:'', stock_minimo:2, tipo_suministro:'toner', capacidad_paginas:1000, productos_compatibles:'', picture_url:'', impresora_id:0}

function SupplyForm({ supply, onDone }: { supply?: Supply; onDone: () => void }) {
  const client = useQueryClient()
  const printers = useQuery({ queryKey:['printers'], queryFn:() => api<Printer[]>('/pms/impresoras') })
  const [form, setForm] = useState(supply ? {...supply} : emptySupply)
  const save = useMutation({
    mutationFn: () => api<Supply>(supply ? `/pms/suministros/${supply.id}` : '/pms/suministros', json(supply ? 'PUT' : 'POST', form)),
    onSuccess: data => { client.invalidateQueries({queryKey:['supplies']}); client.setQueryData(['supply', data.id], data); toast.success(supply ? 'Suministro actualizado' : 'Suministro creado'); onDone() },
    onError: error => toast.error(error.message)
  })
  const set = (key:string, value:string|number) => setForm(current => ({...current, [key]:value}))
  return <form onSubmit={event => {event.preventDefault(); save.mutate()}} className="grid gap-4">
    <div className="form-grid"><Field label="Nombre" value={form.nombre} onChange={e=>set('nombre',e.target.value)} required/><Field label="SKU" value={form.sku} onChange={e=>set('sku',e.target.value)} required/><Field label="UPC" value={form.upc} onChange={e=>set('upc',e.target.value)} required/><SelectField label="Tipo" value={form.tipo_suministro} onChange={e=>set('tipo_suministro',e.target.value)}><option value="toner">Tóner</option><option value="cartucho">Cartucho</option><option value="otro">Otro</option></SelectField><Field label="Stock mínimo" type="number" min="0" max="9999" value={form.stock_minimo} onChange={e=>set('stock_minimo',Number(e.target.value))} required/><Field label="Capacidad en páginas" type="number" min="1" value={form.capacidad_paginas} onChange={e=>set('capacidad_paginas',Number(e.target.value))} required/></div>
    <SelectField label="Modelo de impresora" value={form.impresora_id} onChange={e=>set('impresora_id',Number(e.target.value))} required><option value="">Selecciona un modelo</option>{printers.data?.map(p=><option key={p.id} value={p.id}>{p.nombre_para_mostrar}</option>)}</SelectField>
    <Field label="Productos compatibles" value={form.productos_compatibles} onChange={e=>set('productos_compatibles',e.target.value)} required/>
    <Field label="URL de imagen" type="url" value={form.picture_url} onChange={e=>set('picture_url',e.target.value)}/>
    <Button disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar suministro'}</Button>
  </form>
}

export function InventoryPage() {
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [state, setState] = useState(params.get('estado') || '')
  const [tipo, setTipo] = useState('')
  const [printerId, setPrinterId] = useState('')
  const [color, setColor] = useState('')
  const [open, setOpen] = useState(false)
  const printers = useQuery({ queryKey:['printers'], queryFn:()=>api<Printer[]>('/pms/impresoras') })
  const supplies = useQuery({ queryKey:['supplies',q,state,tipo,printerId], queryFn:()=>api<Page<Supply>>(`/pms/suministros?page_size=100${q?`&q=${encodeURIComponent(q)}`:''}${state?`&estado=${state}`:''}${tipo?`&tipo=${tipo}`:''}${printerId?`&impresora_id=${printerId}`:''}`) })
  const items = (supplies.data?.items ?? []).filter(item => !color || supplyColor(item.nombre) === color)
  return <>
    <PageHeader eyebrow="Almacén" title="Inventario" description="Cada pieza, su mínimo y el equipo que mantiene trabajando." action={<Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="primary" size="icon" aria-label="Nuevo suministro"><Plus/></Button></DialogTrigger><DialogContent><DialogHeader title="Nuevo suministro" description="El stock inicial será cero; registra una entrada para agregar piezas."/><SupplyForm onDone={()=>setOpen(false)}/></DialogContent></Dialog>}/>
    <div className="mb-5 grid gap-3">
      <label className="relative"><Search className="absolute left-3.5 top-3 text-muted" size={19}/><Input className="pl-11" placeholder="Buscar por nombre, SKU o UPC" value={q} onChange={e=>setQ(e.target.value)}/></label>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FilterSelect value={printerId} onChange={e=>setPrinterId(e.target.value)} aria-label="Filtrar por impresora"><option value="">Todas las impresoras</option>{printers.data?.map(p=><option key={p.id} value={p.id}>{p.nombre_para_mostrar}</option>)}</FilterSelect>
        <FilterSelect value={tipo} onChange={e=>setTipo(e.target.value)} aria-label="Filtrar por tipo"><option value="">Todos los tipos</option>{SUPPLY_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</FilterSelect>
        <FilterSelect value={color} onChange={e=>setColor(e.target.value)} aria-label="Filtrar por color"><option value="">Todos los colores</option>{SUPPLY_COLORS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</FilterSelect>
        <FilterSelect value={state} onChange={e=>setState(e.target.value)} aria-label="Filtrar por estado"><option value="">Todos los estados</option><option value="bajo">Stock bajo</option><option value="agotado">Agotados</option><option value="normal">Stock normal</option></FilterSelect>
      </div>
    </div>
    {supplies.isLoading ? <Loading/> : supplies.error ? <ErrorState message={supplies.error.message}/> : items.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(item=><Link key={item.id} to={`/inventario/${item.id}`} className="group"><Card className="h-full p-4 transition group-hover:-translate-y-0.5 group-hover:border-brand/40 group-hover:shadow-lift"><div className="flex gap-4">{item.picture_url ? <img src={item.picture_url} alt="" className="h-20 w-20 shrink-0 rounded-xl bg-canvas object-contain p-2"/> : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Boxes/></span>}<div className="min-w-0 flex-1"><h2 className="truncate text-base font-bold tracking-tight text-ink">{item.nombre}</h2><p className="mt-1 truncate text-xs text-muted">{item.impresora?.nombre_para_mostrar}</p><p className="mt-0.5 font-mono text-xs text-muted">{item.sku}</p><div className="mt-2.5"><StockBadge stock={item.stock} minimum={item.stock_minimo}/></div></div></div></Card></Link>)}</div> : <Empty title="No hay suministros aquí" description="Cambia los filtros o crea el primer suministro."/>}
  </>
}

export function SupplyDetailPage() {
  const {id} = useParams(); const navigate=useNavigate(); const client=useQueryClient(); const [edit,setEdit]=useState(false); const [confirm,setConfirm]=useState(false)
  const supply=useQuery({queryKey:['supply',Number(id)],queryFn:()=>api<Supply>(`/pms/suministros/${id}`)})
  const history=useQuery({queryKey:['transactions','supply',id],queryFn:()=>api<Page<Transaction>>(`/pms/transacciones?suministro_id=${id}&page_size=10`)})
  const remove=useMutation({mutationFn:()=>api<void>(`/pms/suministros/${id}`,json('DELETE')),onSuccess:()=>{client.invalidateQueries({queryKey:['supplies']});toast.success('Suministro eliminado');navigate('/inventario')},onError:e=>toast.error(e.message)})
  if(supply.isLoading)return <Loading/>; if(!supply.data)return <ErrorState message={supply.error?.message}/>
  const item=supply.data
  return <><button onClick={()=>navigate(-1)} className="mb-5 flex min-h-11 items-center gap-2 text-sm font-semibold text-muted transition hover:text-ink"><ArrowLeft size={18}/>Volver</button>
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{item.tipo_suministro} · {item.sku}</p><h1 className="page-title mt-1.5">{item.nombre}</h1></div><div className="flex gap-2"><Button variant="secondary" size="icon" onClick={()=>setEdit(true)} aria-label="Editar"><Pencil size={18}/></Button><Button variant="danger" size="icon" onClick={()=>setConfirm(true)} aria-label="Eliminar"><Trash2 size={18}/></Button></div></div>
    <div className="grid gap-5 md:grid-cols-[.7fr_1.3fr]"><Card className="grid place-items-center">{item.picture_url?<img src={item.picture_url} alt={item.nombre} className="max-h-64 w-full object-contain"/>:<Boxes size={80} className="text-brand/30"/>}</Card><Card><div className="flex items-end justify-between border-b border-line pb-5"><div><p className="eyebrow">Existencia actual</p><strong className="font-display text-6xl text-ink">{item.stock}</strong></div><StockBadge stock={item.stock} minimum={item.stock_minimo}/></div><dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted">Mínimo</dt><dd className="font-mono font-semibold text-ink">{item.stock_minimo}</dd></div><div><dt className="text-muted">Capacidad</dt><dd className="text-ink">{item.capacidad_paginas.toLocaleString()} páginas</dd></div><div><dt className="text-muted">UPC</dt><dd className="break-all font-mono text-ink">{item.upc}</dd></div><div><dt className="text-muted">Compatibilidad</dt><dd className="text-ink">{item.productos_compatibles}</dd></div></dl><Button asChild className="mt-6 w-full"><Link to={`/movimientos/nuevo?suministro=${item.id}`}>Registrar movimiento</Link></Button></Card></div>
    <section className="mt-8"><h2 className="section-title mb-3">Movimientos recientes</h2><div className="grid grid-cols-1 gap-2">{history.data?.items.length?history.data.items.map(tx=><Link key={tx.id} to={`/movimientos/${tx.id}`} className="row-card min-h-16 justify-between px-4"><span><strong className="block text-sm text-ink">{movementLabel(tx.tipo_transaccion)}</strong><small className="text-muted">{formatDate(tx.fecha)}</small></span><span className="font-mono text-ink">{tx.stock_antes} → {tx.stock_despues}</span></Link>):<p className="empty-note">Este suministro aún no tiene movimientos.</p>}</div></section>
    <Dialog open={edit} onOpenChange={setEdit}><DialogContent><DialogHeader title="Editar suministro"/><SupplyForm supply={item} onDone={()=>setEdit(false)}/></DialogContent></Dialog>
    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogHeader title="Eliminar suministro" description="Solo se puede eliminar si nunca ha tenido movimientos."/><div className="flex justify-end gap-2"><Button variant="secondary" onClick={()=>setConfirm(false)}>Cancelar</Button><Button variant="danger" onClick={()=>remove.mutate()} disabled={remove.isPending}>Eliminar</Button></div></DialogContent></Dialog>
  </>
}
