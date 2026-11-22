"""Per-run earthquake cluster membership model."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    Integer,
    UniqueConstraint,
    Index,
    func,
)

from extensions import db
from models.types import BIG_ID


class DBSCANMembership(db.Model):
    __tablename__ = "dbscan_memberships"
    __table_args__ = (
        UniqueConstraint("dbscan_run_id", "gempa_id", name="uq_membership_run_gempa"),
        ForeignKeyConstraint(
            ["dbscan_run_id", "dataset_id"],
            ["dbscan_runs.id", "dbscan_runs.dataset_id"],
            name="fk_membership_run_dataset",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["gempa_id", "dataset_id"],
            ["gempa_processed.id", "gempa_processed.dataset_id"],
            name="fk_membership_gempa_dataset",
        ),
        CheckConstraint(
            "(is_noise = true AND cluster_id = -1) OR (is_noise = false AND cluster_id >= 0)",
            name="ck_membership_noise",
        ),
        Index("ix_membership_run_cluster", "dbscan_run_id", "cluster_id"),
    )

    id = db.Column(BIG_ID, primary_key=True, autoincrement=True)
    dataset_id = db.Column(BIG_ID, nullable=False)
    dbscan_run_id = db.Column(BIG_ID, nullable=False)
    gempa_id = db.Column(BIG_ID, nullable=False)
    cluster_id = db.Column(Integer, nullable=False)
    is_noise = db.Column(Boolean, nullable=False)
    created_at = db.Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
