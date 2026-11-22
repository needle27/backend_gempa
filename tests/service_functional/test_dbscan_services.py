import pytest

from extensions import db
from repositories.experiment_repository import ExperimentRepository
from repositories.job_repository import JobRepository
from repositories.membership_repository import MembershipRepository
from repositories.cluster_profile_repository import ClusterProfileRepository
from repositories.run_repository import RunRepository
from services.dbscan_run_service import DBSCANRunService
from services.exceptions import NotFoundError, ValidationError
from services.parameter_search_service import ParameterSearchService
from services.webgis_service import WebGISService


def test_parameter_search_calculates_k_distance_and_saves_experiments(app, seeded_dataset):
    with app.app_context():
        dataset_id = seeded_dataset["dataset"].id
        user_id = seeded_dataset["user"].id
        service = ParameterSearchService()

        result = service.calculate_k_distance(dataset_id=dataset_id, min_samples=2)
        assert len(result["k_distance_km"]) == 6
        assert result["k_distance_km"] == sorted(result["k_distance_km"])
        assert all(value >= 0 for value in result["k_distance_km"])
        assert result["earth_radius_km"] == pytest.approx(6371.0088)

        search = service.run_search(
            dataset_id=dataset_id,
            eps_candidates_km=[2.0],
            min_samples_candidates=[2],
            created_by=user_id,
        )

        assert search["job"].status == "SUCCESS"
        assert search["job"].progress == 100
        assert len(search["experiments"]) == 1

        experiment = search["experiments"][0]
        assert experiment.cluster_count == 2
        assert experiment.noise_count == 0
        assert experiment.clustered_count == 6
        assert experiment.is_valid is True
        assert experiment.silhouette_score is not None
        assert experiment.dbi_score is None
        assert experiment.dbcv_score is None
        assert set(experiment.evaluation_metadata["metrics"]) == {"silhouette"}
        assert experiment.eps_radian == pytest.approx(2.0 / 6371.0088)
        assert ExperimentRepository().count(job_id=search["job"].id) == 1
        assert JobRepository().count(dataset_id=dataset_id) == 1


def test_parameter_search_rejects_invalid_candidates(app, seeded_dataset):
    with app.app_context():
        with pytest.raises(ValidationError):
            ParameterSearchService().run_search(
                dataset_id=seeded_dataset["dataset"].id,
                eps_candidates_km=[0, -1],
                min_samples_candidates=[2],
                created_by=seeded_dataset["user"].id,
            )
        assert JobRepository().count() == 0


def _run_search(dataset_id, user_id):
    return ParameterSearchService().run_search(
        dataset_id=dataset_id,
        eps_candidates_km=[2.0],
        min_samples_candidates=[2],
        created_by=user_id,
    )


def test_final_dbscan_activation_and_webgis_projection(app, seeded_dataset):
    with app.app_context():
        dataset_id = seeded_dataset["dataset"].id
        user_id = seeded_dataset["user"].id

        search = _run_search(dataset_id, user_id)
        experiment_id = search["experiments"][0].id

        result = DBSCANRunService().execute_final_clustering(
            dataset_id=dataset_id,
            experiment_id=experiment_id,
            created_by=user_id,
        )
        run = result["run"]

        assert run.status == "SUCCESS"
        assert run.total_points == 6
        assert run.cluster_count == 2
        assert run.noise_count == 0
        assert run.silhouette_score == pytest.approx(search["experiments"][0].silhouette_score)
        assert run.dbi_score is None
        assert run.dbcv_score is None
        assert len(result["profiles"]) == 2
        assert MembershipRepository().count(dbscan_run_id=run.id) == 6
        assert ClusterProfileRepository().count(dbscan_run_id=run.id) == 2

        profile_counts = [
            (
                profile.shallow_event_count,
                profile.medium_event_count,
                profile.deep_event_count,
            )
            for profile in result["profiles"]
        ]
        assert sum(sum(counts) for counts in profile_counts) == 6

        activated = DBSCANRunService().activate_run(run_id=run.id, approved_by=user_id)
        assert activated.is_active is True
        assert RunRepository().get_active().id == run.id

        webgis = WebGISService()
        metadata = webgis.get_metadata()
        summary = webgis.get_summary()
        profiles = webgis.get_profiles()
        earthquakes = webgis.get_earthquakes(page=1, per_page=20)

        assert metadata["dataset"]["id"] == dataset_id
        assert metadata["run"]["id"] == run.id
        assert summary["total_points"] == 6
        assert summary["cluster_count"] == 2
        assert summary["noise_count"] == 0
        assert "dbi_score" in summary
        assert "dbcv_score" in summary
        assert len(profiles) == 2
        assert len(earthquakes) == 6
        assert all("cluster_id" in point and "is_noise" in point for point in earthquakes)


def test_activation_keeps_only_one_global_active_run(app, seeded_dataset):
    with app.app_context():
        dataset_id = seeded_dataset["dataset"].id
        user_id = seeded_dataset["user"].id
        experiment_id = _run_search(dataset_id, user_id)["experiments"][0].id
        service = DBSCANRunService()

        first = service.execute_final_clustering(
            dataset_id=dataset_id,
            experiment_id=experiment_id,
            created_by=user_id,
        )["run"]
        second = service.execute_final_clustering(
            dataset_id=dataset_id,
            experiment_id=experiment_id,
            created_by=user_id,
        )["run"]

        service.activate_run(run_id=first.id, approved_by=user_id)
        service.activate_run(run_id=second.id, approved_by=user_id)

        assert RunRepository().count(is_active=True) == 1
        assert RunRepository().get_active().id == second.id


def test_webgis_returns_not_found_when_no_run_is_published(app):
    with app.app_context():
        with pytest.raises(NotFoundError, match="dipublikasikan"):
            WebGISService().get_metadata()


def test_final_clustering_needs_no_depth_input_and_profiles_zero_km(app, seeded_dataset):
    from repositories.earthquake_repository import EarthquakeRepository

    with app.app_context():
        dataset_id = seeded_dataset["dataset"].id
        user_id = seeded_dataset["user"].id
        events = EarthquakeRepository().list_by_dataset(dataset_id)
        # A depth of exactly 0 km is valid and belongs to the shallow profile band.
        events[0].kedalaman = 0.0
        db.session.commit()

        experiment_id = _run_search(dataset_id, user_id)["experiments"][0].id
        result = DBSCANRunService().execute_final_clustering(
            dataset_id=dataset_id,
            experiment_id=experiment_id,
            created_by=user_id,
        )

        assert result["run"].status == "SUCCESS"
        assert result["run"].total_points == 6
        assert len(result["profiles"]) == 2

        total_shallow = sum(profile.shallow_event_count for profile in result["profiles"])
        total_medium = sum(profile.medium_event_count for profile in result["profiles"])
        total_deep = sum(profile.deep_event_count for profile in result["profiles"])

        assert total_shallow == 3  # 0, 20, and 50 km
        assert total_medium == 2   # 80 and 120 km
        assert total_deep == 1     # 350 km
        assert total_shallow + total_medium + total_deep == 6
