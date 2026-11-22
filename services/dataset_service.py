"""Import an already-clean CSV into dataset_info and gempa_processed.

This service rejects invalid rows; it does not silently clean, drop, or impute them.
The uploaded source file must already have been stored by the upload/route layer.
"""

import csv
import hashlib
import math
from pathlib import Path

from extensions import db
from models.dataset import DatasetInfo
from models.earthquake import Earthquake
from repositories.dataset_repository import DatasetRepository
from services.exceptions import ConflictError, ValidationError
from services.utils import finite_float, parse_aware_datetime


class DatasetService:
    REQUIRED_METADATA = (
        "dataset_name",
        "source_name",
        "original_filename",
        "storage_path",
    )

    def __init__(self, dataset_repository=None):
        self.datasets = dataset_repository or DatasetRepository()

    @staticmethod
    def _file_hash(file_path):
        digest = hashlib.sha256()
        with open(file_path, "rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def import_clean_csv(
        self,
        *,
        file_path,
        metadata,
        uploaded_by,
        column_mapping=None,
    ):
        path = Path(file_path)
        if not path.is_file():
            raise ValidationError("File CSV tidak ditemukan.")
        mapping = {
            "event_id": "event_id",
            "tanggal": "tanggal",
            "latitude": "latitude",
            "longitude": "longitude",
            "magnitude": "magnitude",
            "kedalaman": "kedalaman",
            "lokasi": "lokasi",
        }
        if column_mapping:
            mapping.update(column_mapping)

        file_hash = self._file_hash(path)
        try:
            with path.open("r", encoding="utf-8-sig", newline="") as stream:
                reader = csv.DictReader(stream)
                if not reader.fieldnames:
                    raise ValidationError("CSV tidak memiliki header.")
                required_headers = [
                    mapping[key] for key in ("tanggal", "latitude", "longitude", "magnitude")
                ]
                missing = [name for name in required_headers if name not in reader.fieldnames]
                if missing:
                    raise ValidationError("Kolom wajib tidak ditemukan: " + ", ".join(missing))

                def rows():
                    for row in reader:
                        yield {
                            key: row.get(source_name)
                            for key, source_name in mapping.items()
                            if source_name in row
                        }

                return self.import_clean_rows(
                    metadata=metadata,
                    rows=rows(),
                    uploaded_by=uploaded_by,
                    file_hash_sha256=file_hash,
                )
        except UnicodeDecodeError as exc:
            raise ValidationError("CSV harus menggunakan encoding UTF-8 atau UTF-8-SIG.") from exc

    def import_clean_rows(self, *, metadata, rows, uploaded_by, file_hash_sha256):
        metadata = dict(metadata or {})
        missing = [key for key in self.REQUIRED_METADATA if not metadata.get(key)]
        if missing:
            raise ValidationError("Metadata wajib belum lengkap: " + ", ".join(missing))
        if not isinstance(file_hash_sha256, str) or len(file_hash_sha256) != 64:
            raise ValidationError("SHA-256 file harus berisi 64 karakter hexadecimal.")
        try:
            int(file_hash_sha256, 16)
        except ValueError as exc:
            raise ValidationError("Hash file bukan SHA-256 hexadecimal yang valid.") from exc
        if self.datasets.get_by_hash(file_hash_sha256):
            raise ConflictError("File dengan hash SHA-256 yang sama sudah terdaftar.")

        normalized = []
        seen_event_ids = set()
        timestamps = []
        latitudes, longitudes = [], []

        try:
            for row_number, source in enumerate(rows, start=1):
                row = dict(source)
                timestamp = parse_aware_datetime(row.get("tanggal"), "tanggal")
                latitude = finite_float(row.get("latitude"), "latitude")
                longitude = finite_float(row.get("longitude"), "longitude")
                magnitude = finite_float(row.get("magnitude"), "magnitude")

                if not -90 <= latitude <= 90:
                    raise ValueError(f"Baris {row_number}: latitude di luar -90 sampai 90.")
                if not -180 <= longitude <= 180:
                    raise ValueError(f"Baris {row_number}: longitude di luar -180 sampai 180.")
                if magnitude < 0:
                    raise ValueError(f"Baris {row_number}: magnitude tidak boleh negatif.")

                depth_raw = row.get("kedalaman")
                depth = None if depth_raw is None or str(depth_raw).strip() == "" else finite_float(depth_raw, "kedalaman")
                if depth is not None and depth < 0:
                    raise ValueError(f"Baris {row_number}: kedalaman tidak boleh negatif.")

                latitude_rad = math.radians(latitude)
                longitude_rad = math.radians(longitude)
                if row.get("latitude_rad") not in (None, ""):
                    supplied = finite_float(row["latitude_rad"], "latitude_rad")
                    if abs(supplied - latitude_rad) > 1e-10:
                        raise ValueError(f"Baris {row_number}: latitude_rad tidak konsisten.")
                if row.get("longitude_rad") not in (None, ""):
                    supplied = finite_float(row["longitude_rad"], "longitude_rad")
                    if abs(supplied - longitude_rad) > 1e-10:
                        raise ValueError(f"Baris {row_number}: longitude_rad tidak konsisten.")

                event_id = str(row.get("event_id") or f"csv-row:{row_number:09d}").strip()
                if not event_id:
                    raise ValueError(f"Baris {row_number}: event_id kosong.")
                if event_id in seen_event_ids:
                    raise ValueError(f"Baris {row_number}: event_id duplikat ({event_id}).")
                seen_event_ids.add(event_id)

                normalized.append(
                    {
                        "event_id": event_id,
                        "tanggal": timestamp,
                        "latitude": latitude,
                        "longitude": longitude,
                        "latitude_rad": latitude_rad,
                        "longitude_rad": longitude_rad,
                        "magnitude": magnitude,
                        "kedalaman": depth,
                        "lokasi": str(row.get("lokasi")).strip() if row.get("lokasi") not in (None, "") else None,
                    }
                )
                timestamps.append(timestamp)
                latitudes.append(latitude)
                longitudes.append(longitude)

            if not normalized:
                raise ValueError("CSV tidak berisi baris data.")

            dataset = DatasetInfo(
                dataset_name=str(metadata["dataset_name"]).strip(),
                source_name=str(metadata["source_name"]).strip(),
                source_url=metadata.get("source_url"),
                original_filename=str(metadata["original_filename"]),
                storage_path=str(metadata["storage_path"]),
                file_hash_sha256=file_hash_sha256.lower(),
                start_date=min(timestamps).date(),
                end_date=max(timestamps).date(),
                latitude_min=min(latitudes),
                latitude_max=max(latitudes),
                longitude_min=min(longitudes),
                longitude_max=max(longitudes),
                raw_row_count=len(normalized),
                cleaned_row_count=len(normalized),
                rejected_row_count=0,
                preprocessing_version=metadata.get("preprocessing_version"),
                validation_report={
                    "validation_stage": "backend_import",
                    "input_contract": "cleaned_csv",
                    "accepted_rows": len(normalized),
                    "rejected_rows": 0,
                    "timezone_policy": "timestamp harus menyertakan offset/zona waktu; backend tidak menebak",
                    "radian_policy": "latitude_rad dan longitude_rad dihitung ulang dari derajat",
                    "event_id_policy": "event_id sumber dipakai; jika tidak tersedia digunakan csv-row berbasis nomor baris",
                },
                status="READY",
                uploaded_by=uploaded_by,
            )
            db.session.add(dataset)
            db.session.flush()

            earthquake_rows = [
                Earthquake(dataset_id=dataset.id, **item) for item in normalized
            ]
            db.session.add_all(earthquake_rows)
            db.session.commit()
            return dataset
        except (ValueError, TypeError) as exc:
            db.session.rollback()
            raise ValidationError(str(exc)) from exc
        except Exception:
            db.session.rollback()
            raise
