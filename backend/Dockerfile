# Backend HelpDesk-GMP
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.8.4 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_HOME=/opt/poetry \
    PATH="/opt/poetry/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl build-essential libpq-dev \
    && curl -sSL https://install.python-poetry.org | python - \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias primero (cache layer)
COPY pyproject.toml ./
RUN poetry install --no-interaction --no-root --without dev

# Codigo fuente
COPY . ./

# Usuario no-root
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["poetry", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]