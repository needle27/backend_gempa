import pytest

from services.exceptions import ProcessingError, ValidationError
from services.parameter_search_service import ParameterSearchService


def _service(*, grid=(10, 20, 30, 50), rounding=0.5):
    return ParameterSearchService(
        epsilon_default_grid_km=grid,
        epsilon_rounding_km=rounding,
        use_default_epsilon_grid=True,
    )


def test_epsilon_candidates_union_knee_explicit_and_grid_with_complete_provenance():
    service = _service()
    result = service.build_epsilon_candidates(
        knee_curves=[
            {"min_samples": 8, "eps_knee_km": 20.24},
            {"min_samples": 10, "eps_knee_km": 30.0},
        ],
        explicit_eps_candidates_km=[20.1, 44.1],
        sensitivity_percentages=[0, 10],
        use_default_grid=True,
    )

    assert result["eps_candidates_km"] == [10.0, 20.0, 22.5, 30.0, 33.0, 44.0, 50.0]
    assert result["eps_candidates_km"] == sorted(result["eps_candidates_km"])
    assert result["eps_sources_by_km"]["20"] == [
        "explicit",
        "grid",
        "knee:minpts=8:+0%",
    ]
    assert result["eps_sources_by_km"]["30"] == [
        "grid",
        "knee:minpts=10:+0%",
    ]
    assert result["metadata"]["epsilon_candidate_strategy"] == (
        "UNION_KNEE_SENSITIVITY_EXPLICIT_GRID"
    )
    assert result["metadata"]["combination_mode"] == "cross"
    assert result["metadata"]["candidate_count_before_deduplication"] == 10
    assert result["metadata"]["candidate_count_after_deduplication"] == 7


def test_rounding_49_8_50_0_50_2_merges_all_three_sources():
    service = _service(grid=(50.0,))
    result = service.build_epsilon_candidates(
        knee_curves=[{"min_samples": 10, "eps_knee_km": 50.2}],
        explicit_eps_candidates_km=[49.8],
        sensitivity_percentages=[0],
        use_default_grid=True,
    )

    assert result["eps_candidates_km"] == [50.0]
    assert result["eps_sources_by_km"]["50"] == [
        "explicit",
        "grid",
        "knee:minpts=10:+0%",
    ]
    assert result["metadata"]["candidate_count_before_deduplication"] == 3
    assert result["metadata"]["candidate_count_after_deduplication"] == 1


def test_grid_is_additive_and_can_be_disabled_without_disabling_knee_or_explicit():
    service = _service(grid=(10, 20, 30))
    result = service.build_epsilon_candidates(
        knee_curves=[{"min_samples": 8, "eps_knee_km": 40.0}],
        explicit_eps_candidates_km=[60.0],
        sensitivity_percentages=[0],
        use_default_grid=False,
    )

    assert result["eps_candidates_km"] == [40.0, 60.0]
    assert result["metadata"]["use_default_grid"] is False
    assert result["metadata"]["default_grid"] == [10.0, 20.0, 30.0]
    assert result["metadata"]["default_grid_km"] == []
    assert result["metadata"]["rounding_km"] == 0.5


def test_knee_failure_for_one_minpts_does_not_block_other_sources():
    service = _service(grid=(10, 20))
    result = service.build_epsilon_candidates(
        knee_curves=[
            {
                "min_samples": 8,
                "eps_knee_km": None,
                "knee_detection_error": "ValueError: synthetic curve failure",
            },
            {"min_samples": 10, "eps_knee_km": 30.0},
        ],
        explicit_eps_candidates_km=[40.0],
        sensitivity_percentages=[0],
        use_default_grid=True,
    )

    assert result["eps_candidates_km"] == [10.0, 20.0, 30.0, 40.0]
    assert result["metadata"]["knee_not_found"] == [8]
    assert result["metadata"]["knee_detection_errors"] == [
        {"min_samples": 8, "error": "ValueError: synthetic curve failure"}
    ]
    assert result["eps_sources_by_km"]["30"] == ["knee:minpts=10:+0%"]
    assert result["eps_sources_by_km"]["40"] == ["explicit"]


def test_no_knee_and_no_other_source_raises_processing_error():
    service = _service(grid=())
    with pytest.raises(ProcessingError, match="Tidak ada kandidat epsilon"):
        service.build_epsilon_candidates(
            knee_curves=[{"min_samples": 8, "eps_knee_km": None}],
            explicit_eps_candidates_km=None,
            sensitivity_percentages=[-20, 0, 20],
            use_default_grid=False,
        )


def test_invalid_rounding_precision_and_grid_toggle_are_rejected():
    service = _service(grid=(10,))
    service.epsilon_rounding_km = 0
    with pytest.raises(ValidationError, match="EPSILON_ROUNDING_KM"):
        service.build_epsilon_candidates(
            knee_curves=[],
            explicit_eps_candidates_km=[10],
            sensitivity_percentages=[0],
            use_default_grid=False,
        )

    service.epsilon_rounding_km = 0.5
    with pytest.raises(ValidationError, match="use_default_grid"):
        service.build_epsilon_candidates(
            knee_curves=[],
            explicit_eps_candidates_km=[10],
            sensitivity_percentages=[0],
            use_default_grid="false",
        )


def test_explicit_epsilon_that_rounds_to_zero_is_rejected():
    service = _service(grid=())
    with pytest.raises(ValidationError, match="menjadi nol"):
        service.build_epsilon_candidates(
            knee_curves=[],
            explicit_eps_candidates_km=[0.1],
            sensitivity_percentages=[0],
            use_default_grid=False,
        )


def test_explicit_epsilon_must_not_exceed_1000_km():
    service = _service(grid=())
    with pytest.raises(ValidationError, match="1.000 km"):
        service.build_epsilon_candidates(
            knee_curves=[],
            explicit_eps_candidates_km=[1000.1],
            sensitivity_percentages=[0],
            use_default_grid=False,
        )


def test_negative_explicit_epsilon_is_rejected():
    service = _service(grid=())
    with pytest.raises(ValidationError, match="lebih besar dari 0"):
        service.build_epsilon_candidates(
            knee_curves=[],
            explicit_eps_candidates_km=[-1.0],
            sensitivity_percentages=[0],
            use_default_grid=False,
        )
