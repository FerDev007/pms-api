// Port of app/pms/schemes.py. The *Read / *Write split is preserved: only the write
// side needs runtime validation here, since reads come straight from Postgres.
import { z } from 'zod'

export const TIPO_TRANSACCION = ['entrada', 'salida', 'reversion_entrada', 'reversion_salida'] as const

export const usuarioCreate = z.object({
  username: z.string().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
  nombre: z.string().min(2).max(160),
  password: z.string().min(8).max(128),
})

export const usuarioUpdate = z.object({
  nombre: z.string().min(2).max(160).optional(),
  activo: z.boolean().optional(),
  password: z.string().min(8).max(128).optional(),
})

export const passwordChange = z.object({
  password_actual: z.string(),
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
  { message: 'Dirección IP inválida' },
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
  tipo_transaccion: z.enum(['entrada', 'salida']),
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
