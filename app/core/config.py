from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

load_dotenv(override=True)


class Settings(BaseSettings):
    database_url: str
    is_debug: bool
    apks_folder: str
    db_driver: str
    db_server: str
    db_port: int
    db_database: str
    db_uid: str
    db_pwd: str
    model_config = SettingsConfigDict(
        env_file=".env",
        str_strip_whitespace=True,
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


# global singleton to use as settings
settings = Settings()
