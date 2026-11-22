"""Add cooperative job lifecycle control and restart lineage.

Revision ID: 20261117_0003
Revises: 4df22ffc96f6
Create Date: 2026-11-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261117_0003"
down_revision = "4df22ffc96f6"
branch_labels = None
depends_on = None


json_document = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.drop_index("uq_processing_jobs_active_dataset_type", table_name="processing_jobs")
    op.drop_constraint("ck_job_status", "processing_jobs", type_="check")

    op.add_column(
        "processing_jobs",
        sa.Column("parent_job_id", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "processing_jobs",
        sa.Column("input_payload", json_document, nullable=False, server_default=sa.text("'{}'")),
    )
    op.add_column(
        "processing_jobs",
        sa.Column("checkpoint_data", json_document, nullable=False, server_default=sa.text("'{}'")),
    )
    op.add_column(
        "processing_jobs",
        sa.Column("pause_requested_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "processing_jobs",
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "processing_jobs",
        sa.Column("stop_requested_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_job_parent",
        "processing_jobs",
        "processing_jobs",
        ["parent_job_id"],
        ["id"],
    )
    op.create_check_constraint(
        "ck_job_status",
        "processing_jobs",
        "status IN ('QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED', "
        "'STOP_REQUESTED', 'RESTARTING', 'SUCCESS', 'FAILED', 'CANCELLED')",
    )
    op.create_index(
        "uq_processing_jobs_active_dataset_type",
        "processing_jobs",
        ["dataset_id", "job_type"],
        unique=True,
        postgresql_where=sa.text(
            "status IN ('QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED', "
            "'STOP_REQUESTED', 'RESTARTING')"
        ),
        sqlite_where=sa.text(
            "status IN ('QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED', "
            "'STOP_REQUESTED', 'RESTARTING')"
        ),
    )


def downgrade() -> None:
    op.drop_index("uq_processing_jobs_active_dataset_type", table_name="processing_jobs")
    op.drop_constraint("ck_job_status", "processing_jobs", type_="check")
    op.create_check_constraint(
        "ck_job_status",
        "processing_jobs",
        "status IN ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED')",
    )
    op.drop_constraint("fk_job_parent", "processing_jobs", type_="foreignkey")
    op.drop_column("processing_jobs", "stop_requested_at")
    op.drop_column("processing_jobs", "paused_at")
    op.drop_column("processing_jobs", "pause_requested_at")
    op.drop_column("processing_jobs", "checkpoint_data")
    op.drop_column("processing_jobs", "input_payload")
    op.drop_column("processing_jobs", "parent_job_id")
    op.create_index(
        "uq_processing_jobs_active_dataset_type",
        "processing_jobs",
        ["dataset_id", "job_type"],
        unique=True,
        postgresql_where=sa.text("status IN ('QUEUED', 'RUNNING')"),
        sqlite_where=sa.text("status IN ('QUEUED', 'RUNNING')"),
    )
