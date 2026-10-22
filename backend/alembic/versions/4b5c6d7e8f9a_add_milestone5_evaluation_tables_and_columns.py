"""add_milestone5_evaluation_tables_and_columns

Revision ID: 4b5c6d7e8f9a
Revises: 3a4f89d0e1c2
Create Date: 2026-10-22 07:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '4b5c6d7e8f9a'
down_revision: Union[str, None] = '3a4f89d0e1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Alter submissions table
    with op.batch_alter_table('submissions') as batch_op:
        batch_op.add_column(sa.Column('review_status', sa.String(length=35), nullable=False, server_default='awaiting_evaluation'))

    # 2. Alter evaluations table
    with op.batch_alter_table('evaluations') as batch_op:
        batch_op.add_column(sa.Column('internal_notes', sa.Text(), nullable=True))

    # 3. Alter rubric_criteria table
    with op.batch_alter_table('rubric_criteria') as batch_op:
        batch_op.add_column(sa.Column('guidance', sa.Text(), nullable=True))

    # 4. Create evaluator_assignments table
    op.create_table(
        'evaluator_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('submission_id', sa.Integer(), nullable=False),
        sa.Column('evaluator_id', sa.Integer(), nullable=False),
        sa.Column('assigned_by_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='assigned'),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['assigned_by_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['evaluator_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('submission_id', 'evaluator_id', name='uq_submission_evaluator_assignment')
    )
    op.create_index(op.f('ix_evaluator_assignments_id'), 'evaluator_assignments', ['id'], unique=False)
    op.create_index(op.f('ix_evaluator_assignments_submission_id'), 'evaluator_assignments', ['submission_id'], unique=False)
    op.create_index(op.f('ix_evaluator_assignments_evaluator_id'), 'evaluator_assignments', ['evaluator_id'], unique=False)

    # 5. Create senior_reviews table
    op.create_table(
        'senior_reviews',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('submission_id', sa.Integer(), nullable=False),
        sa.Column('senior_reviewer_id', sa.Integer(), nullable=False),
        sa.Column('recommended_score', sa.Float(), nullable=False),
        sa.Column('rationale', sa.Text(), nullable=False),
        sa.Column('internal_notes', sa.Text(), nullable=True),
        sa.Column('escalate_to_moderator', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['senior_reviewer_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_senior_reviews_id'), 'senior_reviews', ['id'], unique=False)
    op.create_index(op.f('ix_senior_reviews_submission_id'), 'senior_reviews', ['submission_id'], unique=False)
    op.create_index(op.f('ix_senior_reviews_senior_reviewer_id'), 'senior_reviews', ['senior_reviewer_id'], unique=False)


def downgrade() -> None:
    op.drop_table('senior_reviews')
    op.drop_table('evaluator_assignments')
    with op.batch_alter_table('rubric_criteria') as batch_op:
        batch_op.drop_column('guidance')
    with op.batch_alter_table('evaluations') as batch_op:
        batch_op.drop_column('internal_notes')
    with op.batch_alter_table('submissions') as batch_op:
        batch_op.drop_column('review_status')
