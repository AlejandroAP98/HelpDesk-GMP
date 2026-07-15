"""Schemas para suscripciones Web Push."""
from pydantic import BaseModel, Field


class PushKeys(BaseModel):
    p256dh: str = Field(..., min_length=1, max_length=200)
    auth: str = Field(..., min_length=1, max_length=50)


class PushSubscribeIn(BaseModel):
    endpoint: str = Field(..., min_length=10, max_length=700)
    keys: PushKeys
    user_agent: str | None = Field(default=None, max_length=255)


class PushSubscribeOut(BaseModel):
    id: str
    endpoint: str
    user_agent: str | None
    fecha_creacion: str


class PushUnsubscribeIn(BaseModel):
    endpoint: str = Field(..., min_length=10, max_length=700)


class PushVapidKeyOut(BaseModel):
    public_key: str


class PushTestOut(BaseModel):
    delivered: int = Field(..., description="Cantidad de dispositivos a los que se entrego el push")


__all__ = [
    "PushKeys",
    "PushSubscribeIn",
    "PushSubscribeOut",
    "PushUnsubscribeIn",
    "PushVapidKeyOut",
    "PushTestOut",
]
