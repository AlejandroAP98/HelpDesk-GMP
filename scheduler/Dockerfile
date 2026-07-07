# Scheduler HelpDesk-GMP (APScheduler)
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH="/backend/.venv/bin:$PATH"

WORKDIR /app

# Dependencias minimas: reutiliza el entorno del backend como-source
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Codigo del scheduler
COPY . ./

CMD ["python", "-m", "scheduler.main"]