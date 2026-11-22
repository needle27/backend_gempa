"""Add DBI score and reproducible evaluation metadata.

Revision ID: 20261118_0004
Revises: 20261117_0003
Create Date: 2026-11-18

Existing experiment/run rows are preserved. New metric columns are nullable so
historical results (including Job #25) are not backfilled or reinterpreted.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261118_0004"
down_revision = "20261117_0003"
branch_labels = None
depends_on = None

JSON_DOCUMENT = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.add_column(
        "dbscan_parameter_experiments",
        sa.Column("dbi_score", sa.Float(precision=53), nullable=True),
    )
    op.add_column(
        "dbscan_parameter_experiments",
        sa.Column(
            "evaluation_metadata",
            JSON_DOCUMENT,
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )
    with op.batch_alter_table("dbscan_parameter_experiments") as batch_op:
        batch_op.create_check_constraint(
            "ck_experiment_dbi_nonnegative",
            "dbi_score IS NULL OR dbi_score >= 0",
        )

    op.add_column(
        "dbscan_runs",
        sa.Column("dbi_score", sa.Float(precision=53), nullable=True),
    )
    op.add_column(
        "dbscan_runs",
        sa.Column(
            "evaluation_metadata",
            JSON_DOCUMENT,
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )
    with op.batch_alter_table("dbscan_runs") as batch_op:
        batch_op.create_check_constraint(
            "ck_run_dbi_nonnegative",
            "dbi_score IS NULL OR dbi_score >= 0",
        )


def downgrade() -> None:
    with op.batch_alter_table("dbscan_runs") as batch_op:
        batch_op.drop_constraint("ck_run_dbi_nonnegative", type_="check")
        batch_op.drop_column("evaluation_metadata")
        batch_op.drop_column("dbi_score")

    with op.batch_alter_table("dbscan_parameter_experiments") as batch_op:
        batch_op.drop_constraint("ck_experiment_dbi_nonnegative", type_="check")
        batch_op.drop_column("evaluation_metadata")
        batch_op.drop_column("dbi_score")
