"""Configuración de métricas Prometheus para FastAPI."""

from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator, metrics

EXCLUDED_HANDLERS = ["/metrics", "/health", "/docs", "/openapi.json", "/redoc"]


def setup_metrics(app: FastAPI) -> Instrumentator:
    """Instrumentar la app FastAPI con métricas Prometheus."""
    instrumentator = Instrumentator(
        should_respect_env_var=False,
        should_instrument_requests_inprogress=True,
        excluded_handlers=EXCLUDED_HANDLERS,
    )
    instrumentator.add(metrics.request_size())
    instrumentator.add(metrics.response_size())
    instrumentator.add(metrics.requests())
    instrumentator.add(metrics.latency())
    instrumentator.instrument(app)
    instrumentator.expose(app, include_in_schema=False)
    return instrumentator
