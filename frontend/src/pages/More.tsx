import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Download, History, KeyRound, LogOut, Printer, UserRound, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api, json } from '@/lib/api'
import type { User } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/fields'
import { Empty, Loading, PageHeader } from '@/components/common'

const more=[{to:'/movimientos',label:'Historial de movimientos',icon:History},{to:'/catalogo/impresoras',label:'Modelos de impresora',icon:Printer},{to:'/usuarios',label:'Usuarios',icon:UsersRound},{to:'/mas/cuenta',label:'Mi cuenta',icon:UserRound},{to:'/mas/descargas',label:'Aplicación Android',icon:Download}]
export function MorePage(){return<><PageHeader eyebrow="Administración" title="Más"/><div className="mx-auto grid max-w-2xl gap-3">{more.map(item=>{const Icon=item.icon;return<Link key={item.to} to={item.to}><Card className="flex min-h-20 items-center gap-4 p-4 transition hover:border-brand/40 hover:shadow-lift"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon size={20}/></span><strong className="flex-1 text-ink">{item.label}</strong><ChevronRight size={19} className="text-muted"/></Card></Link>})}</div></>}

export function AccountPage({user}:{user:User}){
  const client=useQueryClient();const[current,setCurrent]=useState('');const[next,setNext]=useState('')
  const change=useMutation({mutationFn:()=>api<void>('/pms/auth/change-password',json('POST',{password_actual:current,password_nuevo:next})),onSuccess:()=>{toast.success('Contraseña actualizada. Ingresa de nuevo.');client.setQueryData(['me'],null)},onError:e=>toast.error(e.message)})
  const logout=useMutation({mutationFn:()=>api<void>('/pms/auth/logout',json('POST')),onSuccess:()=>client.setQueryData(['me'],null)})
  return <><PageHeader eyebrow="Sesión" title="Mi cuenta"/><div className="mx-auto grid max-w-xl gap-5"><Card><div className="flex items-center gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-accent text-white"><UserRound/></span><div><h2 className="text-lg font-bold tracking-tight text-ink">{user.nombre}</h2><p className="font-mono text-xs text-muted">@{user.username}</p></div></div></Card><Card><h2 className="section-title mb-4">Cambiar contraseña</h2><form className="grid gap-4" onSubmit={e=>{e.preventDefault();change.mutate()}}><Field label="Contraseña actual" type="password" value={current} onChange={e=>setCurrent(e.target.value)} required/><Field label="Nueva contraseña" type="password" minLength={8} value={next} onChange={e=>setNext(e.target.value)} required/><Button disabled={change.isPending}><KeyRound/>Guardar contraseña</Button></form></Card><Button variant="secondary" onClick={()=>logout.mutate()}><LogOut/>Cerrar sesión</Button></div></>
}

export function DownloadsPage(){
  const version=useQuery({queryKey:['apk-version'],queryFn:()=>api<{version:number;filename:string}>('/pms/apks/latest_version'),retry:false})
  if(version.isLoading)return<Loading/>;return<><PageHeader eyebrow="Compatibilidad" title="Aplicación Android" description="La PWA es la experiencia recomendada. Esta descarga se conserva para instalaciones anteriores."/><div className="mx-auto max-w-xl">{version.data?<Card className="p-8 text-center"><span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-brand"><Download size={30}/></span><h2 className="text-xl font-bold tracking-tight text-ink">Versión {version.data.version}</h2><p className="mt-2 font-mono text-xs text-muted">{version.data.filename}</p><Button asChild variant="primary" className="mt-6 w-full"><a href="/pms/apks/download_apk">Descargar APK</a></Button></Card>:<Empty title="No hay APK disponible" description="La aplicación web instalable está lista para usarse desde el navegador."/>}</div></>
}
