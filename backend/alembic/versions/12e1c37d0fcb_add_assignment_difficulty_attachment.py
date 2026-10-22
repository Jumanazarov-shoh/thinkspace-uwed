"""add_assignment_difficulty_attachment

Revision ID: 12e1c37d0fcb
Revises: 
Create Date: 2026-10-22 03:03:32.921457

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '12e1c37d0fcb'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('assignments') as batch_op:
        batch_op.add_column(sa.Column('difficulty', sa.String(length=30), nullable=True, server_default='intermediate'))
        batch_op.add_column(sa.Column('attachment_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('assignments') as batch_op:
        batch_op.drop_column('attachment_url')
        batch_op.drop_column('difficulty')
