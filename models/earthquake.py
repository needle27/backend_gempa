"""Clean earthquake event model."""

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Double,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)

from extensions import db
from models.types import BIG_ID


class Earthquake(db.Model):
    __tablename__ = "gempa_processed"
    __table_args__ = (
        UniqueConstraint("dataset_id", "event_id", name="uq_gempa_dataset_event"),
        UniqueConstraint("id", "dataset_id", name="uq_gempa_id_dataset"),
        CheckConstraint("latitude BETWEEN -90 AND 90", name="ck_gempa_lat"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="ck_gempa_lon"),
        CheckConstraint(
            "latitude_rad BETWEEN -1.5707963267948966 AND 1.5707963267948966",
            name="ck_gempa_lat_rad",
        ),
        CheckConstraint(
            "longitude_rad BETWEEN -3.141592653589793 AND 3.141592653589793",
            name="ck_gempa_lon_rad",
        ),
        CheckConstraint(
            "abs(latitude_rad - latitude * 0.017453292519943295) <= 1e-10",
            name="ck_gempa_lat_rad_consistency",
        ),
        CheckConstraint(
            "abs(longitude_rad - longitude * 0.017453292519943295) <= 1e-10",
            name="ck_gempa_lon_rad_consistency",
        ),
        CheckConstraint("magnitude >= 0", name="ck_gempa_magnitude"),
        CheckConstraint("kedalaman IS NULL OR kedalaman >= 0", name="ck_gempa_depth"),
        Index("ix_gempa_dataset", "dataset_id"),
        Index("ix_gempa_dataset_date", "dataset_id", "tanggal"),
        Index("ix_gempa_dataset_magnitude", "dataset_id", "magnitude"),
    )

    id = db.Column(BIG_ID, primary_key=True, autoincrement=True)
    dataset_id = db.Column(
        BIG_ID,
        ForeignKey("dataset_info.id", name="fk_gempa_dataset"),
        nullable=False,
    )
    event_id = db.Column(String(150), nullable=False)
    tanggal = db.Column(DateTime(timezone=True), nullable=False)
    latitude = db.Column(Double, nullable=False)
    longitude = db.Column(Double, nullable=False)
    latitude_rad = db.Column(Double, nullable=False)
    longitude_rad = db.Column(Double, nullable=False)
    magnitude = db.Column(Double, nullable=False)
    kedalaman = db.Column(Double)
    lokasi = db.Column(Text)
    created_at = db.Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
