import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(value?: string) {
  if (!value) return 'Sin datos'
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guatemala'
  }).format(new Date(value))
}

export function movementLabel(type: string) {
  return ({
    entrada: 'Entrada', salida: 'Salida', reversion_entrada: 'Reversión de entrada', reversion_salida: 'Reversión de salida'
  } as Record<string, string>)[type] ?? type
}

export const SUPPLY_TYPES = [
  { value: 'toner', label: 'Tóner' },
  { value: 'cartucho', label: 'Cartucho' },
  { value: 'otro', label: 'Otro' }
]

export const SUPPLY_COLORS = [
  { value: 'negro', label: 'Negro', dot: '#1c1b18', keywords: ['black', 'negro'] },
  { value: 'cian', label: 'Cian', dot: '#06b6d4', keywords: ['cyan', 'cian'] },
  { value: 'magenta', label: 'Magenta', dot: '#db2777', keywords: ['magenta'] },
  { value: 'amarillo', label: 'Amarillo', dot: '#f0b429', keywords: ['yellow', 'amarillo'] }
]

export function supplyColor(name: string) {
  const lower = name.toLowerCase()
  return SUPPLY_COLORS.find(color => color.keywords.some(keyword => lower.includes(keyword)))?.value ?? ''
}
