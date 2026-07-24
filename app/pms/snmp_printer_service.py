"""Consulta de impresoras por SNMP (Printer MIB, RFC 3805) usando pysnmp.

Todo se lee por SNMP -- también las de color. Antes las de color raspaban el HTML de
su web interna, lo cual se rompía cuando cambiaba la página. Los suministros se
descubren recorriendo prtMarkerSuppliesDescription (43.11.1.1.6) para identificar qué
índice es cada color/tambor, en vez de asumir posiciones fijas.
"""

from typing import Optional

from pydantic import BaseModel
from pysnmp.hlapi.v3arch.asyncio import (
    CommunityData,
    ContextData,
    ObjectIdentity,
    ObjectType,
    SnmpEngine,
    UdpTransportTarget,
    get_cmd,
    walk_cmd,
)


class SuministroSMNP(BaseModel):
    nombre: str
    color: Optional[str] = None
    uso: Optional[int] = None  # porcentaje 0-100, o None si la impresora no lo informa


class ConsumoSMNP(BaseModel):
    impresiones_en_negro: int
    impresiones_en_color: Optional[int] = None
    total_impresiones: int


class SMNPData(BaseModel):
    nombre: str
    serie: str
    notificaciones: str
    toners: list[SuministroSMNP]
    cartucho: Optional[SuministroSMNP] = None
    consumo: ConsumoSMNP


# --- OIDs (Printer MIB estándar salvo los contadores Xerox) ---
NOMBRE_IMPRESORA = "1.3.6.1.2.1.1.5.0"           # sysName
NUMERO_SERIAL = "1.3.6.1.2.1.43.5.1.1.17.1"      # prtGeneralSerialNumber
NOTIFICACIONES = "1.3.6.1.2.1.43.18.1.1.8"       # prtAlertDescription (walk)
SUP_DESCRIPCION = "1.3.6.1.2.1.43.11.1.1.6"      # prtMarkerSuppliesDescription (walk)
SUP_NIVEL = "1.3.6.1.2.1.43.11.1.1.9"            # prtMarkerSuppliesLevel
SUP_CAPACIDAD = "1.3.6.1.2.1.43.11.1.1.8"        # prtMarkerSuppliesMaxCapacity
IMPRESIONES_TOTALES = "1.3.6.1.2.1.43.10.2.1.4.1.1"  # prtMarkerLifeCount
XEROX_IMPRESIONES_NEGRO = "1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.34"
XEROX_IMPRESIONES_COLOR = "1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.33"

COLORES = [
    ("negro", "Negro", ("black", "negro", "schwarz", "noir")),
    ("cian", "Cyan", ("cyan", "cian")),
    ("magenta", "Magenta", ("magenta",)),
    ("amarillo", "Amarillo", ("yellow", "amarillo", "gelb", "jaune")),
]
CARTUCHO_PALABRAS = ("drum", "tambor", "imaging", "smart kit", "kit", "cartridge", "cartucho", "maintenance", "mantenimiento")


class SNMPService:
    snmpEngine = SnmpEngine()
    a_color = False

    # ---------- utilidades ----------
    def _norm(self, oid) -> str:
        return str(oid).lstrip(".")

    def decode_hex(self, value) -> str:
        try:
            s = str(value)
            if s.startswith("0x"):
                return bytes.fromhex(s[2:]).decode("utf-8", errors="ignore")
            return s
        except Exception:
            return str(value)

    def _render(self, value) -> str:
        if value is None:
            return ""
        try:
            texto = value.prettyPrint()
        except Exception:
            texto = str(value)
        return self.decode_hex(texto)

    def _to_int(self, value) -> Optional[int]:
        try:
            return int(str(value).strip())
        except (TypeError, ValueError):
            return None

    def _porcentaje(self, nivel, capacidad) -> Optional[int]:
        """Nivel/capacidad -> porcentaje 0-100. Maneja los valores especiales del
        Printer MIB: -1 (otro), -2 (desconocido), -3 (parcial) => desconocido."""
        lv = self._to_int(nivel)
        mx = self._to_int(capacidad)
        if lv is None or lv < 0:
            return None
        if mx is not None and mx > 0:
            return max(0, min(100, round(lv / mx * 100)))
        # Capacidad desconocida: algunas impresoras ya reportan el nivel como porcentaje.
        if 0 <= lv <= 100:
            return lv
        return None

    async def query_oid(self, ip: str, oid) -> Optional[str]:
        """GET de un OID puntual -> valor renderizado, o None."""
        try:
            ei, es, _ex, vbs = await get_cmd(
                self.snmpEngine,
                CommunityData("public", mpModel=0),
                await UdpTransportTarget.create((ip, 161), timeout=3, retries=1),
                ContextData(),
                ObjectType(ObjectIdentity(self._norm(oid))),
            )
            if ei or es or not vbs:
                return None
            return self._render(vbs[0][1])
        except Exception:
            return None

    async def walk(self, ip: str, base_oid: str) -> list[str]:
        """Recorre un subárbol y devuelve los valores en orden de índice. Las columnas
        de una misma tabla se recorren en el mismo orden, así que se pueden combinar por
        posición sin depender del formato del OID."""
        valores: list[str] = []
        try:
            objetos = walk_cmd(
                self.snmpEngine,
                CommunityData("public", mpModel=0),
                await UdpTransportTarget.create((ip, 161), timeout=3, retries=1),
                ContextData(),
                ObjectType(ObjectIdentity(self._norm(base_oid))),
                lexicographicMode=False,
            )
            async for ei, es, _ex, vbs in objetos:
                if ei or es:
                    break
                for _oid, valor in vbs:
                    valores.append(self._render(valor))
        except Exception as e:
            print(f"Error en walk({base_oid}): {e}", flush=True)
        return valores

    # ---------- identidad ----------
    async def get_nombre_impresora(self, ip: str) -> str:
        return (await self.query_oid(ip, NOMBRE_IMPRESORA)) or ""

    async def get_serie(self, ip: str) -> str:
        return (await self.query_oid(ip, NUMERO_SERIAL)) or ""

    async def get_notificaciones(self, ip: str) -> str:
        avisos = [v for v in await self.walk(ip, NOTIFICACIONES) if v and v.strip()]
        return "|".join(avisos) if avisos else "No hay notificaciones."

    # ---------- suministros ----------
    async def _leer_suministros(self, ip: str) -> tuple[list[SuministroSMNP], Optional[SuministroSMNP]]:
        # Se recorren las tres columnas de prtMarkerSuppliesTable y se combinan por
        # posición (mismo orden de índice en las tres).
        descripciones = await self.walk(ip, SUP_DESCRIPCION)
        niveles = await self.walk(ip, SUP_NIVEL)
        capacidades = await self.walk(ip, SUP_CAPACIDAD)

        toners: list[SuministroSMNP] = []
        cartuchos: list[SuministroSMNP] = []
        for i, descripcion in enumerate(descripciones):
            d = (descripcion or "").lower()
            if not d:
                continue
            nivel = niveles[i] if i < len(niveles) else None
            capacidad = capacidades[i] if i < len(capacidades) else None
            uso = self._porcentaje(nivel, capacidad)

            color = next((etiqueta for _clave, etiqueta, palabras in COLORES if any(p in d for p in palabras)), None)
            es_toner = "toner" in d or "tóner" in d
            if color and es_toner:
                toners.append(SuministroSMNP(nombre="Tóner", color=color, uso=uso))
            elif es_toner and not color:  # mono: "Toner Cartridge"
                toners.append(SuministroSMNP(nombre="Tóner", color="Negro", uso=uso))
            elif "waste" in d or "residual" in d:
                continue  # depósito de residuos: no se muestra
            elif any(p in d for p in CARTUCHO_PALABRAS):
                cartuchos.append(SuministroSMNP(nombre="Cartucho", uso=uso))

        # Un tóner por color: algunas impresoras listan el mismo color dos veces (el
        # tóner y su tambor/kit, ambos con "toner" en la descripción). Nos quedamos con
        # el nivel más bajo, que es el consumible que realmente se gasta.
        por_color: dict[str, SuministroSMNP] = {}
        for t in toners:
            previo = por_color.get(t.color or "")
            uso_t = t.uso if t.uso is not None else 101
            if previo is None or uso_t < (previo.uso if previo.uso is not None else 101):
                por_color[t.color or ""] = t
        orden = {etiqueta: i for i, (_c, etiqueta, _p) in enumerate(COLORES)}
        toners_unicos = sorted(por_color.values(), key=lambda t: orden.get(t.color or "", 99))
        # cartucho: el más urgente (menor nivel conocido)
        cartucho = min(cartuchos, key=lambda c: c.uso if c.uso is not None else 101) if cartuchos else None
        return toners_unicos, cartucho

    async def get_consumo(self, ip: str) -> ConsumoSMNP:
        total = self._to_int(await self.query_oid(ip, IMPRESIONES_TOTALES)) or 0
        if self.a_color:
            color = self._to_int(await self.query_oid(ip, XEROX_IMPRESIONES_COLOR))
            negro = self._to_int(await self.query_oid(ip, XEROX_IMPRESIONES_NEGRO))
            if negro is None:
                negro = (total - color) if color is not None else total
            return ConsumoSMNP(impresiones_en_negro=negro, impresiones_en_color=color, total_impresiones=total)
        return ConsumoSMNP(impresiones_en_negro=total, total_impresiones=total)

    # ---------- entrada principal ----------
    async def get_snmp_data(self, ip: str) -> SMNPData:
        nombre = await self.get_nombre_impresora(ip)
        if not nombre:
            raise Exception("SNMP error: Error de conexión")
        serie = await self.get_serie(ip)
        notificaciones = await self.get_notificaciones(ip)
        toners, cartucho = await self._leer_suministros(ip)
        consumo = await self.get_consumo(ip)
        return SMNPData(
            nombre=nombre,
            serie=serie,
            notificaciones=notificaciones,
            toners=toners,
            cartucho=cartucho,
            consumo=consumo,
        )

    async def print_oid_info(self, ip: str) -> None:
        data = await self.get_snmp_data(ip)
        print(f"Nombre: {data.nombre}")
        print(f"Serie:  {data.serie}")
        for n in data.notificaciones.split("|"):
            print(f"Aviso:  {n}")
        for t in data.toners:
            print(f"Tóner {t.color}: {t.uso}%")
        if data.cartucho:
            print(f"Cartucho: {data.cartucho.uso}%")
        print(f"Impresiones negro={data.consumo.impresiones_en_negro} color={data.consumo.impresiones_en_color} total={data.consumo.total_impresiones}")


class XeroxBWPrinterService(SNMPService):
    a_color = False


class XeroxColorPrinterService(SNMPService):
    a_color = True


# Prueba local (una máquina en la red de las impresoras):
#   import asyncio
#   asyncio.run(XeroxColorPrinterService().print_oid_info("10.250.36.87"))
