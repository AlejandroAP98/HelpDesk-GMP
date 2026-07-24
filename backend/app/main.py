"""Entry point de la aplicacion FastAPI HelpDesk-GMP."""

import asyncio
from contextlib import asynccontextmanager
import logging
import logging.config

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import adjuntos as adjuntos_router
from app.routers import auth as auth_router
from app.routers import categorias as categorias_router
from app.routers import comentarios as comentarios_router
from app.routers import empresas as empresas_router
from app.routers import push as push_router
from app.routers import matriz_prioridad as matriz_prioridad_router
from app.routers import metricas as metricas_router
from app.routers import reportes as reportes_router
from app.routers import respuestas_rapidas as respuestas_rapidas_router
from app.routers import stats as stats_router
from app.routers import subcategorias as subcategorias_router
from app.routers import tarea_pendiente as tarea_pendiente_router
from app.routers import tickets as tickets_router
from app.routers import usuarios as usuarios_router
from app.routers import ws as ws_router
from app.routers import puntos_venta as puntos_venta_router

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s %(levelname)s %(name)s: %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
            "stream": "ext://sys.stdout",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": settings.log_level,
    },
    "loggers": {
        "uvicorn": {"level": "WARNING"},
        "uvicorn.error": {"level": "INFO"},
        "uvicorn.access": {"level": "WARNING"},
        "sqlalchemy.engine": {"level": "WARNING"},
        "app": {"level": settings.log_level, "propagate": True},
    },
}

logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando HelpDesk-GMP backend (env=%s)", settings.app_env)
    from app.core.storage import ensure_bucket

    ensure_bucket()
    logger.info("Bucket MinIO verificado: %s", settings.minio_bucket)

    from app.websockets.pubsub import pubsub_listener

    listener_task = asyncio.create_task(pubsub_listener())
    logger.info("WS Pub/Sub listener arrancado")

    yield
    listener_task.cancel()
    logger.info("Cerrando HelpDesk-GMP backend")


app = FastAPI(
    title="HelpDesk-GMP API",
    description="Sistema de gestion de tickets multi-tenant",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router.router)
app.include_router(empresas_router.router)
app.include_router(categorias_router.router)
app.include_router(subcategorias_router.router)
app.include_router(usuarios_router.router)
app.include_router(tickets_router.router)
app.include_router(comentarios_router.router)
app.include_router(adjuntos_router.router)
app.include_router(stats_router.router)
app.include_router(tarea_pendiente_router.router)
app.include_router(push_router.router)
app.include_router(matriz_prioridad_router.router)
app.include_router(metricas_router.router)
app.include_router(reportes_router.router)
app.include_router(respuestas_rapidas_router.router)
app.include_router(puntos_venta_router.router)
app.include_router(ws_router.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.app_env}


@app.get("/")
async def root() -> dict[str, str]:
    return {"app": "helpdesk-gmp", "docs": "/docs"}
