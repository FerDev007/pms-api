import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, Search, UserCheck, UserRound, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { api, json } from '@/lib/api'
import type { Page, User } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/fields'
import { Empty, Loading, PageHeader } from '@/components/common'

function CreateUser({onDone}:{onDone:()=>void}){const client=useQueryClient();const[form,setForm]=useState({nombre:'',username:'',password:''});const save=useMutation({mutationFn:()=>api<User>('/pms/usuarios',json('POST',form)),onSuccess:()=>{client.invalidateQueries({queryKey:['users']});toast.success('Usuario creado');onDone()},onError:e=>toast.error(e.message)});return<form className="grid gap-4" onSubmit={e=>{e.preventDefault();save.mutate()}}><Field label="Nombre" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} required/><Field label="Usuario" autoCapitalize="none" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} required/><Field label="Contraseña temporal" type="password" minLength={8} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/><Button disabled={save.isPending}>Crear usuario</Button></form>}

export function UsersPage(){
  const client=useQueryClient();const[q,setQ]=useState('');const[open,setOpen]=useState(false);const[reset,setReset]=useState<User>();const[password,setPassword]=useState('')
  const users=useQuery({queryKey:['users',q],queryFn:()=>api<Page<User>>(`/pms/usuarios?page_size=100&q=${encodeURIComponent(q)}`)})
  const update=useMutation({mutationFn:({id,data}:{id:number;data:object})=>api<User>(`/pms/usuarios/${id}`,json('PATCH',data)),onSuccess:()=>{client.invalidateQueries({queryKey:['users']});toast.success('Usuario actualizado');setReset(undefined);setPassword('')},onError:e=>toast.error(e.message)})
  return <><PageHeader eyebrow="Acceso" title="Usuarios" description="Todas las cuentas tienen el mismo nivel de acceso." action={<Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="primary" size="icon"><Plus/><span className="sr-only">Nuevo usuario</span></Button></DialogTrigger><DialogContent><DialogHeader title="Nuevo usuario" description="La contraseña debe tener al menos ocho caracteres."/><CreateUser onDone={()=>setOpen(false)}/></DialogContent></Dialog>}/><label className="relative mb-5 block max-w-xl"><Search className="absolute left-3.5 top-3 text-muted" size={18}/><Input className="pl-11" placeholder="Buscar usuario" value={q} onChange={e=>setQ(e.target.value)}/></label>
    {users.isLoading?<Loading/>:users.data?.items.length?<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{users.data.items.map(user=><Card key={user.id} className="flex items-center gap-4 p-4"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${user.activo?'bg-brand-soft text-brand':'bg-canvas text-muted'}`}><UserRound/></span><span className="min-w-0 flex-1"><strong className="block truncate text-ink">{user.nombre}</strong><small className="font-mono text-muted">@{user.username}</small></span><Button variant="ghost" size="icon" onClick={()=>setReset(user)} aria-label="Restablecer contraseña"><KeyRound size={18}/></Button><Button variant="secondary" size="icon" onClick={()=>update.mutate({id:user.id,data:{activo:!user.activo}})} aria-label={user.activo?'Desactivar':'Activar'}>{user.activo?<UserCheck size={18}/>:<UserX size={18}/>}</Button></Card>)}</div>:<Empty title="Sin usuarios" description="No hay cuentas que coincidan con la búsqueda."/>}
    <Dialog open={!!reset} onOpenChange={value=>!value&&setReset(undefined)}>{reset&&<DialogContent><DialogHeader title="Restablecer contraseña" description={`Define una nueva contraseña para ${reset.nombre}. Se cerrarán sus sesiones abiertas.`}/><form className="grid gap-4" onSubmit={e=>{e.preventDefault();update.mutate({id:reset.id,data:{password}})}}><Field label="Nueva contraseña" type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/><Button disabled={update.isPending}>Guardar contraseña</Button></form></DialogContent>}</Dialog>
  </>
}
