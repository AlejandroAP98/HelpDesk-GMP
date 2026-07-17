#!/usr/bin/env bash
# =============================================================================
# HelpDesk-GMP - Backup script para PostgreSQL, MinIO y Redis
# =============================================================================
# Uso:
#   ./scripts/backup.sh                    # Backup completo
#   ./scripts/backup.sh --restore 20240115_030000  # Restaurar backup
#
# Cron (diario 3am):
#   0 3 * * * /ruta/HelpDesk-GMP/scripts/backup.sh >> /var/log/helpdesk-backup.log 2>&1
# =============================================================================

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
COMPOSE_BASE="${PROJECT_DIR}/docker-compose.yml"
COMPOSE_PROD="${PROJECT_DIR}/docker-compose.prod.yml"
COMPOSE_CMD="docker compose -f ${COMPOSE_BASE} -f ${COMPOSE_PROD} --profile prod"
BACKUP_ROOT="${BACKUP_ROOT:-/backups/helpdesk}"
KEEP_DAYS="${KEEP_DAYS:-7}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[BACKUP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

backup_postgres() {
    log "Respaldando PostgreSQL..."
    mkdir -p "${BACKUP_DIR}/postgres"
    ${COMPOSE_CMD} exec -T postgres pg_dump \
        -U "${POSTGRES_USER:-helpdesk}" \
        -d "${POSTGRES_DB:-helpdesk}" \
        --no-owner --no-acl \
        | gzip > "${BACKUP_DIR}/postgres/dump.sql.gz"
    log "PostgreSQL OK: $(du -sh ${BACKUP_DIR}/postgres/dump.sql.gz | cut -f1)"
}

backup_minio() {
    log "Respaldando MinIO..."
    mkdir -p "${BACKUP_DIR}/minio"
    docker run --rm \
        -v "helpdesk-gmp_minio_data:/data:ro" \
        -v "${BACKUP_DIR}/minio":/backup \
        alpine tar czf /backup/minio_data.tar.gz -C / data 2>/dev/null || {
            warn "MinIO vacio o sin datos"; return 0; }
    log "MinIO OK: $(du -sh ${BACKUP_DIR}/minio/minio_data.tar.gz | cut -f1)"
}

backup_redis() {
    log "Respaldando Redis..."
    mkdir -p "${BACKUP_DIR}/redis"
    ${COMPOSE_CMD} exec -T redis redis-cli BGSAVE >/dev/null 2>&1
    sleep 2
    docker run --rm \
        -v "helpdesk-gmp_redis_data:/data:ro" \
        -v "${BACKUP_DIR}/redis":/backup \
        alpine cp /data/dump.rdb /backup/dump.rdb 2>/dev/null || {
            warn "Redis sin datos persistidos"; return 0; }
    gzip "${BACKUP_DIR}/redis/dump.rdb"
    log "Redis OK: $(du -sh ${BACKUP_DIR}/redis/dump.rdb.gz | cut -f1)"
}

backup_env() {
    log "Copiando configuracion..."
    cp "${PROJECT_DIR}/.env" "${BACKUP_DIR}/env.backup"
    cp "${PROJECT_DIR}/caddy/Caddyfile" "${BACKUP_DIR}/Caddyfile.backup" 2>/dev/null || true
}

cleanup_old_backups() {
    log "Limpiando backups mayores a ${KEEP_DAYS} dias..."
    local count
    count=$(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime +"${KEEP_DAYS}" 2>/dev/null | wc -l)
    if [ "$count" -gt 0 ]; then
        find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime +"${KEEP_DAYS}" -exec rm -rf {} +
        log "Eliminados ${count} backups antiguos"
    fi
}

check_disk_space() {
    local usage
    usage=$(df "${BACKUP_ROOT}" 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
    if [ -n "$usage" ] && [ "$usage" -gt 90 ]; then
        error "Disco al ${usage}% - No se puede hacer backup"
        exit 1
    fi
}

restore_backup() {
    local restore_date="$1"
    local restore_dir="${BACKUP_ROOT}/${restore_date}"

    if [ ! -d "${restore_dir}" ]; then
        error "No existe backup para fecha: ${restore_date}"
        exit 1
    fi

    warn "=== RESTAURANDO BACKUP DE ${restore_date} ==="
    warn "Esto sobreescribira los datos actuales."
    read -p "Continuar? (s/N): " confirm
    if [ "$confirm" != "s" ] && [ "$confirm" != "S" ]; then
        log "Cancelado"; exit 0
    fi

    if [ -f "${restore_dir}/postgres/dump.sql.gz" ]; then
        log "Restaurando PostgreSQL..."
        gunzip -c "${restore_dir}/postgres/dump.sql.gz" | \
            ${COMPOSE_CMD} exec -T postgres psql \
                -U "${POSTGRES_USER:-helpdesk}" \
                -d "${POSTGRES_DB:-helpdesk}" --quiet
        log "PostgreSQL restaurado"
    fi

    if [ -f "${restore_dir}/minio/minio_data.tar.gz" ]; then
        log "Restaurando MinIO..."
        ${COMPOSE_CMD} stop minio
        docker run --rm \
            -v "helpdesk-gmp_minio_data:/data" \
            -v "${restore_dir}/minio":/backup \
            alpine sh -c "rm -rf /data/* && tar xzf /backup/minio_data.tar.gz -C /"
        ${COMPOSE_CMD} start minio
        log "MinIO restaurado"
    fi

    log "=== RESTAURACION COMPLETADA ==="
}

main() {
    if [ "${1:-}" = "--restore" ]; then
        if [ -z "${2:-}" ]; then
            error "Uso: $0 --restore YYYYMMDD_HHMMSS"; exit 1
        fi
        restore_backup "$2"; exit 0
    fi

    log "=== INICIO BACKUP HelpDesk-GMP ${TIMESTAMP} ==="
    mkdir -p "${BACKUP_ROOT}"
    check_disk_space

    backup_postgres
    backup_minio
    backup_redis
    backup_env

    echo "{
  \"timestamp\": \"${TIMESTAMP}\",
  \"date\": \"$(date -Iseconds)\",
  \"hostname\": \"$(hostname)\",
  \"components\": [\"postgres\", \"minio\", \"redis\", \"env\"]
}" > "${BACKUP_DIR}/manifest.json"

    cleanup_old_backups
    log "=== BACKUP COMPLETADO: $(du -sh ${BACKUP_DIR} | cut -f1) en ${BACKUP_DIR} ==="
}

main "$@"
