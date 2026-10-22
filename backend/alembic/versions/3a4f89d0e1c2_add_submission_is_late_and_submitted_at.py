"""add_submission_is_late_and_submitted_at

Revision ID: 3a4f89d0e1c2
Revises: 12e1c37d0fcb
Create Date: 2026-10-22 07:14:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3a4f89d0e1c2'
down_revision: Union[str, None] = '12e1c37d0fcb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('submissions') as batch_op:
        batch_op.add_column(sa.Column('is_late', sa.Boolean(), nullable=False, server_default=sa.text('0')))
        batch_op.add_column(sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('submissions') as batch_op:
        batch_op.drop_column('submitted_at')
        batch_op.drop_column('is_late')
