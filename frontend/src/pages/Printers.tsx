import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Printer as PrinterIcon, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, json } from '@/lib/api'
import type { Printer } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog'
import { Field } from '@/components/fields'
import { Empty, ErrorState, Loading, PageHeader } from '@/components/common'

function PrinterForm({printer,onDone}:{printer?:Printer;onDone:()=>void}){
  const client=useQueryClient();const[form,setForm]=useState({nombre:printer?.nombre||'',nombre_para_mostrar:printer?.nombre_para_mostrar||'',picture_url:printer?.picture_url||'',cantidad_alquiladas:printer?.cantidad_alquiladas||0})
  const save=useMutation({mutationFn:()=>api<Printer>(printer?`/pms/impresoras/${printer.id}`:'/pms/impresoras',json(printer?'PUT':'POST',form)),onSuccess:()=>{client.invalidateQueries({queryKey:['printers']});toast.success(printer?'Modelo actualizado':'Modelo creado');onDone()},onError:e=>toast.error(e.message)})
  return <form className="grid gap-4" onSubmit={e=>{e.preventDefault();save.mutate()}}><Field label="Nombre para mostrar" value={form.nombre_para_mostrar} onChange={e=>setForm({...form,nombre_para_mostrar:e.target.value})} required/><Field label="Modelos compatibles" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} required/><Field label="Cantidad alquilada" type="number" min="0" value={form.cantidad_alquiladas} onChange={e=>setForm({...form,cantidad_alquiladas:Number(e.target.value)})}/><Field label="URL de imagen" type="url" value={form.picture_url} onChange={e=>setForm({...form,picture_url:e.target.value})}/><Button disabled={save.isPending}>{save.isPending?'Guardando…':'Guardar modelo'}</Button></form>
}

export function PrintersPage(){
  const client=useQueryClient();const[create,setCreate]=useState(false);const[selected,setSelected]=useState<Printer>();const printers=useQuery({queryKey:['printers'],queryFn:()=>api<Printer[]>('/pms/impresoras')})
  const remove=useMutation({mutationFn:(id:number)=>api<void>(`/pms/impresoras/${id}`,json('DELETE')),onSuccess:()=>{client.invalidateQueries({queryKey:['printers']});setSelected(undefined);toast.success('Modelo eliminado')},onError:e=>toast.error(e.message)})
  return <><PageHeader eyebrow="Catálogo" title="Modelos de impresora" description="Familias de equipos y los suministros que comparten." action={<Dialog open={create} onOpenChange={setCreate}><DialogTrigger asChild><Button variant="primary" size="icon" aria-label="Nuevo modelo"><Plus/></Button></DialogTrigger><DialogContent><DialogHeader title="Nuevo modelo"/><PrinterForm onDone={()=>setCreate(false)}/></DialogContent></Dialog>}/>
    {printers.isLoading?<Loading/>:printers.error?<ErrorState message={printers.error.message}/>:printers.data?.length?<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{printers.data.map(item=><button key={item.id} className="text-left" onClick={()=>setSelected(item)}><Card className="h-full transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lift"><div className="flex gap-4">{item.picture_url?<img src={item.picture_url} alt="" className="h-24 w-24 shrink-0 rounded-xl bg-canvas object-contain p-2"/>:<span className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><PrinterIcon/></span>}<div className="min-w-0"><h2 className="text-lg font-bold tracking-tight text-ink">{item.nombre_para_mostrar}</h2><p className="mt-1 line-clamp-2 text-sm text-muted">{item.nombre}</p><p className="mt-3 font-mono text-xs text-muted">{item.suministros?.length||0} suministros</p></div></div></Card></button>)}</div>:<Empty title="Sin modelos" description="Crea el primer modelo de impresora."/>}
    <Dialog open={!!selected} onOpenChange={open=>!open&&setSelected(undefined)}>{selected&&<DialogContent><DialogHeader title={selected.nombre_para_mostrar} description={`${selected.suministros?.length||0} suministros asociados`}/><div className="mb-6 flex justify-end gap-2"><Button size="sm" variant="danger" onClick={()=>{if(confirm('¿Eliminar este modelo?'))remove.mutate(selected.id)}}><Trash2 size={16}/>Eliminar</Button></div><PrinterForm printer={selected} onDone={()=>setSelected(undefined)}/></DialogContent>}</Dialog>
  </>
}
