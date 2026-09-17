"""Configuración de métricas Prometheus para FastAPI."""

from prometheus_fastapi_instrumentator import Instrumentator


def setup_metrics(app) -> Instrumentator:
    """Instrumentar la app FastAPI con métricas Prometheus."""
    instrumentator = Instrumentator(
        should_respect_env_var=True,
        env_var_name="ENABLE_METRICS",
    )
    instrumentator.instrument(app)
    return instrumentator
