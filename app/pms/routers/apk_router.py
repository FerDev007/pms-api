from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import os
from app.core.config import settings

apk_router = APIRouter(
    prefix="/pms/apks",
    tags=["apks"],
)


def get_latest_apk_path() -> str:
    # Get all APK files

    apk_files = [f for f in os.listdir(settings.apks_folder) if f.endswith(".apk")]
    if not apk_files:
        raise HTTPException(status_code=404, detail="No APK files found")

    # Get the latest APK by version number in filename
    latest_apk = max(apk_files, key=lambda f: int(f.split("_")[1].split(".")[0]))

    return os.path.join(settings.apks_folder, latest_apk)


@apk_router.get("/download_apk")
async def download_apk():
    latest_apk = get_latest_apk_path()
    return FileResponse(
        path=latest_apk,
        media_type="application/vnd.android.package-archive",
    )


@apk_router.get("/latest_version")
async def get_latest_version() -> dict[str, int]:
    latest_apk = get_latest_apk_path()
    filename = os.path.basename(latest_apk)
    version = int(filename.split("_")[1].split(".")[0])

    return {"version": version}
