import { lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { api } from '@/lib/api'
import type { User } from '@/lib/types'
import { Loading } from '@/components/common'
import { AppLayout } from '@/components/layout'
import { LoginPage } from '@/pages/Login'

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
const AccountPage = lazy(() => import('@/pages/More').then(m => ({default:m.AccountPage})))
const DownloadsPage = lazy(() => import('@/pages/More').then(m => ({default:m.DownloadsPage})))

export default function App() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/pms/auth/me'), retry: false })
  if (me.isLoading) return <Loading label="Preparando PMS"/>
  if (!me.data) return <><LoginPage/><Toaster position="top-center" richColors/></>
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
        <Route path="usuarios" element={<UsersPage/>}/>
        <Route path="mas" element={<MorePage/>}/>
        <Route path="mas/cuenta" element={<AccountPage user={me.data}/>}/>
        <Route path="mas/descargas" element={<DownloadsPage/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Route>
    </Routes></Suspense>
    <Toaster position="top-center" toastOptions={{style: {background: '#ffffff', color: '#1c1b18', borderColor: '#e7e3da', borderRadius: '14px', boxShadow: '0 16px 32px -16px rgba(28,27,24,.2)'}}}/>
  </>
}
