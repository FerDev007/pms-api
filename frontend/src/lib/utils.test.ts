import { describe, expect, it } from 'vitest'
import { movementLabel } from './utils'

describe('movementLabel', () => {
  it('translates every movement type used by the API', () => {
    expect(movementLabel('entrada')).toBe('Entrada')
    expect(movementLabel('salida')).toBe('Salida')
    expect(movementLabel('reversion_entrada')).toBe('Reversión de entrada')
    expect(movementLabel('reversion_salida')).toBe('Reversión de salida')
  })
})
