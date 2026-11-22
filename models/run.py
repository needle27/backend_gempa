"""Final DBSCAN run model."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Double,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)

from extensions import db
from models.types import BIG_ID, JSON_DOCUMENT


class DBSCANRun(db.Model):
    __tablename__ = "dbscan_runs"
    __table_args__ = (
        UniqueConstraint("id", "dataset_id", name="uq_run_id_dataset"),
        ForeignKeyConstraint(
            ["selected_experiment_id", "dataset_id"],
            [
                "dbscan_parameter_experiments.id",
                "dbscan_parameter_experiments.dataset_id",
            ],
            name="fk_run_selected_experiment",
        ),
        CheckConstraint(
            "status IN ('DRAFT', 'CLUSTERING', 'SUCCESS', 'FAILED', 'ARCHIVED')",
            name="ck_run_status",
        ),
        CheckConstraint("eps_km > 0", name="ck_run_eps_km"),
        CheckConstraint("eps_radian > 0", name="ck_run_eps_radian"),
        CheckConstraint("min_samples >= 2", name="ck_run_min_samples"),
        CheckConstraint("metric = 'haversine'", name="ck_run_metric_haversine"),
        CheckConstraint("earth_radius_km > 0", name="ck_run_earth_radius"),
        CheckConstraint(
            "abs(eps_radian - (eps_km / earth_radius_km)) <= 1e-10",
            name="ck_run_eps_conversion",
        ),
        CheckConstraint(
            "cluster_count IS NULL OR cluster_count >= 0",
            name="ck_run_cluster_count",
        ),
        CheckConstraint(
            "noise_count IS NULL OR noise_count >= 0",
            name="ck_run_noise_count",
        ),
        CheckConstraint(
            "total_points IS NULL OR total_points > 0",
            name="ck_run_total_points",
        ),
        CheckConstraint(
            "noise_percentage IS NULL OR noise_percentage BETWEEN 0 AND 100",
            name="ck_run_noise_percentage",
        ),
        CheckConstraint(
            "silhouette_score IS NULL OR silhouette_score BETWEEN -1 AND 1",
            name="ck_run_silhouette_range",
        ),
        CheckConstraint(
            "dbcv_score IS NULL OR dbcv_score BETWEEN -1 AND 1",
            name="ck_run_dbcv_range",
        ),
        CheckConstraint(
            "dbi_score IS NULL OR dbi_score >= 0",
            name="ck_run_dbi_nonnegative",
        ),
        CheckConstraint(
            "silhouette_sample_size IS NULL OR silhouette_sample_size >= 2",
            name="ck_run_silhouette_sample_size",
        ),
        CheckConstraint(
            "(cluster_count IS NULL AND noise_count IS NULL "
            "AND noise_percentage IS NULL AND total_points IS NULL) "
            "OR (cluster_count IS NOT NULL AND noise_count IS NOT NULL "
            "AND noise_percentage IS NOT NULL AND total_points IS NOT NULL "
            "AND cluster_count >= 0 AND noise_count >= 0 AND total_points > 0 "
            "AND noise_count <= total_points "
            "AND abs(noise_percentage - (noise_count * 100.0 / total_points)) <= 1e-6 "
            "AND ((cluster_count = 0 AND noise_count = total_points) "
            "OR (cluster_count > 0 AND noise_count < total_points)))",
            name="ck_run_result_counts_consistency",
        ),
        CheckConstraint(
            "status <> 'SUCCESS' OR (cluster_count IS NOT NULL "
            "AND noise_count IS NOT NULL AND noise_percentage IS NOT NULL "
            "AND total_points IS NOT NULL AND completed_at IS NOT NULL)",
            name="ck_run_success_requires_results",
        ),
        CheckConstraint(
            "is_active = false OR (status = 'SUCCESS' AND activated_at IS NOT NULL)",
            name="ck_active_run_must_be_success",
        ),
        Index(
            "uq_one_active_dbscan_run",
            "is_active",
            unique=True,
            postgresql_where=text("is_active IS TRUE"),
            sqlite_where=text("is_active = 1"),
        ),
        Index("ix_dbscan_runs_dataset", "dataset_id"),
    )

    id = db.Column(BIG_ID, primary_key=True, autoincrement=True)
    dataset_id = db.Column(
        BIG_ID,
        ForeignKey("dataset_info.id", name="fk_run_dataset"),
        nullable=False,
    )
    selected_experiment_id = db.Column(BIG_ID, nullable=False)
    eps_km = db.Column(Double, nullable=False)
    eps_radian = db.Column(Double, nullable=False)
    min_samples = db.Column(Integer, nullable=False)
    metric = db.Column(String(30), nullable=False, server_default=text("'haversine'"))
    earth_radius_km = db.Column(
        Double, nullable=False, server_default=text("6371.0088")
    )
    cluster_count = db.Column(Integer)
    noise_count = db.Column(Integer)
    noise_percentage = db.Column(Double)
    total_points = db.Column(Integer)
    silhouette_score = db.Column(Double)
    silhouette_sample_size = db.Column(Integer)
    dbcv_score = db.Column(Double)
    dbi_score = db.Column(Double)
    evaluation_metadata = db.Column(
        JSON_DOCUMENT, nullable=False, default=dict, server_default=text("'{}'")
    )
    status = db.Column(String(30), nullable=False)
    is_active = db.Column(Boolean, nullable=False, server_default=text("false"))
    created_by = db.Column(
        BIG_ID,
        ForeignKey("users.id", name="fk_run_created_by"),
        nullable=False,
    )
    approved_by = db.Column(BIG_ID, ForeignKey("users.id", name="fk_run_approved_by"))
    created_at = db.Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at = db.Column(DateTime(timezone=True))
    activated_at = db.Column(DateTime(timezone=True))
