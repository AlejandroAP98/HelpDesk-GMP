"""Schemas del dominio Metricas e Indicadores de Rendimiento."""

from __future__ import annotations

from pydantic import BaseModel


class TiempoPromedio(BaseModel):
    horas: float | None = None


class MetricasTiempos(BaseModel):
    mttr_horas: float | None = None
    tiempo_primera_respuesta_minutos: float | None = None
    tickets_resueltos_analizados: int = 0
    tickets_con_primera_respuesta: int = 0


class ConteoPorEstado(BaseModel):
    estado: str
    cantidad: int


class ConteoPorPrioridad(BaseModel):
    prioridad: str
    cantidad: int


class VolumenPorEmpresa(BaseModel):
    empresa_id: int
    empresa_nombre: str | None = None
    cantidad: int


class MetricasVolumen(BaseModel):
    por_estado: list[ConteoPorEstado]
    por_prioridad: list[ConteoPorPrioridad]
    top_empresas: list[VolumenPorEmpresa]


class DesgloseElemento(BaseModel):
    elemento: str
    cantidad: int
    porcentaje: float


class TopUbicacion(BaseModel):
    nombre_punto: str
    cantidad: int


class MetricasInfraestructura(BaseModel):
    por_elemento: list[DesgloseElemento]
    top_ubicaciones: list[TopUbicacion]
