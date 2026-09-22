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


class RendimientoAgente(BaseModel):
    agente_id: str
    agente_nombre: str | None = None
    asignados: int
    resueltos: int
    cerrados: int


class MetricasRendimiento(BaseModel):
    por_agente: list[RendimientoAgente]


class TiempoResolucionAgente(BaseModel):
    agente_id: str
    agente_nombre: str | None = None
    mttr_horas: float | None = None
    tickets_analizados: int


class MetricasTiempoPorAgente(BaseModel):
    por_agente: list[TiempoResolucionAgente]


class ReaperturaItem(BaseModel):
    ticket_id: str
    titulo: str
    agente_nombre: str | None = None
    fecha_reapertura: str
    veces_reabierto: int


class MetricasReaperturas(BaseModel):
    total_reaperturas: int
    tickets: list[ReaperturaItem]


class SLAItem(BaseModel):
    empresa_id: int
    empresa_nombre: str | None = None
    total_tickets: int
    tickets_en_sla: int
    porcentaje_sla: float
    frt_horas: float | None = None
    mttr_horas: float | None = None
    mttr_base_horas: float | None = None
    mttr_remoto_horas: float | None = None
    total_tickets_mes_anterior: int | None = None
    porcentaje_sla_mes_anterior: float | None = None
    frt_horas_mes_anterior: float | None = None
    mttr_horas_mes_anterior: float | None = None


class MetricasSLA(BaseModel):
    sla_objetivo_frt_horas: float
    sla_objetivo_mttr_horas: float
    sla_objetivo_mttr_remoto_horas: float
    por_empresa: list[SLAItem]
