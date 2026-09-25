"""Configuracion central del backend HelpDesk-GMP."""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Entorno ---
    app_env: str = "dev"
    log_level: str = "INFO"
    app_timezone: str = "America/Bogota"

    # --- Base de datos ---
    database_url: str = "postgresql+asyncpg://helpdesk:helpdesk@postgres:5432/helpdesk"

    # --- Redis ---
    redis_url: str = "redis://redis:6379/0"

    # --- JWT ---
    jwt_secret: str = "cambia_esta_cadena_por_un_valor_largo_y_aleatorio_de_64_bytes"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 1
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

    # --- Supabase REST (sincronizacion de sedes/puntos de venta) ---
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # --- SLA ---
    sla_frt_horas: float = 0.5
    sla_mttr_horas: float = 24.0
    sla_mttr_remoto_horas: float = 48.0
    sla_mttr_torre_celda_horas: float = 4.0
    sla_mttr_media_horas: float = 96.0
    sla_mttr_baja_horas: float = 144.0
    sla_ciudades_base: list[str] = [
        "Manizales",
        "Villamaría",
        "Chinchiná",
        "Neira",
        "Palestina",
        "Anserma",
        "Belalcázar",
        "Viterbo",
        "San José",
    ]

    # --- Resend (emails transaccionales) ---
    resend_api_key: str = ""
    resend_from_email: str = "HelpDesk <noreply@helpdesk.local>"
    resend_urgent_recipients: str = ""

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


_DEFAULT_JWT_SECRET = "cambia_esta_cadena_por_un_valor_largo_y_aleatorio_de_64_bytes"
_DEFAULT_MINIO_SECRET = "helpdesk12345"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.app_env == "prod":
        if s.jwt_secret == _DEFAULT_JWT_SECRET or len(s.jwt_secret) < 32:
            raise RuntimeError(
                "JWT_SECRET inseguro en prod: usa un valor aleatorio de al menos 32 chars "
                '(python -c "import secrets; print(secrets.token_urlsafe(64))")'
            )
        if s.minio_secret_key == _DEFAULT_MINIO_SECRET:
            raise RuntimeError(
                "MINIO_SECRET_KEY inseguro en prod: cambia la credencial por defecto"
            )
    return s


settings = get_settings()
