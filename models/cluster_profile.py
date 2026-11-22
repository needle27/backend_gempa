"""Aggregated non-noise cluster profile model."""

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Double,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
    text,
)

from extensions import db
from models.types import BIG_ID


class ClusterProfile(db.Model):
    __tablename__ = "profil_klaster"
    __table_args__ = (
        UniqueConstraint("dbscan_run_id", "cluster_id", name="uq_profile_run_cluster"),
        CheckConstraint("cluster_id >= 0", name="ck_profile_cluster_id"),
        CheckConstraint("event_count > 0", name="ck_profile_event_count"),
        CheckConstraint(
            "(avg_magnitude IS NULL AND min_magnitude IS NULL AND max_magnitude IS NULL) "
            "OR (avg_magnitude IS NOT NULL AND min_magnitude IS NOT NULL "
            "AND max_magnitude IS NOT NULL AND min_magnitude >= 0 "
            "AND avg_magnitude >= 0 AND max_magnitude >= 0 "
            "AND min_magnitude <= avg_magnitude AND avg_magnitude <= max_magnitude)",
            name="ck_profile_magnitude_stats",
        ),
        CheckConstraint(
            "(avg_depth IS NULL AND min_depth IS NULL AND max_depth IS NULL) "
            "OR (avg_depth IS NOT NULL AND min_depth IS NOT NULL "
            "AND max_depth IS NOT NULL AND min_depth >= 0 "
            "AND min_depth <= avg_depth AND avg_depth <= max_depth)",
            name="ck_profile_depth_stats",
        ),
        CheckConstraint(
            "shallow_event_count >= 0",
            name="ck_profile_shallow_count",
        ),
        CheckConstraint(
            "medium_event_count >= 0",
            name="ck_profile_medium_count",
        ),
        CheckConstraint(
            "deep_event_count >= 0",
            name="ck_profile_deep_count",
        ),
        CheckConstraint(
            "shallow_event_count + medium_event_count + deep_event_count <= event_count",
            name="ck_profile_depth_category_total",
        ),
        CheckConstraint(
            "(first_event_date IS NULL AND last_event_date IS NULL) "
            "OR (first_event_date IS NOT NULL AND last_event_date IS NOT NULL "
            "AND first_event_date <= last_event_date)",
            name="ck_profile_event_date_order",
        ),
        CheckConstraint(
            "(centroid_latitude IS NULL AND centroid_longitude IS NULL) "
            "OR (centroid_latitude IS NOT NULL AND centroid_longitude IS NOT NULL "
            "AND centroid_latitude BETWEEN -90 AND 90 "
            "AND centroid_longitude BETWEEN -180 AND 180)",
            name="ck_profile_centroid_range",
        ),
        CheckConstraint(
            "radius_km IS NULL OR radius_km >= 0",
            name="ck_profile_radius_nonnegative",
        ),
        CheckConstraint(
            "max_radius_km IS NULL OR max_radius_km >= 0",
            name="ck_profile_max_radius_nonnegative",
        ),
        CheckConstraint(
            "radius_km IS NULL OR max_radius_km IS NULL OR radius_km <= max_radius_km",
            name="ck_profile_radius_order",
        ),
    )

    id = db.Column(BIG_ID, primary_key=True, autoincrement=True)
    dbscan_run_id = db.Column(
        BIG_ID,
        ForeignKey("dbscan_runs.id", name="fk_profile_run", ondelete="CASCADE"),
        nullable=False,
    )
    cluster_id = db.Column(Integer, nullable=False)
    event_count = db.Column(Integer, nullable=False)
    avg_magnitude = db.Column(Double)
    min_magnitude = db.Column(Double)
    max_magnitude = db.Column(Double)
    avg_depth = db.Column(Double)
    min_depth = db.Column(Double)
    max_depth = db.Column(Double)
    shallow_event_count = db.Column(Integer, nullable=False, server_default=text("0"))
    medium_event_count = db.Column(Integer, nullable=False, server_default=text("0"))
    deep_event_count = db.Column(Integer, nullable=False, server_default=text("0"))
    first_event_date = db.Column(DateTime(timezone=True))
    last_event_date = db.Column(DateTime(timezone=True))
    centroid_latitude = db.Column(Double)
    centroid_longitude = db.Column(Double)
    dominant_location = db.Column(Text)
    radius_km = db.Column(Double)
    max_radius_km = db.Column(Double)
    created_at = db.Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
