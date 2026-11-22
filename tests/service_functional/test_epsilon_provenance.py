import pytest

from services.parameter_search_service import ParameterSearchService


def test_experiment_evaluation_metadata_contains_epsilon_provenance(app, seeded_dataset):
    with app.app_context():
        service = ParameterSearchService()
        result = service.run_search(
            dataset_id=seeded_dataset["dataset"].id,
            eps_candidates_km=[2.0],
            min_samples_candidates=[2],
            created_by=seeded_dataset["user"].id,
            eps_sources_by_km={"2": ["grid", "explicit"]},
            epsilon_search_metadata={
                "epsilon_candidate_strategy": "UNION_KNEE_SENSITIVITY_EXPLICIT_GRID",
                "use_default_grid": True,
            },
        )

        experiment = result["experiments"][0]
        metadata = experiment.evaluation_metadata["parameter_search"]
        assert metadata["method_version"] == "4.1.4"
        assert metadata["eps_sources"] == ["explicit", "grid"]
        assert metadata["epsilon_rounding_km"] == 0.5
        assert metadata["combination_mode"] == "cross"
        assert metadata["epsilon_candidate_strategy"] == (
            "UNION_KNEE_SENSITIVITY_EXPLICIT_GRID"
        )
        assert metadata["use_default_grid"] is True



def test_epsilon_and_min_samples_are_crossed(app, seeded_dataset):
    with app.app_context():
        result = ParameterSearchService().run_search(
            dataset_id=seeded_dataset["dataset"].id,
            eps_candidates_km=[2.0, 3.0],
            min_samples_candidates=[2, 3],
            created_by=seeded_dataset["user"].id,
            eps_sources_by_km={
                "2": ["explicit"],
                "3": ["grid"],
            },
        )

        pairs = {
            (float(item.eps_km), int(item.min_samples))
            for item in result["experiments"]
        }
        assert pairs == {
            (2.0, 2), (2.0, 3),
            (3.0, 2), (3.0, 3),
        }


def test_rounded_epsilon_is_the_value_used_for_haversine_radian(app, seeded_dataset):
    from services.utils import EARTH_RADIUS_KM

    with app.app_context():
        service = ParameterSearchService(
            epsilon_default_grid_km=(),
            epsilon_rounding_km=0.5,
            use_default_epsilon_grid=False,
        )
        plan = service.build_epsilon_candidates(
            knee_curves=[],
            explicit_eps_candidates_km=[2.24],
            sensitivity_percentages=[0],
            use_default_grid=False,
        )
        assert plan["eps_candidates_km"] == [2.0]

        result = service.run_search(
            dataset_id=seeded_dataset["dataset"].id,
            eps_candidates_km=plan["eps_candidates_km"],
            min_samples_candidates=[2],
            created_by=seeded_dataset["user"].id,
            eps_sources_by_km=plan["eps_sources_by_km"],
            epsilon_search_metadata=plan["metadata"],
        )
        experiment = result["experiments"][0]
        assert float(experiment.eps_km) == 2.0
        assert float(experiment.eps_radian) == pytest.approx(2.0 / EARTH_RADIUS_KM)
