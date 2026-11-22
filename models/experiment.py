"""DBSCAN parameter experiment model."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Double,
    ForeignKeyConstraint,
    Integer,
    UniqueConstraint,
    func,
    text,
)

from extensions import db
from models.types import BIG_ID, JSON_DOCUMENT


class DBSCANParameterExperiment(db.Model):
    __tablename__ = "dbscan_parameter_experiments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["job_id", "dataset_id"],
            ["processing_jobs.id", "processing_jobs.dataset_id"],
            name="fk_experiment_job_dataset",
        ),
        UniqueConstraint(
            "job_id", "eps_km", "min_samples", name="uq_experiment_job_eps_min_samples"
        ),
        UniqueConstraint("id", "dataset_id", name="uq_experiment_id_dataset"),
        CheckConstraint("eps_km > 0", name="ck_experiment_eps_km"),
        CheckConstraint("eps_radian > 0", name="ck_experiment_eps_radian"),
        CheckConstraint(
            "abs(eps_radian - (eps_km / 6371.0088)) <= 1e-10",
            name="ck_experiment_eps_conversion",
        ),
        CheckConstraint("min_samples >= 2", name="ck_experiment_min_samples"),
        CheckConstraint("cluster_count >= 0", name="ck_experiment_cluster_count"),
        CheckConstraint("noise_count >= 0", name="ck_experiment_noise_count"),
        CheckConstraint("clustered_count >= 0", name="ck_experiment_clustered_count"),
        CheckConstraint(
            "(noise_count + clustered_count) > 0",
            name="ck_experiment_total_points",
        ),
        CheckConstraint(
            "(cluster_count = 0 AND clustered_count = 0) "
            "OR (cluster_count > 0 AND clustered_count > 0)",
            name="ck_experiment_clustered_consistency",
        ),
        CheckConstraint(
            "noise_percentage BETWEEN 0 AND 100",
            name="ck_experiment_noise_percentage",
        ),
        CheckConstraint(
            "abs(noise_percentage - "
            "(noise_count * 100.0 / (noise_count + clustered_count))) <= 1e-6",
            name="ck_experiment_noise_percentage_consistency",
        ),
        CheckConstraint(
            "min_cluster_size IS NULL OR min_cluster_size >= 1",
            name="ck_experiment_min_cluster_size",
        ),
        CheckConstraint(
            "median_cluster_size IS NULL OR median_cluster_size >= 1",
            name="ck_experiment_median_cluster_size",
        ),
        CheckConstraint(
            "max_cluster_size IS NULL OR max_cluster_size >= 1",
            name="ck_experiment_max_cluster_size",
        ),
        CheckConstraint(
            "(min_cluster_size IS NULL AND median_cluster_size IS NULL AND max_cluster_size IS NULL) "
            "OR (min_cluster_size IS NOT NULL AND median_cluster_size IS NOT NULL "
            "AND max_cluster_size IS NOT NULL AND min_cluster_size <= median_cluster_size "
            "AND median_cluster_size <= max_cluster_size)",
            name="ck_experiment_cluster_size_order",
        ),
        CheckConstraint(
            "silhouette_score IS NULL OR silhouette_score BETWEEN -1 AND 1",
            name="ck_experiment_silhouette_range",
        ),
        CheckConstraint(
            "dbcv_score IS NULL OR dbcv_score BETWEEN -1 AND 1",
            name="ck_experiment_dbcv_range",
        ),
        CheckConstraint(
            "dbi_score IS NULL OR dbi_score >= 0",
            name="ck_experiment_dbi_nonnegative",
        ),
        CheckConstraint(
            "silhouette_sample_size IS NULL OR silhouette_sample_size >= 2",
            name="ck_experiment_silhouette_sample_size",
        ),
        CheckConstraint(
            "is_recommended = false OR is_valid = true",
            name="ck_experiment_recommended_must_be_valid",
        ),
    )

    id = db.Column(BIG_ID, primary_key=True, autoincrement=True)
    dataset_id = db.Column(BIG_ID, nullable=False)
    job_id = db.Column(BIG_ID, nullable=False)
    eps_km = db.Column(Double, nullable=False)
    eps_radian = db.Column(Double, nullable=False)
    min_samples = db.Column(Integer, nullable=False)
    cluster_count = db.Column(Integer, nullable=False)
    noise_count = db.Column(Integer, nullable=False)
    noise_percentage = db.Column(Double, nullable=False)
    clustered_count = db.Column(Integer, nullable=False)
    min_cluster_size = db.Column(Integer)
    median_cluster_size = db.Column(Double)
    max_cluster_size = db.Column(Integer)
    silhouette_score = db.Column(Double)
    silhouette_sample_size = db.Column(Integer)
    dbcv_score = db.Column(Double)
    dbi_score = db.Column(Double)
    evaluation_metadata = db.Column(
        JSON_DOCUMENT, nullable=False, default=dict, server_default=text("'{}'")
    )
    stability_score = db.Column(Double)
    is_valid = db.Column(Boolean, nullable=False)
    invalid_reason = db.Column(db.Text)
    is_recommended = db.Column(Boolean, nullable=False, server_default=text("false"))
    created_at = db.Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
