"""Background processing job model."""

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)

from extensions import db
from models.types import BIG_ID, JSON_DOCUMENT


class ProcessingJob(db.Model):
    __tablename__ = "processing_jobs"
    __table_args__ = (
        UniqueConstraint("id", "dataset_id", name="uq_processing_jobs_id_dataset"),
        UniqueConstraint("celery_task_id", name="uq_processing_jobs_celery_task_id"),
        ForeignKeyConstraint(
            ["run_id", "dataset_id"],
            ["dbscan_runs.id", "dbscan_runs.dataset_id"],
            name="fk_job_run_dataset",
            use_alter=True,
        ),
        CheckConstraint("progress BETWEEN 0 AND 100", name="ck_job_progress"),
        CheckConstraint(
            "job_type IN ('PARAMETER_SEARCH', 'FINAL_CLUSTERING')", name="ck_job_type"
        ),
        CheckConstraint(
            "status IN ('QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED', "
            "'STOP_REQUESTED', 'RESTARTING', 'SUCCESS', 'FAILED', 'CANCELLED')",
            name="ck_job_status",
        ),
        CheckConstraint(
            "(job_type = 'PARAMETER_SEARCH' AND run_id IS NULL) OR "
            "(job_type = 'FINAL_CLUSTERING' AND run_id IS NOT NULL)",
            name="ck_job_run_requirement",
        ),
        Index(
            "uq_processing_jobs_active_dataset_type",
            "dataset_id",
            "job_type",
            unique=True,
            postgresql_where=text(
                "status IN ('QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED', "
                "'STOP_REQUESTED', 'RESTARTING')"
            ),
            sqlite_where=text(
                "status IN ('QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED', "
                "'STOP_REQUESTED', 'RESTARTING')"
            ),
        ),
    )

    id = db.Column(BIG_ID, primary_key=True, autoincrement=True)
    dataset_id = db.Column(
        BIG_ID, ForeignKey("dataset_info.id", name="fk_job_dataset"), nullable=False
    )
    run_id = db.Column(BIG_ID)
    job_type = db.Column(String(30), nullable=False)
    celery_task_id = db.Column(String(255))
    parent_job_id = db.Column(
        BIG_ID, ForeignKey("processing_jobs.id", name="fk_job_parent")
    )
    input_payload = db.Column(JSON_DOCUMENT, nullable=False, default=dict, server_default=text("'{}'"))
    checkpoint_data = db.Column(JSON_DOCUMENT, nullable=False, default=dict, server_default=text("'{}'"))
    pause_requested_at = db.Column(DateTime(timezone=True))
    paused_at = db.Column(DateTime(timezone=True))
    stop_requested_at = db.Column(DateTime(timezone=True))
    status = db.Column(String(20), nullable=False)
    progress = db.Column(Integer, nullable=False, server_default=text("0"))
    current_step = db.Column(String(100))
    message = db.Column(Text)
    error_code = db.Column(String(100))
    error_detail = db.Column(Text)
    created_by = db.Column(
        BIG_ID, ForeignKey("users.id", name="fk_job_created_by"), nullable=False
    )
    started_at = db.Column(DateTime(timezone=True))
    finished_at = db.Column(DateTime(timezone=True))
    created_at = db.Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = db.Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
