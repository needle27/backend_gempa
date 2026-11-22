from repositories.dataset_repository import DatasetRepository
from repositories.earthquake_repository import EarthquakeRepository
from repositories.user_repository import UserRepository


def test_repository_queries_work_against_isolated_database(app, admin_user, seeded_dataset):
    with app.app_context():
        dataset_id = seeded_dataset["dataset"].id

        assert UserRepository().get_by_email("admin.test@example.invalid").id == admin_user.id
        assert DatasetRepository().get_by_hash(
            seeded_dataset["dataset"].file_hash_sha256
        ).id == dataset_id
        assert DatasetRepository().count(status="READY") == 1
        assert EarthquakeRepository().count_for_dataset(dataset_id) == 6
        assert len(EarthquakeRepository().coordinates_for_dataset(dataset_id)) == 6
