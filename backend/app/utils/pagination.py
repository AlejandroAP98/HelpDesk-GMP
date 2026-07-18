"""Utilidades de paginacion para listados."""
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Pagina(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def of(cls, items: list[T], total: int, page: int, size: int) -> "Pagina[T]":
        pages = (total + size - 1) // size if size > 0 else 0
        return cls(items=items, total=total, page=page, size=size, pages=pages)


class PaginacionParams(BaseModel):
    page: int = 1
    size: int = 15

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size

    @property
    def limit(self) -> int:
        return self.size


def paginacion(page: int = 1, size: int = 15) -> PaginacionParams:
    if page < 1:
        page = 1
    if size < 1 or size > 90:
        size = 15
    return PaginacionParams(page=page, size=size)