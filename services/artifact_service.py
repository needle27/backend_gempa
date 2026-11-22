import hashlib
from pathlib import Path

from extensions import db
from models.artifact import ProcessingArtifact
from repositories.artifact_repository import ArtifactRepository
from services.exceptions import ValidationError


class ArtifactService:
    def __init__(self, repository=None):
        self.repository = repository or ArtifactRepository()

    def register_file(
        self,
        *,
        dataset_id,
        artifact_type,
        file_path,
        mime_type,
        filename=None,
        job_id=None,
        run_id=None,
        metadata=None,
        commit=True,
    ):
        path = Path(file_path)
        if not path.is_file():
            raise ValidationError("File artifact tidak ditemukan.")
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        artifact = ProcessingArtifact(
            dataset_id=dataset_id,
            job_id=job_id,
            run_id=run_id,
            artifact_type=artifact_type,
            filename=filename or path.name,
            storage_path=str(path),
            mime_type=mime_type,
            file_hash_sha256=digest.hexdigest(),
            artifact_metadata=metadata or {},
        )
        try:
            self.repository.add(artifact)
            if commit:
                db.session.commit()
            return artifact
        except Exception:
            if commit:
                db.session.rollback()
            raise
