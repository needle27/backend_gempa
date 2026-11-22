"""Processing artifact registry model."""

from sqlalchemy import (
    CHAR,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    Text,
    CheckConstraint,
    func,
)

from extensions import db
from models.types import BIG_ID, JSON_DOCUMENT


class ProcessingArtifact(db.Model):
    __tablename__ = "processing_artifacts"
    __table_args__ = (
        ForeignKeyConstraint(
            ["job_id", "dataset_id"],
            ["processing_jobs.id", "processing_jobs.dataset_id"],
            name="fk_artifact_job_dataset",
        ),
        ForeignKeyConstraint(
            ["run_id", "dataset_id"],
            ["dbscan_runs.id", "dbscan_runs.dataset_id"],
            name="fk_artifact_run_dataset",
        ),
        CheckConstraint(
            "artifact_type IN ('VALIDATION_REPORT', 'REJECTED_ROWS', 'K_DISTANCE_DATA', "
            "'K_DISTANCE_PLOT', 'PARAMETER_EXPERIMENT', 'SENSITIVITY_ANALYSIS', "
            "'FINAL_ASSIGNMENT', 'CLUSTER_PROFILE', 'RUN_METADATA')",
            name="ck_artifact_type",
        ),
    )

    id = db.Column(BIG_ID, primary_key=True, autoincrement=True)
    dataset_id = db.Column(
        BIG_ID,
        ForeignKey("dataset_info.id", name="fk_artifact_dataset"),
        nullable=False,
    )
    job_id = db.Column(BIG_ID)
    run_id = db.Column(BIG_ID)
    artifact_type = db.Column(String(50), nullable=False)
    filename = db.Column(String(255), nullable=False)
    storage_path = db.Column(Text, nullable=False)
    mime_type = db.Column(String(100), nullable=False)
    file_hash_sha256 = db.Column(CHAR(64), nullable=False)
    artifact_metadata = db.Column(
        "metadata", JSON_DOCUMENT, nullable=False, default=dict, server_default="{}"
    )
    created_at = db.Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
