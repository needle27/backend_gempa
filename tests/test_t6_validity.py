import pytest

from services.parameter_search_service import ParameterSearchService


DEFAULTS = ParameterSearchService.DEFAULT_VALIDITY_THRESHOLDS


def evaluate(
    clusters=10,
    noise=20.0,
    largest=0.40,
    thresholds=None,
):
    return ParameterSearchService._evaluate_validity(
        cluster_count=clusters,
        noise_percentage=noise,
        largest_cluster_ratio=largest,
        thresholds=thresholds or DEFAULTS,
    )


def test_valid_experiment():
    valid, reasons = evaluate()
    assert valid is True
    assert reasons == []


@pytest.mark.parametrize(
    ("kwargs", "expected"),
    [
        ({"clusters": 1}, "CLUSTER_COUNT_BELOW_MINIMUM"),
        ({"clusters": 81}, "CLUSTER_COUNT_ABOVE_MAXIMUM"),
        ({"noise": None}, "NOISE_PERCENTAGE_UNAVAILABLE"),
        ({"noise": 40.1}, "NOISE_PERCENTAGE_ABOVE_MAXIMUM"),
        ({"largest": None}, "LARGEST_CLUSTER_RATIO_UNAVAILABLE"),
        ({"largest": 0.61}, "LARGEST_CLUSTER_RATIO_ABOVE_MAXIMUM"),
    ],
)
def test_each_invalidity_rule(kwargs, expected):
    valid, reasons = evaluate(**kwargs)
    assert valid is False
    assert expected in reasons


def test_multiple_invalid_reasons():
    valid, reasons = evaluate(
        clusters=1,
        noise=50.0,
        largest=0.90,
    )
    assert valid is False
    assert reasons == [
        "CLUSTER_COUNT_BELOW_MINIMUM",
        "NOISE_PERCENTAGE_ABOVE_MAXIMUM",
        "LARGEST_CLUSTER_RATIO_ABOVE_MAXIMUM",
    ]


def test_configurable_threshold_override():
    thresholds = {
        "min_clusters": 3,
        "max_clusters": 20,
        "max_noise_percentage": 25.0,
        "max_largest_cluster_ratio": 0.50,
    }

    normalized = ParameterSearchService._normalize_validity_thresholds(
        thresholds
    )

    valid, reasons = evaluate(
        clusters=2,
        noise=20.0,
        largest=0.40,
        thresholds=normalized,
    )

    assert valid is False
    assert reasons == ["CLUSTER_COUNT_BELOW_MINIMUM"]


def test_invalid_threshold_configuration_rejected():
    thresholds = dict(DEFAULTS)
    thresholds["max_noise_percentage"] = 101

    with pytest.raises(ValueError):
        ParameterSearchService._normalize_validity_thresholds(thresholds)


def test_threshold_defaults():
    assert DEFAULTS == {
        "min_clusters": 2,
        "max_clusters": 80,
        "max_noise_percentage": 40.0,
        "max_largest_cluster_ratio": 0.60,
    }
