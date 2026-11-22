"""Create the WebGIS Gempa Bumi DBSCAN database schema.

Revision ID: 20261114_0001
Revises:
Create Date: 2026-11-14
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261114_0001"
down_revision = None
branch_labels = None
depends_on = None

ID = sa.BigInteger().with_variant(sa.Integer(), "sqlite")
JSON_TYPE = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
IP_TYPE = sa.String(length=45).with_variant(postgresql.INET(), "postgresql")
TS = sa.DateTime(timezone=True)
FLOAT = sa.Float(precision=53)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", ID, autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column(
            "role",
            sa.String(length=20),
            server_default=sa.text("'admin'"),
            nullable=False,
        ),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "failed_login_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("locked_until", TS),
        sa.Column("last_login_at", TS),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.CheckConstraint("role IN ('admin')", name="ck_users_role"),
        sa.CheckConstraint(
            "failed_login_count >= 0", name="ck_users_failed_login_count"
        ),
    )

    op.create_table(
        "dataset_info",
        sa.Column("id", ID, autoincrement=True, nullable=False),
        sa.Column("dataset_name", sa.String(length=255), nullable=False),
        sa.Column("source_name", sa.String(length=100), nullable=False),
        sa.Column("source_url", sa.Text()),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("file_hash_sha256", sa.CHAR(length=64), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("latitude_min", FLOAT, nullable=False),
        sa.Column("latitude_max", FLOAT, nullable=False),
        sa.Column("longitude_min", FLOAT, nullable=False),
        sa.Column("longitude_max", FLOAT, nullable=False),
        sa.Column("raw_row_count", sa.Integer(), nullable=False),
        sa.Column("cleaned_row_count", sa.Integer(), nullable=False),
        sa.Column(
            "rejected_row_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("preprocessing_version", sa.String(length=100)),
        sa.Column(
            "validation_report",
            JSON_TYPE,
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("uploaded_by", ID, nullable=False),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_dataset_info"),
        sa.UniqueConstraint(
            "file_hash_sha256", name="uq_dataset_info_file_hash_sha256"
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by"], ["users.id"], name="fk_dataset_uploaded_by"
        ),
        sa.CheckConstraint("start_date <= end_date", name="ck_dataset_date_range"),
        sa.CheckConstraint("raw_row_count >= 0", name="ck_dataset_raw_row_count"),
        sa.CheckConstraint(
            "cleaned_row_count >= 0", name="ck_dataset_cleaned_row_count"
        ),
        sa.CheckConstraint(
            "rejected_row_count >= 0", name="ck_dataset_rejected_row_count"
        ),
        sa.CheckConstraint(
            "raw_row_count = cleaned_row_count + rejected_row_count",
            name="ck_dataset_row_count_balance",
        ),
        sa.CheckConstraint(
            "latitude_min BETWEEN -90 AND 90", name="ck_dataset_latitude_min"
        ),
        sa.CheckConstraint(
            "latitude_max BETWEEN -90 AND 90", name="ck_dataset_latitude_max"
        ),
        sa.CheckConstraint(
            "longitude_min BETWEEN -180 AND 180", name="ck_dataset_longitude_min"
        ),
        sa.CheckConstraint(
            "longitude_max BETWEEN -180 AND 180", name="ck_dataset_longitude_max"
        ),
        sa.CheckConstraint(
            "latitude_min <= latitude_max", name="ck_dataset_latitude_range"
        ),
        sa.CheckConstraint(
            "longitude_min <= longitude_max", name="ck_dataset_longitude_range"
        ),
        sa.CheckConstraint(
            "status IN ('UPLOADED', 'VALIDATING', 'READY', 'INVALID', 'PROCESSING', 'PROCESSED', 'ARCHIVED')",
            name="ck_dataset_status",
        ),
    )

    op.create_table(
        "gempa_processed",
        sa.Column("id", ID, autoincrement=True, nullable=False),
        sa.Column("dataset_id", ID, nullable=False),
        sa.Column("event_id", sa.String(length=150), nullable=False),
        sa.Column("tanggal", TS, nullable=False),
        sa.Column("latitude", FLOAT, nullable=False),
        sa.Column("longitude", FLOAT, nullable=False),
        sa.Column("latitude_rad", FLOAT, nullable=False),
        sa.Column("longitude_rad", FLOAT, nullable=False),
        sa.Column("magnitude", FLOAT, nullable=False),
        sa.Column("kedalaman", FLOAT),
        sa.Column("lokasi", sa.Text()),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_gempa_processed"),
        sa.UniqueConstraint("dataset_id", "event_id", name="uq_gempa_dataset_event"),
        sa.UniqueConstraint("id", "dataset_id", name="uq_gempa_id_dataset"),
        sa.ForeignKeyConstraint(
            ["dataset_id"], ["dataset_info.id"], name="fk_gempa_dataset"
        ),
        sa.CheckConstraint("latitude BETWEEN -90 AND 90", name="ck_gempa_lat"),
        sa.CheckConstraint("longitude BETWEEN -180 AND 180", name="ck_gempa_lon"),
        sa.CheckConstraint(
            "latitude_rad BETWEEN -1.5707963267948966 AND 1.5707963267948966",
            name="ck_gempa_lat_rad",
        ),
        sa.CheckConstraint(
            "longitude_rad BETWEEN -3.141592653589793 AND 3.141592653589793",
            name="ck_gempa_lon_rad",
        ),
        sa.CheckConstraint(
            "abs(latitude_rad - latitude * 0.017453292519943295) <= 1e-10",
            name="ck_gempa_lat_rad_consistency",
        ),
        sa.CheckConstraint(
            "abs(longitude_rad - longitude * 0.017453292519943295) <= 1e-10",
            name="ck_gempa_lon_rad_consistency",
        ),
        sa.CheckConstraint("magnitude >= 0", name="ck_gempa_magnitude"),
        sa.CheckConstraint(
            "kedalaman IS NULL OR kedalaman >= 0", name="ck_gempa_depth"
        ),
    )
    op.create_index("ix_gempa_dataset", "gempa_processed", ["dataset_id"])
    op.create_index(
        "ix_gempa_dataset_date", "gempa_processed", ["dataset_id", "tanggal"]
    )
    op.create_index(
        "ix_gempa_dataset_magnitude", "gempa_processed", ["dataset_id", "magnitude"]
    )

    op.create_table(
        "processing_jobs",
        sa.Column("id", ID, autoincrement=True, nullable=False),
        sa.Column("dataset_id", ID, nullable=False),
        sa.Column("run_id", ID),
        sa.Column("job_type", sa.String(length=30), nullable=False),
        sa.Column("celery_task_id", sa.String(length=255)),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column(
            "progress", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("current_step", sa.String(length=100)),
        sa.Column("message", sa.Text()),
        sa.Column("error_code", sa.String(length=100)),
        sa.Column("error_detail", sa.Text()),
        sa.Column("created_by", ID, nullable=False),
        sa.Column("started_at", TS),
        sa.Column("finished_at", TS),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_processing_jobs"),
        sa.UniqueConstraint("id", "dataset_id", name="uq_processing_jobs_id_dataset"),
        sa.UniqueConstraint("celery_task_id", name="uq_processing_jobs_celery_task_id"),
        sa.ForeignKeyConstraint(
            ["dataset_id"], ["dataset_info.id"], name="fk_job_dataset"
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_job_created_by"),
        sa.CheckConstraint("progress BETWEEN 0 AND 100", name="ck_job_progress"),
        sa.CheckConstraint(
            "job_type IN ('PARAMETER_SEARCH', 'FINAL_CLUSTERING')", name="ck_job_type"
        ),
        sa.CheckConstraint(
            "status IN ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED')",
            name="ck_job_status",
        ),
        sa.CheckConstraint(
            "(job_type = 'PARAMETER_SEARCH' AND run_id IS NULL) OR "
            "(job_type = 'FINAL_CLUSTERING' AND run_id IS NOT NULL)",
            name="ck_job_run_requirement",
        ),
    )

    op.create_table(
        "dbscan_parameter_experiments",
        sa.Column("id", ID, autoincrement=True, nullable=False),
        sa.Column("dataset_id", ID, nullable=False),
        sa.Column("job_id", ID, nullable=False),
        sa.Column("eps_km", FLOAT, nullable=False),
        sa.Column("eps_radian", FLOAT, nullable=False),
        sa.Column("min_samples", sa.Integer(), nullable=False),
        sa.Column("cluster_count", sa.Integer(), nullable=False),
        sa.Column("noise_count", sa.Integer(), nullable=False),
        sa.Column("noise_percentage", FLOAT, nullable=False),
        sa.Column("clustered_count", sa.Integer(), nullable=False),
        sa.Column("min_cluster_size", sa.Integer()),
        sa.Column("median_cluster_size", FLOAT),
        sa.Column("max_cluster_size", sa.Integer()),
        sa.Column("silhouette_score", FLOAT),
        sa.Column("silhouette_sample_size", sa.Integer()),
        sa.Column("dbcv_score", FLOAT),
        sa.Column("stability_score", FLOAT),
        sa.Column("is_valid", sa.Boolean(), nullable=False),
        sa.Column("invalid_reason", sa.Text()),
        sa.Column(
            "is_recommended",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_dbscan_parameter_experiments"),
        sa.UniqueConstraint(
            "job_id", "eps_km", "min_samples", name="uq_experiment_job_eps_min_samples"
        ),
        sa.UniqueConstraint("id", "dataset_id", name="uq_experiment_id_dataset"),
        sa.ForeignKeyConstraint(
            ["job_id", "dataset_id"],
            ["processing_jobs.id", "processing_jobs.dataset_id"],
            name="fk_experiment_job_dataset",
        ),
        sa.CheckConstraint("eps_km > 0", name="ck_experiment_eps_km"),
        sa.CheckConstraint("eps_radian > 0", name="ck_experiment_eps_radian"),
        sa.CheckConstraint(
            "abs(eps_radian - (eps_km / 6371.0088)) <= 1e-10",
            name="ck_experiment_eps_conversion",
        ),
        sa.CheckConstraint("min_samples >= 2", name="ck_experiment_min_samples"),
        sa.CheckConstraint("cluster_count >= 0", name="ck_experiment_cluster_count"),
        sa.CheckConstraint("noise_count >= 0", name="ck_experiment_noise_count"),
        sa.CheckConstraint(
            "clustered_count >= 0", name="ck_experiment_clustered_count"
        ),
        sa.CheckConstraint(
            "(noise_count + clustered_count) > 0", name="ck_experiment_total_points"
        ),
        sa.CheckConstraint(
            "(cluster_count = 0 AND clustered_count = 0) "
            "OR (cluster_count > 0 AND clustered_count > 0)",
            name="ck_experiment_clustered_consistency",
        ),
        sa.CheckConstraint(
            "noise_percentage BETWEEN 0 AND 100", name="ck_experiment_noise_percentage"
        ),
        sa.CheckConstraint(
            "abs(noise_percentage - "
            "(noise_count * 100.0 / (noise_count + clustered_count))) <= 1e-6",
            name="ck_experiment_noise_percentage_consistency",
        ),
        sa.CheckConstraint(
            "min_cluster_size IS NULL OR min_cluster_size >= 1",
            name="ck_experiment_min_cluster_size",
        ),
        sa.CheckConstraint(
            "median_cluster_size IS NULL OR median_cluster_size >= 1",
            name="ck_experiment_median_cluster_size",
        ),
        sa.CheckConstraint(
            "max_cluster_size IS NULL OR max_cluster_size >= 1",
            name="ck_experiment_max_cluster_size",
        ),
        sa.CheckConstraint(
            "(min_cluster_size IS NULL AND median_cluster_size IS NULL AND max_cluster_size IS NULL) "
            "OR (min_cluster_size IS NOT NULL AND median_cluster_size IS NOT NULL "
            "AND max_cluster_size IS NOT NULL AND min_cluster_size <= median_cluster_size "
            "AND median_cluster_size <= max_cluster_size)",
            name="ck_experiment_cluster_size_order",
        ),
        sa.CheckConstraint(
            "silhouette_score IS NULL OR silhouette_score BETWEEN -1 AND 1",
            name="ck_experiment_silhouette_range",
        ),
        sa.CheckConstraint(
            "dbcv_score IS NULL OR dbcv_score BETWEEN -1 AND 1",
            name="ck_experiment_dbcv_range",
        ),
        sa.CheckConstraint(
            "silhouette_sample_size IS NULL OR silhouette_sample_size >= 2",
            name="ck_experiment_silhouette_sample_size",
        ),
        sa.CheckConstraint(
            "is_recommended = false OR is_valid = true",
            name="ck_experiment_recommended_must_be_valid",
        ),
    )

    op.create_table(
        "dbscan_runs",
        sa.Column("id", ID, autoincrement=True, nullable=False),
        sa.Column("dataset_id", ID, nullable=False),
        sa.Column("selected_experiment_id", ID, nullable=False),
        sa.Column("eps_km", FLOAT, nullable=False),
        sa.Column("eps_radian", FLOAT, nullable=False),
        sa.Column("min_samples", sa.Integer(), nullable=False),
        sa.Column(
            "metric",
            sa.String(length=30),
            server_default=sa.text("'haversine'"),
            nullable=False,
        ),
        sa.Column(
            "earth_radius_km",
            FLOAT,
            server_default=sa.text("6371.0088"),
            nullable=False,
        ),
        sa.Column("cluster_count", sa.Integer()),
        sa.Column("noise_count", sa.Integer()),
        sa.Column("noise_percentage", FLOAT),
        sa.Column("total_points", sa.Integer()),
        sa.Column("silhouette_score", FLOAT),
        sa.Column("silhouette_sample_size", sa.Integer()),
        sa.Column("dbcv_score", FLOAT),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("created_by", ID, nullable=False),
        sa.Column("approved_by", ID),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", TS),
        sa.Column("activated_at", TS),
        sa.PrimaryKeyConstraint("id", name="pk_dbscan_runs"),
        sa.UniqueConstraint("id", "dataset_id", name="uq_run_id_dataset"),
        sa.ForeignKeyConstraint(
            ["dataset_id"], ["dataset_info.id"], name="fk_run_dataset"
        ),
        sa.ForeignKeyConstraint(
            ["selected_experiment_id", "dataset_id"],
            [
                "dbscan_parameter_experiments.id",
                "dbscan_parameter_experiments.dataset_id",
            ],
            name="fk_run_selected_experiment",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_run_created_by"),
        sa.ForeignKeyConstraint(
            ["approved_by"], ["users.id"], name="fk_run_approved_by"
        ),
        sa.CheckConstraint(
            "status IN ('DRAFT', 'CLUSTERING', 'SUCCESS', 'FAILED', 'ARCHIVED')",
            name="ck_run_status",
        ),
        sa.CheckConstraint("eps_km > 0", name="ck_run_eps_km"),
        sa.CheckConstraint("eps_radian > 0", name="ck_run_eps_radian"),
        sa.CheckConstraint("min_samples >= 2", name="ck_run_min_samples"),
        sa.CheckConstraint("metric = 'haversine'", name="ck_run_metric_haversine"),
        sa.CheckConstraint("earth_radius_km > 0", name="ck_run_earth_radius"),
        sa.CheckConstraint(
            "abs(eps_radian - (eps_km / earth_radius_km)) <= 1e-10",
            name="ck_run_eps_conversion",
        ),
        sa.CheckConstraint(
            "cluster_count IS NULL OR cluster_count >= 0", name="ck_run_cluster_count"
        ),
        sa.CheckConstraint(
            "noise_count IS NULL OR noise_count >= 0", name="ck_run_noise_count"
        ),
        sa.CheckConstraint(
            "total_points IS NULL OR total_points > 0", name="ck_run_total_points"
        ),
        sa.CheckConstraint(
            "noise_percentage IS NULL OR noise_percentage BETWEEN 0 AND 100",
            name="ck_run_noise_percentage",
        ),
        sa.CheckConstraint(
            "silhouette_score IS NULL OR silhouette_score BETWEEN -1 AND 1",
            name="ck_run_silhouette_range",
        ),
        sa.CheckConstraint(
            "dbcv_score IS NULL OR dbcv_score BETWEEN -1 AND 1",
            name="ck_run_dbcv_range",
        ),
        sa.CheckConstraint(
            "silhouette_sample_size IS NULL OR silhouette_sample_size >= 2",
            name="ck_run_silhouette_sample_size",
        ),
        sa.CheckConstraint(
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
        sa.CheckConstraint(
            "status <> 'SUCCESS' OR (cluster_count IS NOT NULL "
            "AND noise_count IS NOT NULL AND noise_percentage IS NOT NULL "
            "AND total_points IS NOT NULL AND completed_at IS NOT NULL)",
            name="ck_run_success_requires_results",
        ),
        sa.CheckConstraint(
            "is_active = false OR (status = 'SUCCESS' AND activated_at IS NOT NULL)",
            name="ck_active_run_must_be_success",
        ),
    )
    op.create_index(
        "uq_one_active_dbscan_run",
        "dbscan_runs",
        ["is_active"],
        unique=True,
        postgresql_where=sa.text("is_active IS TRUE"),
        sqlite_where=sa.text("is_active = 1"),
    )
    op.create_index("ix_dbscan_runs_dataset", "dbscan_runs", ["dataset_id"])

    op.create_table(
        "dbscan_memberships",
        sa.Column("id", ID, autoincrement=True, nullable=False),
        sa.Column("dataset_id", ID, nullable=False),
        sa.Column("dbscan_run_id", ID, nullable=False),
        sa.Column("gempa_id", ID, nullable=False),
        sa.Column("cluster_id", sa.Integer(), nullable=False),
        sa.Column("is_noise", sa.Boolean(), nullable=False),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_dbscan_memberships"),
        sa.UniqueConstraint(
            "dbscan_run_id", "gempa_id", name="uq_membership_run_gempa"
        ),
        sa.ForeignKeyConstraint(
            ["dbscan_run_id", "dataset_id"],
            ["dbscan_runs.id", "dbscan_runs.dataset_id"],
            name="fk_membership_run_dataset",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["gempa_id", "dataset_id"],
            ["gempa_processed.id", "gempa_processed.dataset_id"],
            name="fk_membership_gempa_dataset",
        ),
        sa.CheckConstraint(
            "(is_noise = true AND cluster_id = -1) OR (is_noise = false AND cluster_id >= 0)",
            name="ck_membership_noise",
        ),
    )
    op.create_index(
        "ix_membership_run_cluster",
        "dbscan_memberships",
        ["dbscan_run_id", "cluster_id"],
    )

    op.create_table(
        "profil_klaster",
        sa.Column("id", ID, autoincrement=True, nullable=False),
        sa.Column("dbscan_run_id", ID, nullable=False),
        sa.Column("cluster_id", sa.Integer(), nullable=False),
        sa.Column("event_count", sa.Integer(), nullable=False),
        sa.Column("avg_magnitude", FLOAT),
        sa.Column("min_magnitude", FLOAT),
        sa.Column("max_magnitude", FLOAT),
        sa.Column("avg_depth", FLOAT),
        sa.Column("min_depth", FLOAT),
        sa.Column("max_depth", FLOAT),
        sa.Column(
            "shallow_event_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "medium_event_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "deep_event_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("first_event_date", TS),
        sa.Column("last_event_date", TS),
        sa.Column("centroid_latitude", FLOAT),
        sa.Column("centroid_longitude", FLOAT),
        sa.Column("dominant_location", sa.Text()),
        sa.Column("radius_km", FLOAT),
        sa.Column("max_radius_km", FLOAT),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_profil_klaster"),
        sa.UniqueConstraint(
            "dbscan_run_id", "cluster_id", name="uq_profile_run_cluster"
        ),
        sa.ForeignKeyConstraint(
            ["dbscan_run_id"],
            ["dbscan_runs.id"],
            name="fk_profile_run",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("cluster_id >= 0", name="ck_profile_cluster_id"),
        sa.CheckConstraint("event_count > 0", name="ck_profile_event_count"),
        sa.CheckConstraint(
            "(avg_magnitude IS NULL AND min_magnitude IS NULL AND max_magnitude IS NULL) "
            "OR (avg_magnitude IS NOT NULL AND min_magnitude IS NOT NULL "
            "AND max_magnitude IS NOT NULL AND min_magnitude >= 0 "
            "AND avg_magnitude >= 0 AND max_magnitude >= 0 "
            "AND min_magnitude <= avg_magnitude AND avg_magnitude <= max_magnitude)",
            name="ck_profile_magnitude_stats",
        ),
        sa.CheckConstraint(
            "(avg_depth IS NULL AND min_depth IS NULL AND max_depth IS NULL) "
            "OR (avg_depth IS NOT NULL AND min_depth IS NOT NULL "
            "AND max_depth IS NOT NULL AND min_depth >= 0 "
            "AND min_depth <= avg_depth AND avg_depth <= max_depth)",
            name="ck_profile_depth_stats",
        ),
        sa.CheckConstraint("shallow_event_count >= 0", name="ck_profile_shallow_count"),
        sa.CheckConstraint("medium_event_count >= 0", name="ck_profile_medium_count"),
        sa.CheckConstraint("deep_event_count >= 0", name="ck_profile_deep_count"),
        sa.CheckConstraint(
            "shallow_event_count + medium_event_count + deep_event_count <= event_count",
            name="ck_profile_depth_category_total",
        ),
        sa.CheckConstraint(
            "(first_event_date IS NULL AND last_event_date IS NULL) "
            "OR (first_event_date IS NOT NULL AND last_event_date IS NOT NULL "
            "AND first_event_date <= last_event_date)",
            name="ck_profile_event_date_order",
        ),
        sa.CheckConstraint(
            "(centroid_latitude IS NULL AND centroid_longitude IS NULL) "
            "OR (centroid_latitude IS NOT NULL AND centroid_longitude IS NOT NULL "
            "AND centroid_latitude BETWEEN -90 AND 90 "
            "AND centroid_longitude BETWEEN -180 AND 180)",
            name="ck_profile_centroid_range",
        ),
        sa.CheckConstraint(
            "radius_km IS NULL OR radius_km >= 0", name="ck_profile_radius_nonnegative"
        ),
        sa.CheckConstraint(
            "max_radius_km IS NULL OR max_radius_km >= 0",
            name="ck_profile_max_radius_nonnegative",
        ),
        sa.CheckConstraint(
            "radius_km IS NULL OR max_radius_km IS NULL OR radius_km <= max_radius_km",
            name="ck_profile_radius_order",
        ),
    )

    op.create_table(
        "processing_artifacts",
        sa.Column("id", ID, autoincrement=True, nullable=False),
        sa.Column("dataset_id", ID, nullable=False),
        sa.Column("job_id", ID),
        sa.Column("run_id", ID),
        sa.Column("artifact_type", sa.String(length=50), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_hash_sha256", sa.CHAR(length=64), nullable=False),
        sa.Column(
            "metadata", JSON_TYPE, server_default=sa.text("'{}'"), nullable=False
        ),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_processing_artifacts"),
        sa.ForeignKeyConstraint(
            ["dataset_id"], ["dataset_info.id"], name="fk_artifact_dataset"
        ),
        sa.ForeignKeyConstraint(
            ["job_id", "dataset_id"],
            ["processing_jobs.id", "processing_jobs.dataset_id"],
            name="fk_artifact_job_dataset",
        ),
        sa.ForeignKeyConstraint(
            ["run_id", "dataset_id"],
            ["dbscan_runs.id", "dbscan_runs.dataset_id"],
            name="fk_artifact_run_dataset",
        ),
        sa.CheckConstraint(
            "artifact_type IN ('VALIDATION_REPORT', 'REJECTED_ROWS', 'K_DISTANCE_DATA', "
            "'K_DISTANCE_PLOT', 'PARAMETER_EXPERIMENT', 'SENSITIVITY_ANALYSIS', "
            "'FINAL_ASSIGNMENT', 'CLUSTER_PROFILE', 'RUN_METADATA')",
            name="ck_artifact_type",
        ),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", ID, autoincrement=True, nullable=False),
        sa.Column("user_id", ID),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=50)),
        sa.Column("entity_id", ID),
        sa.Column("details", JSON_TYPE, server_default=sa.text("'{}'"), nullable=False),
        sa.Column("ip_address", IP_TYPE),
        sa.Column("user_agent", sa.Text()),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_audit_logs"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_audit_user"),
    )

    # Circular relationship is added after dbscan_runs exists.
    op.create_foreign_key(
        "fk_job_run_dataset",
        "processing_jobs",
        "dbscan_runs",
        ["run_id", "dataset_id"],
        ["id", "dataset_id"],
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("processing_artifacts")
    op.drop_index("ix_membership_run_cluster", table_name="dbscan_memberships")
    op.drop_table("dbscan_memberships")
    op.drop_table("profil_klaster")
    op.drop_index("ix_dbscan_runs_dataset", table_name="dbscan_runs")
    op.drop_index("uq_one_active_dbscan_run", table_name="dbscan_runs")
    op.drop_table("dbscan_runs")
    op.drop_table("dbscan_parameter_experiments")
    op.drop_table("processing_jobs")
    op.drop_index("ix_gempa_dataset_magnitude", table_name="gempa_processed")
    op.drop_index("ix_gempa_dataset_date", table_name="gempa_processed")
    op.drop_index("ix_gempa_dataset", table_name="gempa_processed")
    op.drop_table("gempa_processed")
    op.drop_table("dataset_info")
    op.drop_table("users")
