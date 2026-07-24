import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { api, json } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/fields'

// Se muestra en vez de la app cuando debe_cambiar_password es true (primer ingreso).
// Al cambiarla, el backend limpia la bandera; invalidamos ['me'] para que App reevalúe.
export function ForcePasswordPage({ user }: { user: User }) {
  const client = useQueryClient()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const change = useMutation({
    mutationFn: async () => {
      if (next !== confirm) throw new Error('Las contraseñas nuevas no coinciden')
      await api<void>('/pms/auth/change-password', json('POST', { password_actual: current, password_nuevo: next }))
    },
    onSuccess: () => { toast.success('Contraseña actualizada'); client.invalidateQueries({ queryKey: ['me'] }) },
    onError: e => toast.error(e.message)
  })
  return <main className="grid min-h-screen place-items-center px-4 py-10">
    <div className="w-full max-w-md">
      <div className="mb-8 text-center"><img src="/pms-icon.svg" alt="" className="mx-auto h-16 w-16 rounded-2xl shadow-fab"/><h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Cambia tu contraseña</h1><p className="mt-2 text-sm text-muted">Hola {user.nombre}. Por seguridad, define una contraseña nueva antes de continuar.</p></div>
      <Card className="p-6 shadow-float sm:p-8">
        <form className="grid gap-4" onSubmit={e => { e.preventDefault(); change.mutate() }}>
          <Field label="Contraseña actual" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required/>
          <Field label="Contraseña nueva" type="password" autoComplete="new-password" minLength={8} value={next} onChange={e => setNext(e.target.value)} required/>
          <Field label="Repite la contraseña nueva" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} required/>
          <Button variant="primary" className="mt-2 w-full" disabled={change.isPending}><KeyRound/>{change.isPending ? 'Guardando…' : 'Guardar y continuar'}</Button>
        </form>
        <button type="button" onClick={() => supabase.auth.signOut()} className="mt-4 w-full text-center text-sm font-semibold text-muted transition hover:text-ink">Cerrar sesión</button>
      </Card>
    </div>
  </main>
}
