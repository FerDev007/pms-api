import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, ChevronRight, ClipboardList, Copy, Download, History, KeyRound, LogOut, Printer, UserRound, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api, json } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { Printer as PrinterModel, User } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/fields'
import { ThemeToggle } from '@/components/theme-toggle'
import { Empty, ErrorState, Loading, PageHeader } from '@/components/common'

const more=[{to:'/movimientos',label:'Historial de movimientos',icon:History},{to:'/catalogo/impresoras',label:'Modelos de impresora',icon:Printer},{to:'/mas/reporte',label:'Reporte de stock',icon:ClipboardList},{to:'/usuarios',label:'Usuarios',icon:UsersRound,superuser:true},{to:'/mas/cuenta',label:'Mi cuenta',icon:UserRound},{to:'/mas/descargas',label:'Aplicación Android',icon:Download}]
export function MorePage({user}:{user:User}){const items=more.filter(item=>!item.superuser||user.rol==='superuser');return<><PageHeader eyebrow="Administración" title="Más"/><div className="mx-auto grid max-w-2xl gap-3">{items.map(item=>{const Icon=item.icon;return<Link key={item.to} to={item.to}><Card className="flex min-h-20 items-center gap-4 p-4 transition hover:border-brand/40 hover:shadow-lift"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon size={20}/></span><strong className="flex-1 text-ink">{item.label}</strong><ChevronRight size={19} className="text-muted"/></Card></Link>})}</div></>}

export function AccountPage({user}:{user:User}){
  const[current,setCurrent]=useState('');const[next,setNext]=useState('')
  // Signing out clears the supabase session; App.tsx's listener swaps in the login screen.
  const change=useMutation({mutationFn:()=>api<void>('/pms/auth/change-password',json('POST',{password_actual:current,password_nuevo:next})),onSuccess:async()=>{toast.success('Contraseña actualizada. Ingresa de nuevo.');await supabase.auth.signOut()},onError:e=>toast.error(e.message)})
  const logout=useMutation({mutationFn:()=>supabase.auth.signOut()})
  return <><PageHeader eyebrow="Sesión" title="Mi cuenta"/><div className="mx-auto grid max-w-xl gap-5"><Card><div className="flex items-center gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-accent text-canvas"><UserRound/></span><div><h2 className="text-lg font-bold tracking-tight text-ink">{user.nombre}</h2><p className="font-mono text-xs text-muted">@{user.username}</p></div></div></Card><Card><h2 className="section-title mb-4">Apariencia</h2><ThemeToggle/></Card><Card><h2 className="section-title mb-4">Cambiar contraseña</h2><form className="grid gap-4" onSubmit={e=>{e.preventDefault();change.mutate()}}><Field label="Contraseña actual" type="password" value={current} onChange={e=>setCurrent(e.target.value)} required/><Field label="Nueva contraseña" type="password" minLength={8} value={next} onChange={e=>setNext(e.target.value)} required/><Button disabled={change.isPending}><KeyRound/>Guardar contraseña</Button></form></Card><Button variant="secondary" onClick={()=>logout.mutate()}><LogOut/>Cerrar sesión</Button></div></>
}

// Reporte para pegar en WhatsApp/Teams. Se ordena por id (el orden del catálogo) y no
// alfabéticamente: así el texto sale siempre igual y coincide con el que ya se envía a
// mano. `/pms/impresoras` viene ordenado por nombre para mostrar, de ahí el sort.
export const construirReporte=(impresoras:PrinterModel[])=>impresoras
  .slice().sort((a,b)=>a.id-b.id)
  .map(p=>{
    const items=(p.suministros??[]).slice().sort((a,b)=>a.id-b.id)
    if(!items.length)return null
    return `🖨️ ${p.nombre_para_mostrar}\n`+items.map(s=>`    - ${s.nombre} -> ${s.stock===0?'❌':s.stock}`).join('\n')
  })
  .filter(Boolean).join('\n\n')

async function copiarAlPortapapeles(texto:string){
  try{ if(navigator.clipboard?.writeText){ await navigator.clipboard.writeText(texto); return true } }catch{ /* cae al respaldo */ }
  // Respaldo para contextos sin Clipboard API o sin permiso (WebView de Android viejos).
  const area=document.createElement('textarea')
  area.value=texto; area.setAttribute('readonly',''); area.style.position='fixed'; area.style.top='-1000px'
  document.body.appendChild(area); area.select()
  const ok=document.execCommand('copy')
  document.body.removeChild(area)
  return ok
}

export function StockReportPage(){
  const printers=useQuery({queryKey:['printers'],queryFn:()=>api<PrinterModel[]>('/pms/impresoras')})
  const[copiado,setCopiado]=useState(false)
  const texto=useMemo(()=>printers.data?construirReporte(printers.data):'',[printers.data])
  const alCopiar=async()=>{
    if(!await copiarAlPortapapeles(texto)){toast.error('No pudimos copiar automáticamente. Selecciona el texto y cópialo a mano.');return}
    setCopiado(true);toast.success('Reporte copiado');setTimeout(()=>setCopiado(false),2000)
  }
  if(printers.isLoading)return<Loading label="Armando el reporte"/>
  if(!printers.data)return<ErrorState message={printers.error?.message} retry={()=>printers.refetch()}/>
  return <><PageHeader eyebrow="Existencias" title="Reporte de stock" description="Resumen por modelo listo para copiar y enviar. Un ❌ significa que no queda stock."/>
    <div className="mx-auto grid max-w-2xl gap-4">
      {texto
        ?<><Button variant="primary" className="w-full" onClick={alCopiar}>{copiado?<><Check/>Copiado</>:<><Copy/>Copiar al portapapeles</>}</Button>
          <Card className="p-0"><pre className="overflow-x-auto whitespace-pre p-5 font-mono text-sm leading-relaxed text-ink">{texto}</pre></Card></>
        :<Empty title="No hay nada que reportar" description="Registra modelos y suministros para generar el resumen."/>}
    </div></>
}

export function DownloadsPage(){
  const version=useQuery({queryKey:['apk-version'],queryFn:()=>api<{version:number;filename:string}>('/pms/apks/latest_version'),retry:false})
  // The APK lives in a private bucket, so the download needs an authenticated call to
  // mint a signed URL -- a plain <a href> would arrive without the bearer token.
  const download=useMutation({mutationFn:()=>api<{url:string}>('/pms/apks/download_apk'),onSuccess:d=>{window.location.href=d.url},onError:e=>toast.error(e.message)})
  if(version.isLoading)return<Loading/>;return<><PageHeader eyebrow="Compatibilidad" title="Aplicación Android" description="La PWA es la experiencia recomendada. Esta descarga se conserva para instalaciones anteriores."/><div className="mx-auto max-w-xl">{version.data?<Card className="p-8 text-center"><span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-brand"><Download size={30}/></span><h2 className="text-xl font-bold tracking-tight text-ink">Versión {version.data.version}</h2><p className="mt-2 font-mono text-xs text-muted">{version.data.filename}</p><Button variant="primary" className="mt-6 w-full" disabled={download.isPending} onClick={()=>download.mutate()}>{download.isPending?'Preparando…':'Descargar APK'}</Button></Card>:<Empty title="No hay APK disponible" description="La aplicación web instalable está lista para usarse desde el navegador."/>}</div></>
}
