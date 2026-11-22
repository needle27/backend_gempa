import hashlib

import pytest

from repositories.artifact_repository import ArtifactRepository
from services.artifact_service import ArtifactService
from services.exceptions import ValidationError


def test_artifact_service_registers_file_and_hash(app, seeded_dataset, tmp_path):
    with app.app_context():
        artifact_path = tmp_path / "run_metadata.json"
        artifact_path.write_text('{"metric":"haversine","eps_km":2.0}', encoding="utf-8")

        artifact = ArtifactService().register_file(
            dataset_id=seeded_dataset["dataset"].id,
            artifact_type="RUN_METADATA",
            file_path=artifact_path,
            mime_type="application/json",
            metadata={"purpose": "functional-test"},
        )

        assert artifact.id is not None
        assert artifact.file_hash_sha256 == hashlib.sha256(artifact_path.read_bytes()).hexdigest()
        assert artifact.artifact_metadata["purpose"] == "functional-test"
        assert ArtifactRepository().count(dataset_id=seeded_dataset["dataset"].id) == 1


def test_artifact_service_rejects_missing_file(app, seeded_dataset, tmp_path):
    with app.app_context():
        with pytest.raises(ValidationError, match="tidak ditemukan"):
            ArtifactService().register_file(
                dataset_id=seeded_dataset["dataset"].id,
                artifact_type="RUN_METADATA",
                file_path=tmp_path / "does-not-exist.json",
                mime_type="application/json",
            )
