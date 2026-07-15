import asyncio
from app.services.push_service import _is_configured, _get_vapid_pem

print("VAPID configured:", _is_configured())
pem = _get_vapid_pem()
if pem:
    print("PEM length:", len(pem))
    print("PEM starts with:", pem[:30])
else:
    print("No se pudo obtener PEM")
