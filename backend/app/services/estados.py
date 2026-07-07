"""Maquina de estados estricta del ciclo de vida de tickets (agent.md §3.1).

Matriz de transiciones permitidas:

    abierto      -> asignado        (admin asigna agente)
    asignado     -> en_progreso    (agente trabaja / comenta)
    en_progreso  -> resuelto        (agente resuelve)
    resuelto     -> cerrado         (cliente confirma o cron auto-cierra)
    cerrado      -> (ninguna, estado final)
"""
from app.models.enums import EstadoTicket

TRANSICIONES_VALIDAS: dict[EstadoTicket, set[EstadoTicket]] = {
    EstadoTicket.abierto: {EstadoTicket.asignado},
    EstadoTicket.asignado: {EstadoTicket.en_progreso},
    EstadoTicket.en_progreso: {EstadoTicket.resuelto},
    EstadoTicket.resuelto: {EstadoTicket.cerrado},
    EstadoTicket.cerrado: set(),
}


def es_transicion_valida(desde: EstadoTicket, hacia: EstadoTicket) -> bool:
    return hacia in TRANSICIONES_VALIDAS.get(desde, set())


def es_estado_final(estado: EstadoTicket) -> bool:
    return estado == EstadoTicket.cerrado