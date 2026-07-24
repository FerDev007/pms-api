import { Boxes, Gauge, History, Menu, Plus, Printer, UserRound, UsersRound } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { User } from '@/lib/types'

const nav = [
  { to: '/', label: 'Inicio', icon: Gauge },
  { to: '/inventario', label: 'Inventario', icon: Boxes },
  { to: '/movimientos/nuevo', label: 'Movimiento', icon: Plus, primary: true },
  { to: '/equipos', label: 'Equipos', icon: Printer },
  { to: '/mas', label: 'Más', icon: Menu }
]

function NavItem({ item, desktop = false }: { item: typeof nav[number]; desktop?: boolean }) {
  const Icon = item.icon
  if (item.primary && !desktop) {
    return <NavLink to={item.to} aria-label={item.label} className="flex flex-col items-center justify-center"><span className="-mt-7 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-accent text-canvas shadow-fab transition active:scale-95"><Icon size={26}/></span><span className="mt-1 text-[10px] font-semibold text-muted">{item.label}</span></NavLink>
  }
  return <NavLink to={item.to} end={item.to === '/'} className={({isActive}) => `${desktop ? 'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold' : 'flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold'} transition ${isActive ? desktop ? 'bg-brand-soft text-brand' : 'text-brand' : 'text-muted hover:bg-canvas hover:text-ink'}`}>
    <Icon size={20}/><span>{item.label}</span>
  </NavLink>
}

export function AppLayout({ user }: { user: User }) {
  const location = useLocation()
  const navigate = useNavigate()
  return <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-line bg-surface/80 p-5 backdrop-blur-lg lg:flex lg:flex-col">
      <button onClick={() => navigate('/')} className="mb-10 flex items-center gap-3 text-left"><img src="/pms-icon.svg" alt="" className="h-11 w-11 rounded-xl shadow-card"/><div><div className="text-lg font-bold tracking-tight text-ink">PMS</div><div className="text-[11px] font-medium text-muted">Control de impresión</div></div></button>
      <nav className="grid gap-1.5">{nav.map(item => <NavItem key={item.to} item={item} desktop/>)}</nav>
      <div className="mt-5 grid gap-1.5 border-t border-line pt-5"><NavLink to="/movimientos" className={({isActive}) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-canvas hover:text-ink'}`}><History size={19}/>Historial</NavLink>{user.rol === 'superuser' && <NavLink to="/usuarios" className={({isActive}) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-canvas hover:text-ink'}`}><UsersRound size={19}/>Usuarios</NavLink>}</div>
      <button onClick={() => navigate('/mas/cuenta')} className="mt-auto flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-card transition hover:border-brand/40"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><UserRound size={17}/></span><span className="min-w-0"><strong className="block truncate text-sm text-ink">{user.nombre}</strong><span className="block truncate text-xs text-muted">@{user.username}</span></span></button>
    </aside>
    <main className="safe-bottom lg:col-start-2 lg:pb-10"><div key={location.pathname} className="page-enter mx-auto w-full max-w-6xl px-4 pb-8 pt-6 sm:px-7 lg:px-10 lg:pt-10"><Outlet/></div></main>
    <nav aria-label="Navegación principal" className="bottom-nav fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[26px] border border-line bg-surface/95 px-2 pt-2 shadow-float backdrop-blur-xl lg:hidden">{nav.map(item => <NavItem key={item.to} item={item}/>)}</nav>
  </div>
}
