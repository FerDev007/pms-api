from fastapi import FastAPI
from app.core.config import settings
from app.pms.service import ImpresoraService, SuministroService, TransaccionService
from app.pms.router import (
    impresora_router,
    impresora_en_sitio_router,
    suministro_router,
    transaccion_router,
    apk_router,
)


def get_version():
    with open("VERSION") as f:
        return f.read().strip()


app = FastAPI(title="PMS API", debug=settings.is_debug, version=get_version())

app.include_router(impresora_router)
app.include_router(impresora_en_sitio_router)
app.include_router(suministro_router)
app.include_router(transaccion_router)
app.include_router(apk_router)


impresora_service = ImpresoraService()
suministro_service = SuministroService()
transaccion_service = TransaccionService()
