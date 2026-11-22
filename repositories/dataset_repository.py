from sqlalchemy import select

from models.dataset import DatasetInfo
from repositories.base import BaseRepository


class DatasetRepository(BaseRepository):
    model = DatasetInfo

    def get_by_hash(self, file_hash_sha256):
        return self.session.scalar(
            select(DatasetInfo).where(DatasetInfo.file_hash_sha256 == file_hash_sha256)
        )

    def list_by_status(self, status, *, page=1, per_page=50):
        return self.list(page=page, per_page=per_page, status=status, order_by="created_at", descending=True)

    def list_all(self):
        """Return all datasets ordered by newest first."""
        return self.session.scalars(
            select(DatasetInfo).order_by(DatasetInfo.created_at.desc())
        ).all()
