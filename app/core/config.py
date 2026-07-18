from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict


load_dotenv()


class Settings(BaseSettings):
    database_url: str = "sqlite:///./pms.db"
    is_debug: bool = False
    apks_folder: str = "apks"
    session_secret: str = "change-me-in-production"
    collector_token: str = "change-me-collector-token"
    bootstrap_username: str = "admin"
    bootstrap_password: str = "admin12345"
    session_days: int = 7
    telemetry_stale_minutes: int = 15
    frontend_dist: str = "frontend/dist"

    model_config = SettingsConfigDict(
        env_file=".env",
        str_strip_whitespace=True,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def frontend_path(self) -> Path:
        return Path(self.frontend_dist)


settings = Settings()
