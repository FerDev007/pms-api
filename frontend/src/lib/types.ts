export type Rol = 'superuser' | 'admin'
export interface User { id: number; username: string; nombre: string; activo: boolean; creado_en: string; rol: Rol; debe_cambiar_password: boolean }
export interface Printer { id: number; nombre: string; nombre_para_mostrar: string; picture_url: string; cantidad_alquiladas: number; suministros?: Supply[] }
export interface Supply { id: number; nombre: string; sku: string; upc: string; stock: number; stock_minimo: number; tipo_suministro: string; capacidad_paginas: number; productos_compatibles: string; picture_url: string; impresora_id: number; impresora?: { nombre_para_mostrar: string } }
export interface Telemetry { observada_en: string; disponible: boolean; obsoleta: boolean; error?: string; nombre_dispositivo?: string; serie?: string; notificaciones: string[]; toners: Array<{nombre?: string; color?: string; uso?: number}>; cartucho?: {nombre?: string; uso?: number}; consumo?: {impresiones_en_negro?: number; impresiones_en_color?: number; total_impresiones?: number} }
export interface Site { id: number; nombre: string; ip: string; a_color: boolean; impresora: Printer; telemetria?: Telemetry }
export interface Transaction { id: number; suministro: Supply; usuario?: User; stock_antes: number; cantidad_afectada: number; stock_despues: number; tipo_transaccion: string; fecha: string; transaccion_revertida_id?: number }
export interface Page<T> { items: T[]; total: number; page: number; page_size: number }
export interface Dashboard { stock_total: number; suministros_total: number; stock_bajo: number; sin_stock: number; equipos: {total:number; disponibles:number; sin_conexion:number; obsoletos:number}; movimientos_recientes: Transaction[] }
