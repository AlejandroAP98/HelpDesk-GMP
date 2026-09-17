"""Configuración de métricas Prometheus para FastAPI."""

from prometheus_fastapi_instrumentator import Instrumentator, metrics


def setup_metrics() -> Instrumentator:
    """Configurar y retornar el instrumentador de Prometheus."""
    instrumentator = Instrumentator(
        should_respect_env_var=True,
        env_var_name="ENABLE_METRICS",
        inprogress_name="http_requests_inprogress",
        inprogress_labels=True,
    )

    instrumentator.add(
        metrics.request_size(
            should_include_handler=True,
            should_include_method=True,
            should_include_status=True,
        )
    )
    instrumentator.add(
        metrics.response_size(
            should_include_handler=True,
            should_include_method=True,
            should_include_status=True,
        )
    )
    instrumentator.add(metrics.requests())
    instrumentator.add(metrics.latency())

    instrumentator.exclude(handler="/(metrics|health|docs|openapi.json|redoc)")

    return instrumentator
