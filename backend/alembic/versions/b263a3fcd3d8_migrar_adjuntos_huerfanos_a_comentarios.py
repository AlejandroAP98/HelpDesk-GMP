"""migrar_adjuntos_huerfanos_a_comentarios

Migra adjuntos subidos directamente a tickets (comentario_id IS NULL) a un
comentario publico del primer usuario administrador, para que aparezcan en el
nuevo flujo de chat unificado.

Revision ID: b263a3fcd3d8
Revises: 17452f650426
Create Date: 2026-10-16 19:52:34.837887
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b263a3fcd3d8"
down_revision: Union[str, None] = "17452f650426"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_MENSAJE_MIGRACION = (
    "Se adjuntan las imágenes de este ticket en un comentario por cambio en la interfaz."
)


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Buscar el primer admin; si no existe, buscar mesa_ayuda o agente.
    #    En produccion el seed siempre crea al menos un admin.
    admin_id = bind.execute(
        sa.text(
            """
            SELECT id FROM usuarios
            WHERE rol = 'administrador' AND activo = true
            ORDER BY id LIMIT 1
            """
        )
    ).scalar()

    if admin_id is None:
        admin_id = bind.execute(
            sa.text(
                """
                SELECT id FROM usuarios
                WHERE rol IN ('mesa_ayuda', 'agente') AND activo = true
                ORDER BY
                    CASE rol
                        WHEN 'mesa_ayuda' THEN 1
                        WHEN 'agente' THEN 2
                    END,
                    id
                LIMIT 1
                """
            )
        ).scalar()

    if admin_id is None:
        # No hay usuario interno disponible; no se puede crear comentarios.
        # Los adjuntos huérfanos permanecen como están.
        return

    # 2. Crear un comentario por ticket con adjuntos huérfanos y ligarlos.
    bind.execute(
        sa.text(
            """
            WITH orphan_tickets AS (
                SELECT DISTINCT ticket_id
                FROM adjuntos
                WHERE comentario_id IS NULL
            ),
            new_comments AS (
                INSERT INTO comentarios (ticket_id, usuario_id, contenido, es_nota_interna)
                SELECT ot.ticket_id, :admin_id, :mensaje, false
                FROM orphan_tickets ot
                RETURNING id, ticket_id
            )
            UPDATE adjuntos a
            SET comentario_id = nc.id
            FROM new_comments nc
            WHERE a.ticket_id = nc.ticket_id
              AND a.comentario_id IS NULL
            """
        ),
        {"admin_id": str(admin_id), "mensaje": _MENSAJE_MIGRACION},
    )


def downgrade() -> None:
    """Preserva comentarios y adjuntos: no hay marcador seguro de propiedad.

    El downgrade destructivo por coincidencia del contenido podía eliminar
    comentarios legítimos escritos por usuarios. Mantener los datos es seguro
    para la versión anterior, que lista adjuntos por ticket.
    """
