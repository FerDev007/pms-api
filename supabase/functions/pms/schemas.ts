// Port of app/pms/schemes.py. The *Read / *Write split is preserved: only the write
// side needs runtime validation here, since reads come straight from Postgres.
import { z } from 'zod'

// Zod's built-in messages are English ("String must contain at least 3 character(s)")
// and they reach the user verbatim through the 422 `detail`. This error map translates
// every issue type once, instead of annotating each rule.
const mapaErrores: z.ZodErrorMap = (issue, _ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: 'Este dato es obligatorio' }
      }
      if (issue.expected === 'number') return { message: 'Debe ser un número' }
      if (issue.expected === 'boolean') return { message: 'Debe ser verdadero o falso' }
      if (issue.expected === 'string') return { message: 'Debe ser texto' }
      if (issue.expected === 'array') return { message: 'Debe ser una lista' }
      return { message: 'El valor no tiene el formato esperado' }

    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return issue.minimum === 1
          ? { message: 'No puede quedar vacío' }
          : { message: `Debe tener al menos ${issue.minimum} caracteres` }
      }
      if (issue.type === 'number') {
        return issue.inclusive
          ? { message: `Debe ser ${issue.minimum} o más` }
          : { message: `Debe ser mayor que ${issue.minimum}` }
      }
      if (issue.type === 'array') return { message: `Debe incluir al menos ${issue.minimum} elemento(s)` }
      break

    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `No puede pasar de ${issue.maximum} caracteres` }
      if (issue.type === 'number') {
        return issue.inclusive
          ? { message: `Debe ser ${issue.maximum} o menos` }
          : { message: `Debe ser menor que ${issue.maximum}` }
      }
      if (issue.type === 'array') return { message: `No puede incluir más de ${issue.maximum} elementos` }
      break

    case z.ZodIssueCode.invalid_enum_value:
      return { message: `Valor no permitido. Opciones: ${issue.options.join(', ')}` }

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'regex') return { message: 'Contiene caracteres que no se permiten' }
      if (issue.validation === 'email') return { message: 'No es un correo válido' }
      if (issue.validation === 'url') return { message: 'No es una dirección web válida' }
      return { message: 'El formato no es válido' }

    case z.ZodIssueCode.not_finite:
      return { message: 'Debe ser un número válido' }
  }

  // Deliberately never fall through to ctx.defaultError: that is Zod's English text.
  return { message: 'El valor no es válido' }
}

z.setErrorMap(mapaErrores)

// Field names come from the database (snake_case, Spanish). Shown to users as-is they
// read like debug output, so map them to proper labels.
const ETIQUETAS: Record<string, string> = {
  nombre: 'Nombre',
  nombre_para_mostrar: 'Nombre para mostrar',
  cantidad_alquiladas: 'Cantidad alquiladas',
  picture_url: 'Imagen',
  sku: 'SKU',
  upc: 'UPC',
  stock_minimo: 'Stock mínimo',
  tipo_suministro: 'Tipo de suministro',
  capacidad_paginas: 'Capacidad de páginas',
  productos_compatibles: 'Productos compatibles',
  impresora_id: 'Impresora',
  suministro_id: 'Suministro',
  cantidad_afectada: 'Cantidad',
  tipo_transaccion: 'Tipo de movimiento',
  username: 'Usuario',
  password: 'Contraseña',
  password_actual: 'Contraseña actual',
  password_nuevo: 'Contraseña nueva',
  activo: 'Estado',
  ip: 'Dirección IP',
  a_color: 'A color',
  items: 'Telemetría',
  impresora_en_sitio_id: 'Equipo',
  observada_en: 'Fecha de lectura',
  disponible: 'Disponibilidad',
}

export const etiquetaCampo = (ruta: (string | number)[]): string => {
  const campo = ruta.filter((p) => typeof p === 'string').pop() as string | undefined
  if (!campo) return 'El dato enviado'
  return ETIQUETAS[campo] ?? campo.replace(/_/g, ' ')
}

export const TIPO_TRANSACCION = ['entrada', 'salida', 'reversion_entrada', 'reversion_salida'] as const

export const usuarioCreate = z.object({
  username: z.string().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/, 'Solo se permiten letras, números, punto, guion y guion bajo'),
  nombre: z.string().min(2).max(160),
  password: z.string().min(8).max(128),
})

export const usuarioUpdate = z.object({
  nombre: z.string().min(2).max(160).optional(),
  activo: z.boolean().optional(),
  password: z.string().min(8).max(128).optional(),
})

export const passwordChange = z.object({
  password_actual: z.string().min(1),
  password_nuevo: z.string().min(8).max(128),
})

export const suministroWrite = z.object({
  nombre: z.string().min(2).max(255),
  sku: z.string().min(2).max(255),
  upc: z.string().min(4).max(255),
  stock_minimo: z.number().int().min(0).max(9999),
  tipo_suministro: z.string().min(2).max(255),
  capacidad_paginas: z.number().int().positive(),
  productos_compatibles: z.string().min(2).max(500),
  picture_url: z.string().max(500).default(''),
  impresora_id: z.number().int().positive(),
})

export const impresoraWrite = z.object({
  nombre: z.string().min(2).max(255),
  nombre_para_mostrar: z.string().min(2).max(255),
  picture_url: z.string().max(500).default(''),
  cantidad_alquiladas: z.number().int().min(0).default(0),
})

// Pydantic used IPvAnyAddress, which accepts v4 and v6.
const ipAddress = z.string().refine(
  (value) => z.string().ip({ version: 'v4' }).safeParse(value).success ||
             z.string().ip({ version: 'v6' }).safeParse(value).success,
  { message: 'Escribe una dirección IP válida, por ejemplo 10.250.36.170' },
)

export const impresoraEnSitioWrite = z.object({
  nombre: z.string().min(2).max(255),
  ip: ipAddress,
  a_color: z.boolean().default(false),
  impresora_id: z.number().int().positive(),
})

// Narrowed to entrada/salida exactly as TransaccionCreate did: reversals are only ever
// produced by the revertir endpoint, never requested directly.
export const transaccionCreate = z.object({
  suministro_id: z.number().int().positive(),
  cantidad_afectada: z.number().int().positive().max(9999),
  tipo_transaccion: z.enum(['entrada', 'salida'], {
    errorMap: () => ({ message: 'El movimiento debe ser una entrada o una salida' }),
  }),
})

const telemetriaItem = z.object({
  impresora_en_sitio_id: z.number().int().positive(),
  observada_en: z.string(),
  disponible: z.boolean(),
  error: z.string().nullable().default(null),
  nombre_dispositivo: z.string().nullable().default(null),
  serie: z.string().nullable().default(null),
  notificaciones: z.array(z.string()).default([]),
  toners: z.array(z.record(z.unknown())).default([]),
  cartucho: z.record(z.unknown()).nullable().default(null),
  consumo: z.record(z.unknown()).nullable().default(null),
})

export const telemetriaBatch = z.object({
  items: z.array(telemetriaItem).min(1).max(200),
})

export const listaSuministros = z.object({
  q: z.string().default(''),
  tipo: z.string().optional(),
  estado: z.enum(['bajo', 'agotado', 'normal']).optional(),
  impresora_id: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(50),
})

export const listaSimple = z.object({
  q: z.string().default(''),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(50),
})

export const listaTransacciones = z.object({
  tipo: z.string().optional(),
  suministro_id: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(30),
})
