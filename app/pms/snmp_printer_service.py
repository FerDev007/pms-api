import asyncio, subprocess, re, httpx
from bs4 import BeautifulSoup
import urllib3
from pysnmp.hlapi.v3arch.asyncio import *
from typing import Optional
from pydantic import BaseModel


class BandejaSMNP(BaseModel):
    nombre: str
    uso: int
    uso_msg: str


# Cyan", "Magenta", "Amarillo", "Negro"
class SuministroSMNP(BaseModel):
    nombre: str
    color: Optional[str] = None
    uso: int


class ConsumoSMNP(BaseModel):
    impresiones_en_negro: int
    impresiones_en_color: Optional[int] = None
    total_impresiones: int


class SMNPData(BaseModel):
    nombre: str
    serie: str
    notificaciones: str
    bandejas: list[BandejaSMNP]
    toners: list[SuministroSMNP]
    cartucho: SuministroSMNP
    consumo: ConsumoSMNP


class SNMPService:
    snmpEngine = SnmpEngine()
    NOMBRE_IMPRESORA = "1.3.6.1.2.1.1.5.0"
    NUMERO_SERIAL = ".1.3.6.1.2.1.43.5.1.1.17.1"
    NOTIFICACIONES = "1.3.6.1.2.1.43.18.1.1.8.1"
    TONER_NEGRO_VALOR_RESTANTE = "1.3.6.1.2.1.43.11.1.1.9.1.1"
    TONER_NEGRO_CAPACIDAD = "1.3.6.1.2.1.43.11.1.1.8.1.1"

    NOMBRES_BANDEJAS = "1.3.6.1.2.1.43.8.2.1.13.1"
    BANDEJA_ESTATUS = "1.3.6.1.2.1.43.8.2.1.11.1.{bandeja_num}"
    BANDEJA_VALOR = "1.3.6.1.2.1.43.8.2.1.10.1.{bandeja_num}"
    BANDEJA_CAPACIDAD = "1.3.6.1.2.1.43.8.2.1.9.1.{bandeja_num}"
    BANDEJA_NOMBRE = "1.3.6.1.2.1.43.8.2.1.13.1.{bandeja_num}"

    IMPRESIONES_NEGRO = "1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.1"
    IMPRESIONES_TOTALES = "1.3.6.1.2.1.43.10.2.1.4.1.1"

    CARTUCHOS_VALOR_RESTANTE = [
        "1.3.6.1.2.1.43.11.1.1.9.1.5",
        "1.3.6.1.2.1.43.11.1.1.9.1.6",
    ]
    CARTUCHOS_CAPACIDAD = ["1.3.6.1.2.1.43.11.1.1.8.1.5", "1.3.6.1.2.1.43.11.1.1.8.1.6"]

    def obtener_restante_suministro(
        self, valor_restante: int, suministro_capacidad: int
    ) -> int:
        if suministro_capacidad == 0:
            return 0  # evitar división por cero
        porcentaje = (valor_restante / suministro_capacidad) * 100
        return int(porcentaje)

    def obtener_msg_uso_bandeja(self, uso_bandeja: int, capacidad_bandeja: int) -> str:
        # Calculate tray usage/level
        if uso_bandeja and capacidad_bandeja:
            if capacidad_bandeja > 0:
                usage_percent = (uso_bandeja / capacidad_bandeja) * 100
                usage_text = (
                    f"{usage_percent:.0f}% ({uso_bandeja}/{capacidad_bandeja} páginas)"
                )
            else:
                usage_text = f"{uso_bandeja}"
        elif uso_bandeja:
            usage_text = f"{uso_bandeja}"
        else:
            usage_text = "Vacia"

        return usage_text

    def obtener_porcentaje_uso_bandeja(
        self, uso_bandeja: int, capacidad_bandeja: int
    ) -> Optional[int]:
        """
        Retorna el porcentaje de uso de la bandeja como entero (0-100),
        o None si no se puede calcular (por ejemplo, capacidad desconocida o inválida).
        """
        try:
            if capacidad_bandeja > 0 and uso_bandeja >= 0:
                return int((uso_bandeja / capacidad_bandeja) * 100)
            else:
                return None
        except (ValueError, TypeError):
            return None

    async def query_oid(self, snmpEngine: SnmpEngine, ip: str, oid) -> Optional[str]:
        """Query a single OID and return the value"""
        try:
            iterator = get_cmd(
                snmpEngine,
                CommunityData("public", mpModel=0),
                await UdpTransportTarget.create((ip, 161)),
                ContextData(),
                ObjectType(ObjectIdentity(oid)),
            )
            errorIndication, errorStatus, errorIndex, varBinds = await iterator

            if errorIndication or errorStatus:
                return None
            return varBinds[0][1] if varBinds else None
        except:
            return None

    async def snmp_walk(
        self,
        ip: str,
        oid: str,
    ) -> str:
        """Execute snmpwalk and capture output"""
        try:
            cmd = ["snmpwalk", "-v2c", "-c", "public", "-t", "3", "-r", "0", ip, oid]

            # Run the command and capture output
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

            if result.returncode == 0:
                raw_result = result.stdout
                matches = re.findall(r'"(.*?)"', raw_result)
                result = "|".join(matches)
                return result
            else:
                print(f"SNMP error: {result.stderr}")
                return ""

        except subprocess.TimeoutExpired:
            print("SNMP command timed out")
            return ""
        except Exception as e:
            print(f"Error running snmpwalk: {e}")
            return ""

    def decode_hex(self, value) -> str:
        """Decode hex string to readable text"""
        try:
            val_str = str(value)
            if val_str.startswith("0x"):
                hex_data = val_str[2:]
                return bytes.fromhex(hex_data).decode("utf-8", errors="ignore")
            return val_str
        except:
            return str(value)

    def parse_trays(self, raw: str) -> list[str]:
        trays = raw.split("|")
        result = []

        for i, tray in enumerate(trays, start=1):
            tray = tray.strip()
            if tray.lower() == "bypass tray":
                result.append("Bandeja especial")
            else:
                result.append(f"Bandeja {i}")

        return result

    async def get_nombre_impresora(self, ip: str) -> str:
        nombre = await self.snmp_walk(ip=ip, oid=self.NOMBRE_IMPRESORA)
        return nombre

    async def get_serie(self, ip: str) -> str:
        serie = await self.snmp_walk(ip=ip, oid=self.NUMERO_SERIAL)
        return serie

    async def get_notificaciones(self, ip: str) -> list[str]:
        notificaciones = await self.snmp_walk(ip=ip, oid=self.NOTIFICACIONES)

        if notificaciones and notificaciones != "":
            notificaciones = self.decode_hex(notificaciones)
        else:
            notificaciones = "No hay notificaciones."

        return notificaciones

    async def get_bandejas(
        self,
        ip: str,
    ) -> list[BandejaSMNP]:

        bandejas_objs: list[BandejaSMNP] = []
        bandejas_str = await self.snmp_walk(ip, self.NOMBRES_BANDEJAS)
        bandejas = self.parse_trays(bandejas_str)

        for bandeja_num, bandeja_nombre in enumerate(bandejas, start=1):
            nivel_bandeja = await self.query_oid(
                self.snmpEngine, ip, self.BANDEJA_VALOR.format(bandeja_num=bandeja_num)
            )
            capacidad_bandeja = await self.query_oid(
                self.snmpEngine,
                ip,
                self.BANDEJA_CAPACIDAD.format(bandeja_num=bandeja_num),
            )
            porcentaje_uso = self.obtener_porcentaje_uso_bandeja(
                int(nivel_bandeja), int(capacidad_bandeja)
            )
            msg_porcentaje_uso = self.obtener_msg_uso_bandeja(
                int(nivel_bandeja), int(capacidad_bandeja)
            )
            bandeja = BandejaSMNP(
                nombre=bandeja_nombre,
                uso=porcentaje_uso,
                uso_msg=msg_porcentaje_uso,
            )
            bandejas_objs.append(bandeja)

        return bandejas_objs

    async def get_toners(self, ip: str) -> list[SuministroSMNP]:
        valor_restante = await self.query_oid(
            self.snmpEngine,
            ip,
            self.TONER_NEGRO_VALOR_RESTANTE,
        )
        valor_capacidad = await self.query_oid(
            self.snmpEngine,
            ip,
            self.TONER_NEGRO_CAPACIDAD,
        )

        return [
            SuministroSMNP(
                nombre="Toner ",
                color="Negro",
                uso=self.obtener_restante_suministro(
                    int(valor_restante), int(valor_capacidad)
                ),
            )
        ]

    async def get_cartucho(self, ip: str) -> SuministroSMNP:

        for capacidad, restante in zip(
            self.CARTUCHOS_CAPACIDAD, self.CARTUCHOS_VALOR_RESTANTE
        ):
            valor_restante = await self.query_oid(
                self.snmpEngine,
                ip,
                restante,
            )
            cartucho_capacidad = await self.query_oid(
                self.snmpEngine,
                ip,
                capacidad,
            )

            if valor_restante is None or cartucho_capacidad is None:
                continue

            return SuministroSMNP(
                nombre="Cartucho",
                uso=self.obtener_restante_suministro(
                    int(valor_restante), int(cartucho_capacidad)
                ),
            )

    async def get_consumo(self, ip: str) -> ConsumoSMNP:
        impresiones_negro = await self.query_oid(
            self.snmpEngine,
            ip,
            self.IMPRESIONES_NEGRO,
        )
        impresiones_totales = await self.query_oid(
            self.snmpEngine,
            ip,
            self.IMPRESIONES_TOTALES,
        )

        return ConsumoSMNP(
            impresiones_en_negro=int(impresiones_negro),
            total_impresiones=int(impresiones_totales),
        )

    async def print_oid_info(self, ip: str):
        nombre = await self.get_nombre_impresora(ip)
        serie = await self.get_serie(ip)
        notificaciones = await self.get_notificaciones(ip)
        toners = await self.get_toners(ip)
        cartucho = await self.get_cartucho(ip)
        bandejas = await self.get_bandejas(ip)
        consumo = await self.get_consumo(ip)
        data = SMNPData(
            nombre=nombre,
            serie=serie,
            notificaciones=notificaciones,
            toners=toners,
            bandejas=bandejas,
            cartucho=cartucho,
            consumo=consumo,
        )

        print(f"Nombre de la impresora: {nombre}")
        print(f"Numero de serie: {data.serie}")
        for notificacion in data.notificaciones.split("|"):
            print(f"Notificacion: {notificacion}")

        for bandeja in data.bandejas:
            print(
                f"bandeja {bandeja.nombre}, uso: {bandeja.uso}, uso_msg: {bandeja.uso_msg}"
            )
        for toner in data.toners:
            print(f"Toner {toner.color}, uso: {toner.uso}%")

        print(
            f"Impresiones en negro: {consumo.impresiones_en_negro}\nimpresiones en color: {consumo.impresiones_en_color}\ntotal impresiones: {consumo.total_impresiones}"
        )

    async def get_snmp_data(self, ip: str) -> SMNPData:
        nombre = await self.get_nombre_impresora(ip)
        if not nombre:
            raise Exception("SNMP error: Error de conexión")

        serie = await self.get_serie(ip)
        notificaciones = await self.get_notificaciones(ip)
        toners = await self.get_toners(ip)
        cartucho = await self.get_cartucho(ip)
        bandejas = await self.get_bandejas(ip)
        consumo = await self.get_consumo(ip)
        return SMNPData(
            nombre=nombre,
            serie=serie,
            notificaciones=notificaciones,
            toners=toners,
            bandejas=bandejas,
            cartucho=cartucho,
            consumo=consumo,
        )


class XeroxBWPrinterService(SNMPService):
    pass


class XeroxColorPrinterService(SNMPService):
    async def get_toners(self, ip: str) -> list[SuministroSMNP]:

        toners_objs: list[SuministroSMNP] = []
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        url = "https://10.250.36.87/stat/welcome.php?tab=status"
        response = httpx.get(url, verify=False)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            spans = soup.select("div.levelIndicatorPercentage > span")
            percentages_uso = [
                int(span.text.strip().replace("%", "")) for span in spans
            ]
            colores = ["Cyan", "Magenta", "Amarillo", "Negro"]
            for color, percentage_uso in zip(colores, percentages_uso):
                toners_objs.append(
                    SuministroSMNP(nombre="Toner", color=color, uso=percentage_uso)
                )

            return toners_objs
        else:
            print(f"Request failed with status code {response.status_code}")
            return []

    async def get_consumo(self, ip: str) -> ConsumoSMNP:
        impresiones_totales = await self.query_oid(
            self.snmpEngine,
            ip,
            self.IMPRESIONES_TOTALES,
        )
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        url = "https://10.250.36.87/stat/welcome.php?tab=status"
        response = httpx.get(url, verify=False)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            values = []
            for row in soup.find_all("tr"):
                cells = row.find_all("td")
                if len(cells) == 2:
                    label = cells[0].text.strip()
                    if label in ["Black Impressions", "Color Impressions"]:
                        value = int(cells[1].text.strip())
                        values.append(value)

            return ConsumoSMNP(
                impresiones_en_negro=values[0],
                impresiones_en_color=values[1],
                total_impresiones=impresiones_totales,
            )
        else:
            return ConsumoSMNP(
                impresiones_en_negro=0,
                impresiones_en_color=0,
                total_impresiones=0,
            )

    async def print_oid_info(self, ip: str):
        nombre = await self.get_nombre_impresora(ip)
        serie = await self.get_serie(ip)
        notificaciones = await self.get_notificaciones(ip)
        toners = await self.get_toners(ip)
        cartucho = await self.get_cartucho(ip)
        bandejas = await self.get_bandejas(ip)
        consumo = await self.get_consumo(ip)
        data = SMNPData(
            nombre=nombre,
            serie=serie,
            notificaciones=notificaciones,
            toners=toners,
            bandejas=bandejas,
            cartucho=cartucho,
            consumo=consumo,
        )

        print(f"Nombre de la impresora: {nombre}")
        print(f"Numero de serie: {data.serie}")
        for notificacion in data.notificaciones.split("|"):
            print(f"Notificacion: {notificacion}")

        for bandeja in data.bandejas:
            print(
                f"bandeja {bandeja.nombre}, uso: {bandeja.uso}, uso_msg: {bandeja.uso_msg}"
            )
        for toner in data.toners:
            print(f"Toner {toner.color}, uso: {toner.uso}%")

        print(
            f"Impresiones en negro: {consumo.impresiones_en_negro}\nimpresiones en color: {consumo.impresiones_en_color}\ntotal impresiones: {consumo.total_impresiones}"
        )

    async def get_snmp_data(self, ip: str) -> SMNPData:
        nombre = await self.get_nombre_impresora(ip)
        if not nombre:
            raise Exception("SNMP error: Error de conexión")

        serie = await self.get_serie(ip)
        notificaciones = await self.get_notificaciones(ip)
        bandejas = await self.get_bandejas(ip)
        toners = await self.get_toners(ip)
        cartucho = await self.get_cartucho(ip)
        consumos = await self.get_consumo(ip)

        return SMNPData(
            nombre=nombre,
            serie=serie,
            notificaciones=notificaciones,
            bandejas=bandejas,
            toners=toners,
            cartucho=cartucho,
            consumo=consumos,
        )


# service = XeroxBWPrinterService()
# asyncio.run(service.print_oid_info(ip="10.250.36.195"))

# print("------------" * 10)

# service = XeroxColorPrinterService()
# asyncio.run(service.print_oid_info(ip="10.250.36.87"))
