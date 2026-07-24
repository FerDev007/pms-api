import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { emailFor, supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/fields'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  // Signing in updates the supabase session, which App.tsx is subscribed to -- no
  // need to prime the query cache here.
  const login = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: emailFor(username), password })
      if (!error) return
      // Distinguish "wrong password" from "could not reach the server". Showing the
      // credentials message for a network failure sends people to reset a password
      // that was never wrong.
      if (error.status === 400 || /invalid login|credentials/i.test(error.message)) {
        throw new Error('Usuario o contraseña incorrectos')
      }
      if (error.status === 429 || /rate limit|too many/i.test(error.message)) {
        throw new Error('Demasiados intentos. Espera un momento e inténtalo de nuevo.')
      }
      if (!error.status || error.status >= 500) {
        throw new Error('No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
      }
      throw new Error('No pudimos iniciar sesión. Inténtalo de nuevo.')
    }
  })
  return <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
    <div className="w-full max-w-md">
      <div className="mb-8 text-center"><img src="/pms-icon.svg" alt="" className="mx-auto h-16 w-16 rounded-2xl shadow-fab"/><h1 className="mt-4 text-3xl font-bold tracking-tight text-ink">PMS</h1><p className="eyebrow mt-1">Control de impresión</p></div>
      <Card className="p-6 shadow-float sm:p-8"><div className="mb-7"><h2 className="text-xl font-bold tracking-tight text-ink">Tu inventario, en orden.</h2><p className="mt-2 text-sm text-muted">Ingresa para revisar existencias, registrar movimientos y consultar tus equipos.</p></div>
        <form className="grid gap-4" onSubmit={event => {event.preventDefault(); login.mutate()}}>
          <Field label="Usuario" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required/>
          <div className="relative"><Field label="Contraseña" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute bottom-0 right-0 grid h-11 w-11 place-items-center text-muted hover:text-ink"><span className="sr-only">{show ? 'Ocultar' : 'Mostrar'}</span>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
          {login.error && <p role="alert" className="rounded-xl border border-bad-line bg-bad-soft p-3 text-sm font-medium text-bad">{login.error.message}</p>}
          <Button variant="primary" className="mt-2 w-full" disabled={login.isPending}>{login.isPending ? 'Ingresando…' : 'Ingresar'}</Button>
        </form>
      </Card>
    </div>
  </main>
}
