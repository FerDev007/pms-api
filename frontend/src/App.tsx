import { lazy, Suspense, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import type { Session } from '@supabase/supabase-js'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/types'
import { Loading } from '@/components/common'
import { AppLayout } from '@/components/layout'
import { LoginPage } from '@/pages/Login'
import { ForcePasswordPage } from '@/pages/ForcePassword'

const DashboardPage = lazy(() => import('@/pages/Dashboard').then(m => ({default:m.DashboardPage})))
const InventoryPage = lazy(() => import('@/pages/Inventory').then(m => ({default:m.InventoryPage})))
const SupplyDetailPage = lazy(() => import('@/pages/Inventory').then(m => ({default:m.SupplyDetailPage})))
const MovementPage = lazy(() => import('@/pages/Transactions').then(m => ({default:m.MovementPage})))
const TransactionsPage = lazy(() => import('@/pages/Transactions').then(m => ({default:m.TransactionsPage})))
const TransactionDetailPage = lazy(() => import('@/pages/Transactions').then(m => ({default:m.TransactionDetailPage})))
const SitesPage = lazy(() => import('@/pages/Sites').then(m => ({default:m.SitesPage})))
const SiteDetailPage = lazy(() => import('@/pages/Sites').then(m => ({default:m.SiteDetailPage})))
const PrintersPage = lazy(() => import('@/pages/Printers').then(m => ({default:m.PrintersPage})))
const UsersPage = lazy(() => import('@/pages/Users').then(m => ({default:m.UsersPage})))
const MorePage = lazy(() => import('@/pages/More').then(m => ({default:m.MorePage})))
const StockReportPage = lazy(() => import('@/pages/More').then(m => ({default:m.StockReportPage})))
const AccountPage = lazy(() => import('@/pages/More').then(m => ({default:m.AccountPage})))
const DownloadsPage = lazy(() => import('@/pages/More').then(m => ({default:m.DownloadsPage})))

export default function App() {
  const client = useQueryClient()
  // undefined = still resolving the stored session, null = signed out.
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) client.clear()
    })
    return () => listener.subscription.unsubscribe()
  }, [client])

  // The profile still comes from the API: it carries `nombre`/`activo`, and a 401 here
  // is what surfaces an account deactivated after its token was issued.
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/pms/auth/me'), retry: false, enabled: !!session })
  if (session === undefined || (session && me.isPending)) return <Loading label="Preparando PMS"/>
  if (!session || !me.data) return <><LoginPage/><Toaster position="top-center" richColors/></>
  // Cambio de contraseña obligatorio en el primer ingreso: bloquea la app hasta hacerlo.
  if (me.data.debe_cambiar_password) return <><ForcePasswordPage user={me.data}/><Toaster position="top-center" richColors/></>
  return <>
    <Suspense fallback={<Loading label="Abriendo vista"/>}><Routes>
      <Route element={<AppLayout user={me.data}/>}>
        <Route index element={<DashboardPage/>}/>
        <Route path="inventario" element={<InventoryPage/>}/>
        <Route path="inventario/:id" element={<SupplyDetailPage/>}/>
        <Route path="movimientos/nuevo" element={<MovementPage/>}/>
        <Route path="movimientos" element={<TransactionsPage/>}/>
        <Route path="movimientos/:id" element={<TransactionDetailPage/>}/>
        <Route path="equipos" element={<SitesPage/>}/>
        <Route path="equipos/:id" element={<SiteDetailPage/>}/>
        <Route path="catalogo/impresoras" element={<PrintersPage/>}/>
        <Route path="usuarios" element={me.data.rol === 'superuser' ? <UsersPage/> : <Navigate to="/" replace/>}/>
        <Route path="mas" element={<MorePage user={me.data}/>}/>
        <Route path="mas/reporte" element={<StockReportPage/>}/>
        <Route path="mas/cuenta" element={<AccountPage user={me.data}/>}/>
        <Route path="mas/descargas" element={<DownloadsPage/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Route>
    </Routes></Suspense>
    <Toaster position="top-center" toastOptions={{style: {background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-ink))', borderColor: 'rgb(var(--c-line))', borderRadius: '14px', boxShadow: '0 16px 32px -16px rgba(0,0,0,.28)'}}}/>
  </>
}
