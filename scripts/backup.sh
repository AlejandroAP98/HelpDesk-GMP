#!/usr/bin/env bash
# =============================================================================
# HelpDesk-GMP - Backup script para PostgreSQL, MinIO y Redis
# =============================================================================
# Uso:
#   ./scripts/backup.sh                          # Backup completo (+ subir a Drive)
#                                                 # Drive excluye: MinIO (imagenes)
#   ./scripts/backup.sh --no-upload              # Backup sin subir a Drive
#   ./scripts/backup.sh --restore 20240115_030000 # Restaurar backup local
#   ./scripts/backup.sh --list-remote            # Listar backups en Google Drive
#   ./scripts/backup.sh --restore-gdrive 20240115_030000  # Restaurar desde Drive
#
# Cron (diario 3am):
#   0 3 * * * /ruta/HelpDesk-GMP/scripts/backup.sh >> /var/log/helpdesk-backup.log 2>&1
#
# Requiere: rclone configurado con remote "gdrive" (ver AGENTS.md)
# =============================================================================

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
COMPOSE_BASE="${PROJECT_DIR}/docker-compose.yml"
COMPOSE_PROD="${PROJECT_DIR}/docker-compose.prod.yml"
COMPOSE_CMD="docker compose -f ${COMPOSE_BASE} -f ${COMPOSE_PROD} --profile prod"
BACKUP_ROOT="${BACKUP_ROOT:-/backups/helpdesk}"
KEEP_DAYS="${KEEP_DAYS:-7}"
GDRIVE_REMOTE="${GDRIVE_REMOTE:-gdrive}"
GDRIVE_FOLDER="${GDRIVE_FOLDER:-HelpDesk-GMP-Backups}"
GDRIVE_KEEP_DAYS="${GDRIVE_KEEP_DAYS:-30}"
UPLOAD="${UPLOAD:-true}"
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
        --user "$(id -u):$(id -g)" \
        -v "helpdesk-gmp_redis_data:/data:ro" \
        -v "${BACKUP_DIR}/redis":/backup \
        alpine sh -c "cp /data/dump.rdb /backup/dump.rdb && gzip /backup/dump.rdb" 2>/dev/null || {
            warn "Redis sin datos persistidos"; return 0; }
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

check_rclone() {
    if ! command -v rclone &>/dev/null; then
        warn "rclone no instalado - saltando subida a Google Drive"
        return 1
    fi
    if ! rclone listremotes 2>/dev/null | grep -q "^${GDRIVE_REMOTE}:$"; then
        warn "Remote '${GDRIVE_REMOTE}' no configurado en rclone - saltando subida"
        return 1
    fi
    return 0
}

upload_to_gdrive() {
    if ! check_rclone; then return 0; fi

    log "Subiendo backup a Google Drive (sin MinIO)..."
    local remote_path="${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/${TIMESTAMP}"

    if rclone copy "${BACKUP_DIR}" "${remote_path}" \
        --exclude "minio/**" \
        --progress --stats-one-line 2>&1; then
        log "Google Drive OK: ${remote_path}"
    else
        error "Error subiendo a Google Drive"
        return 1
    fi
}

cleanup_gdrive_backups() {
    if ! check_rclone; then return 0; fi

    log "Limpiando backups en Drive mayores a ${GDRIVE_KEEP_DAYS} dias..."
    local cutoff_date
    cutoff_date=$(date -d "-${GDRIVE_KEEP_DAYS} days" +%Y%m%d 2>/dev/null || date -v-"${GDRIVE_KEEP_DAYS}"d +%Y%m%d 2>/dev/null)

    if [ -z "$cutoff_date" ]; then
        warn "No se pudo calcular fecha de corte para Drive"
        return 0
    fi

    local folders_to_delete
    folders_to_delete=$(rclone lsd "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/" 2>/dev/null | awk '{print $NF}' | while read -r folder; do
        folder_date=$(echo "$folder" | cut -d'_' -f1)
        if [ "$folder_date" -lt "$cutoff_date" ] 2>/dev/null; then
            echo "$folder"
        fi
    done)

    local count=0
    while IFS= read -r folder; do
        [ -z "$folder" ] && continue
        rclone purge "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/${folder}" 2>/dev/null && count=$((count + 1))
    done <<< "$folders_to_delete"

    if [ "$count" -gt 0 ]; then
        log "Eliminados ${count} backups antiguos de Drive"
    fi
}

list_gdrive_backups() {
    if ! check_rclone; then return 1; fi

    log "Backups en Google Drive:"
    rclone lsd "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/" 2>/dev/null | awk '{print "  " $NF " (" $4 " " $5 ")"}' || echo "  (vacio)"
}

restore_from_gdrive() {
    local restore_date="$1"

    if ! check_rclone; then
        error "rclone no disponible para restaurar desde Drive"
        exit 1
    fi

    local remote_path="${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/${restore_date}"
    local restore_dir="${BACKUP_ROOT}/${restore_date}"

    if ! rclone lsd "${remote_path}" &>/dev/null; then
        error "No existe backup en Drive para fecha: ${restore_date}"
        exit 1
    fi

    warn "=== RESTAURANDO BACKUP DE GOOGLE DRIVE: ${restore_date} ==="
    warn "Esto descargara el backup y sobreescribira los datos actuales."
    read -p "Continuar? (s/N): " confirm
    if [ "$confirm" != "s" ] && [ "$confirm" != "S" ]; then
        log "Cancelado"; exit 0
    fi

    mkdir -p "${restore_dir}"
    log "Descargando desde Drive..."
    rclone copy "${remote_path}" "${restore_dir}" --progress --stats-one-line

    log "Restaurando PostgreSQL..."
    if [ -f "${restore_dir}/postgres/dump.sql.gz" ]; then
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
    else
        warn "MinIO no incluido en backup de Drive - adjuntos no restaurados"
    fi

    log "=== RESTAURACION DESDE DRIVE COMPLETADA ==="
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
    case "${1:-}" in
        --restore)
            if [ -z "${2:-}" ]; then
                error "Uso: $0 --restore YYYYMMDD_HHMMSS"; exit 1
            fi
            restore_backup "$2"; exit 0
            ;;
        --restore-gdrive)
            if [ -z "${2:-}" ]; then
                error "Uso: $0 --restore-gdrive YYYYMMDD_HHMMSS"; exit 1
            fi
            restore_from_gdrive "$2"; exit 0
            ;;
        --list-remote)
            list_gdrive_backups; exit 0
            ;;
        --no-upload)
            UPLOAD=false
            ;;
    esac

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
  \"components\": [\"postgres\", \"minio\", \"redis\", \"env\"],
  \"drive_excludes\": [\"minio\"]
}" > "${BACKUP_DIR}/manifest.json"

    if [ "$UPLOAD" = true ]; then
        upload_to_gdrive
        cleanup_gdrive_backups
    fi

    cleanup_old_backups
    log "=== BACKUP COMPLETADO: $(du -sh ${BACKUP_DIR} | cut -f1) en ${BACKUP_DIR} ==="
}

main "$@"
