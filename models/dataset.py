"""Dataset registry model."""

from sqlalchemy import (
    CHAR,
    CheckConstraint,
    Date,
    DateTime,
    Double,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)

from extensions import db
from models.types import BIG_ID, JSON_DOCUMENT


class DatasetInfo(db.Model):
    __tablename__ = "dataset_info"
    __table_args__ = (
        UniqueConstraint("file_hash_sha256", name="uq_dataset_info_file_hash_sha256"),
        CheckConstraint("start_date <= end_date", name="ck_dataset_date_range"),
        CheckConstraint("raw_row_count >= 0", name="ck_dataset_raw_row_count"),
        CheckConstraint("cleaned_row_count >= 0", name="ck_dataset_cleaned_row_count"),
        CheckConstraint(
            "rejected_row_count >= 0", name="ck_dataset_rejected_row_count"
        ),
        CheckConstraint(
            "raw_row_count = cleaned_row_count + rejected_row_count",
            name="ck_dataset_row_count_balance",
        ),
        CheckConstraint(
            "latitude_min BETWEEN -90 AND 90",
            name="ck_dataset_latitude_min",
        ),
        CheckConstraint(
            "latitude_max BETWEEN -90 AND 90",
            name="ck_dataset_latitude_max",
        ),
        CheckConstraint(
            "longitude_min BETWEEN -180 AND 180",
            name="ck_dataset_longitude_min",
        ),
        CheckConstraint(
            "longitude_max BETWEEN -180 AND 180",
            name="ck_dataset_longitude_max",
        ),
        CheckConstraint(
            "latitude_min <= latitude_max",
            name="ck_dataset_latitude_range",
        ),
        CheckConstraint(
            "longitude_min <= longitude_max",
            name="ck_dataset_longitude_range",
        ),
        CheckConstraint(
            "status IN ('UPLOADED', 'VALIDATING', 'READY', 'INVALID', 'PROCESSING', 'PROCESSED', 'ARCHIVED')",
            name="ck_dataset_status",
        ),
    )

    id = db.Column(BIG_ID, primary_key=True, autoincrement=True)
    dataset_name = db.Column(String(255), nullable=False)
    source_name = db.Column(String(100), nullable=False)
    source_url = db.Column(Text)
    original_filename = db.Column(String(255), nullable=False)
    storage_path = db.Column(Text, nullable=False)
    file_hash_sha256 = db.Column(CHAR(64), nullable=False)
    start_date = db.Column(Date, nullable=False)
    end_date = db.Column(Date, nullable=False)
    # Bounding-box metadata is mandatory for every accepted dataset.
    latitude_min = db.Column(Double, nullable=False)
    latitude_max = db.Column(Double, nullable=False)
    longitude_min = db.Column(Double, nullable=False)
    longitude_max = db.Column(Double, nullable=False)
    raw_row_count = db.Column(Integer, nullable=False)
    cleaned_row_count = db.Column(Integer, nullable=False)
    rejected_row_count = db.Column(Integer, nullable=False, server_default=text("0"))
    preprocessing_version = db.Column(String(100))
    validation_report = db.Column(
        JSON_DOCUMENT,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )
    status = db.Column(String(30), nullable=False)
    uploaded_by = db.Column(
        BIG_ID,
        ForeignKey("users.id", name="fk_dataset_uploaded_by"),
        nullable=False,
    )
    created_at = db.Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = db.Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
