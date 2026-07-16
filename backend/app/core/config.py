"""Configuracion central del backend HelpDesk-GMP."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Entorno ---
    app_env: str = "dev"
    log_level: str = "INFO"

    # --- Base de datos ---
    database_url: str = "postgresql+asyncpg://helpdesk:helpdesk@postgres:5432/helpdesk"

    # --- Redis ---
    redis_url: str = "redis://redis:6379/0"

    # --- JWT ---
    jwt_secret: str = "cambia_esta_cadena_por_un_valor_largo_y_aleatorio_de_64_bytes"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    cookie_secure: bool = False

    # --- MinIO / S3 ---
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "helpdesk"
    minio_secret_key: str = "helpdesk12345"
    minio_bucket: str = "adjuntos"
    minio_use_ssl: bool = False

    # --- Web Push (VAPID) ---
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:admin@helpdesk.local"

    # --- Firebase Cloud Messaging (FCM) para push nativo en Android ---
    # Path al archivo de credenciales del service account de Firebase
    # Descargar desde: Firebase Console -> Project Settings -> Service Accounts
    firebase_credentials_path: str = ""

    # --- CORS ---
    cors_origins: list[str] = [
        "http://localhost:3000",
        "https://helpdesk.local",
        "http://192.168.1.9",
        "https://soporte.gmpredes.online",
    ]

    @property
    def is_dev(self) -> bool:
        return self.app_env == "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()