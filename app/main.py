from fastapi import FastAPI
from app.core.config import settings
from app.pms.service import ImpresoraService, SuministroService, TransaccionService
from app.pms.routers.impresora_router import impresora_router
from app.pms.routers.suministro_router import suministro_router
from app.pms.routers.transaccion_router import transaccion_router


def get_version():
    with open("VERSION") as f:
        return f.read().strip()


app = FastAPI(title="PMS API", debug=settings.is_debug, version=get_version())

app.include_router(impresora_router)
app.include_router(suministro_router)
app.include_router(transaccion_router)


impresora_service = ImpresoraService()
suministro_service = SuministroService()
transaccion_service = TransaccionService()
