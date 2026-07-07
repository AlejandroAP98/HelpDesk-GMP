"""Excepciones personalizadas del dominio."""
from fastapi import HTTPException, status


class CredencialesInvalidas(HTTPException):
    def __init__(self, detail: str = "Credenciales invalidas") -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


class TokenInvalido(HTTPException):
    def __init__(self, detail: str = "Token invalido o expirado") -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


class PermisoDenegado(HTTPException):
    def __init__(self, detail: str = "No tienes permiso para realizar esta accion") -> None:
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class RecursoNoEncontrado(HTTPException):
    def __init__(self, detail: str = "Recurso no encontrado") -> None:
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class Conflicto(HTTPException):
    def __init__(self, detail: str = "Conflicto con el estado actual") -> None:
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)