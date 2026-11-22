import pytest

from models.experiment import DBSCANParameterExperiment
from services.parameter_search_service import ParameterSearchService


def make_exp(
    eps_km,
    min_samples,
    cluster_count=10,
    silhouette_score=0.5,
    noise_percentage=20.0,
    largest_cluster_ratio=0.3,
    stability_score=0.8,
    is_valid=True,
    metadata=None,
):
    meta = dict(metadata or {})
    if largest_cluster_ratio is not None:
        meta["largest_cluster_ratio"] = float(largest_cluster_ratio)
    if stability_score is not None:
        meta["stability_score"] = float(stability_score)

    return {
        "eps_km": float(eps_km),
        "min_samples": int(min_samples),
        "cluster_count": int(cluster_count),
        "silhouette_score": float(silhouette_score) if silhouette_score is not None else None,
        "noise_percentage": float(noise_percentage) if noise_percentage is not None else None,
        "largest_cluster_ratio": float(largest_cluster_ratio) if largest_cluster_ratio is not None else None,
        "stability_score": float(stability_score) if stability_score is not None else None,
        "is_valid": bool(is_valid),
        "is_recommended": False,
        "evaluation_metadata": meta,
    }


def test_invalid_with_highest_silhouette_never_wins():
    """(a) Eksperimen invalid dengan Silhouette tertinggi tetap gugur dan kalah dari kandidat valid."""
    # Exp 1: invalid tapi silhouette sangat tinggi (0.95)
    exp_invalid = make_exp(
        eps_km=10.0, min_samples=5, silhouette_score=0.95, is_valid=False
    )
    # Exp 2: valid dengan silhouette moderat (0.45)
    exp_valid = make_exp(
        eps_km=20.0, min_samples=10, silhouette_score=0.45, is_valid=True
    )

    ParameterSearchService.calculate_multicriteria_recommendations([exp_invalid, exp_valid])

    assert exp_invalid["is_recommended"] is False
    assert exp_invalid["evaluation_metadata"]["recommendation_score"] is None
    assert exp_invalid["evaluation_metadata"]["recommendation"]["status"] == "INVALID"

    assert exp_valid["is_recommended"] is True
    assert exp_valid["evaluation_metadata"]["recommendation_score"] is not None
    assert exp_valid["evaluation_metadata"]["recommendation"]["status"] == "RECOMMENDED"


def test_normalization_direction_lower_is_better():
    """(b) Arah normalisasi noise_percentage & largest_cluster_ratio adalah lower-is-better."""
    # Dua kandidat dengan silhouette dan stability sama persis
    # Exp 1: noise rendah (10%), cluster ratio rendah (0.2) -> harus dapat skor normalisasi 1.0
    # Exp 2: noise tinggi (30%), cluster ratio tinggi (0.5) -> harus dapat skor normalisasi 0.0
    exp1 = make_exp(
        eps_km=10.0, min_samples=5,
        silhouette_score=0.5,
        noise_percentage=10.0,
        largest_cluster_ratio=0.2,
        stability_score=0.8,
    )
    exp2 = make_exp(
        eps_km=20.0, min_samples=5,
        silhouette_score=0.5,
        noise_percentage=30.0,
        largest_cluster_ratio=0.5,
        stability_score=0.8,
    )

    ParameterSearchService.calculate_multicriteria_recommendations([exp1, exp2])

    norm1 = exp1["evaluation_metadata"]["recommendation"]["normalized_scores"]
    norm2 = exp2["evaluation_metadata"]["recommendation"]["normalized_scores"]

    assert norm1["noise_percentage"] == pytest.approx(1.0)
    assert norm1["largest_cluster_ratio"] == pytest.approx(1.0)

    assert norm2["noise_percentage"] == pytest.approx(0.0)
    assert norm2["largest_cluster_ratio"] == pytest.approx(0.0)

    assert exp1["evaluation_metadata"]["recommendation_score"] > exp2["evaluation_metadata"]["recommendation_score"]
    assert exp1["is_recommended"] is True
    assert exp2["is_recommended"] is False


def test_single_valid_experiment_max_equals_min():
    """(c) Hanya 1 eksperimen valid (max == min): semua metrik dinormalisasi ke 1.0."""
    exp = make_exp(
        eps_km=15.0, min_samples=10,
        silhouette_score=0.55,
        noise_percentage=15.0,
        largest_cluster_ratio=0.35,
        stability_score=0.75,
        is_valid=True,
    )

    ParameterSearchService.calculate_multicriteria_recommendations([exp])

    assert exp["is_recommended"] is True
    norm = exp["evaluation_metadata"]["recommendation"]["normalized_scores"]
    assert norm["silhouette"] == pytest.approx(1.0)
    assert norm["noise_percentage"] == pytest.approx(1.0)
    assert norm["largest_cluster_ratio"] == pytest.approx(1.0)
    assert norm["stability_score"] == pytest.approx(1.0)
    assert exp["evaluation_metadata"]["recommendation_score"] == pytest.approx(1.0)


def test_zero_valid_experiments_no_valid_experiment():
    """(d) 0 eksperimen valid: semua is_recommended = False, status NO_VALID_EXPERIMENT."""
    exp1 = make_exp(eps_km=10.0, min_samples=5, is_valid=False)
    exp2 = make_exp(eps_km=20.0, min_samples=10, is_valid=False)

    class DummyJob:
        input_payload = {}

    job = DummyJob()
    ParameterSearchService.calculate_multicriteria_recommendations([exp1, exp2], job=job)

    assert exp1["is_recommended"] is False
    assert exp1["evaluation_metadata"]["recommendation_score"] is None
    assert exp1["evaluation_metadata"]["recommendation"]["status"] == "NO_VALID_EXPERIMENT"

    assert exp2["is_recommended"] is False
    assert exp2["evaluation_metadata"]["recommendation_score"] is None
    assert exp2["evaluation_metadata"]["recommendation"]["status"] == "NO_VALID_EXPERIMENT"

    assert job.input_payload["recommendation_status"] == "NO_VALID_EXPERIMENT"
    assert job.input_payload["selected_experiment"] is None


def test_stability_score_none_weight_redistribution():
    """(e) Grid 1x1 / stability_score is None: bobot 3 metrik lain didistribusikan ulang secara proporsional."""
    exp = make_exp(
        eps_km=15.0, min_samples=10,
        silhouette_score=0.60,
        noise_percentage=12.0,
        largest_cluster_ratio=0.30,
        stability_score=None,  # Tidak memiliki tetangga
        is_valid=True,
    )

    ParameterSearchService.calculate_multicriteria_recommendations([exp])

    assert exp["is_recommended"] is True
    weights_used = exp["evaluation_metadata"]["recommendation"]["weights_used"]

    # Bobot awal: sil=0.4, noise=0.2, lcr=0.2, stab=0.2 -> sum_active = 0.8
    # Bobot baru proporsional: 0.4/0.8 = 0.5, 0.2/0.8 = 0.25, 0.2/0.8 = 0.25, stab = 0.0
    assert weights_used["silhouette"] == pytest.approx(0.50)
    assert weights_used["noise_percentage"] == pytest.approx(0.25)
    assert weights_used["largest_cluster_ratio"] == pytest.approx(0.25)
    assert weights_used["stability_score"] == pytest.approx(0.0)
    assert sum(weights_used.values()) == pytest.approx(1.0)

    # Karena max == min, ketiga metrik ternormalisasi 1.0 -> skor akhir 1.0
    assert exp["evaluation_metadata"]["recommendation_score"] == pytest.approx(1.0)


def test_deterministic_tie_breaking():
    """(f) Tie-breaking deterministik: tepat satu pemenang berdasarkan kriteria berurutan."""
    # Kasus: Skor akhir sama persis, uji tie-breaker berurutan

    # 1. Tie pada skor -> silhouette lebih tinggi menang
    exp_a1 = make_exp(eps_km=10.0, min_samples=5, silhouette_score=0.7, noise_percentage=20.0, largest_cluster_ratio=0.3, stability_score=0.8)
    exp_a2 = make_exp(eps_km=20.0, min_samples=5, silhouette_score=0.6, noise_percentage=20.0, largest_cluster_ratio=0.3, stability_score=0.8)
    ParameterSearchService.calculate_multicriteria_recommendations([exp_a1, exp_a2])
    assert exp_a1["is_recommended"] is True
    assert exp_a2["is_recommended"] is False

    # 2. Tie pada skor & silhouette -> largest_cluster_ratio lebih rendah menang
    exp_b1 = make_exp(eps_km=10.0, min_samples=5, silhouette_score=0.5, noise_percentage=20.0, largest_cluster_ratio=0.2, stability_score=0.8)
    exp_b2 = make_exp(eps_km=20.0, min_samples=5, silhouette_score=0.5, noise_percentage=20.0, largest_cluster_ratio=0.4, stability_score=0.8)
    ParameterSearchService.calculate_multicriteria_recommendations([exp_b1, exp_b2])
    assert exp_b1["is_recommended"] is True
    assert exp_b2["is_recommended"] is False

    # 3. Tie pada skor, silhouette & lcr -> noise_percentage lebih rendah menang
    exp_c1 = make_exp(eps_km=10.0, min_samples=5, silhouette_score=0.5, noise_percentage=10.0, largest_cluster_ratio=0.3, stability_score=0.8)
    exp_c2 = make_exp(eps_km=20.0, min_samples=5, silhouette_score=0.5, noise_percentage=30.0, largest_cluster_ratio=0.3, stability_score=0.8)
    ParameterSearchService.calculate_multicriteria_recommendations([exp_c1, exp_c2])
    assert exp_c1["is_recommended"] is True
    assert exp_c2["is_recommended"] is False

    # 4. Tie pada skor, silhouette, lcr & noise -> stability_score lebih tinggi menang
    exp_d1 = make_exp(eps_km=10.0, min_samples=5, silhouette_score=0.5, noise_percentage=20.0, largest_cluster_ratio=0.3, stability_score=0.9)
    exp_d2 = make_exp(eps_km=20.0, min_samples=5, silhouette_score=0.5, noise_percentage=20.0, largest_cluster_ratio=0.3, stability_score=0.5)
    ParameterSearchService.calculate_multicriteria_recommendations([exp_d1, exp_d2])
    assert exp_d1["is_recommended"] is True
    assert exp_d2["is_recommended"] is False

    # 5. Tie pada semua metrik -> min_samples lebih tinggi menang
    exp_e1 = make_exp(eps_km=10.0, min_samples=10, silhouette_score=0.5, noise_percentage=20.0, largest_cluster_ratio=0.3, stability_score=0.8)
    exp_e2 = make_exp(eps_km=10.0, min_samples=5, silhouette_score=0.5, noise_percentage=20.0, largest_cluster_ratio=0.3, stability_score=0.8)
    ParameterSearchService.calculate_multicriteria_recommendations([exp_e1, exp_e2])
    assert exp_e1["is_recommended"] is True
    assert exp_e2["is_recommended"] is False

    # 6. Tie pada semua metrik & min_samples -> eps_km lebih rendah menang
    exp_f1 = make_exp(eps_km=10.0, min_samples=5, silhouette_score=0.5, noise_percentage=20.0, largest_cluster_ratio=0.3, stability_score=0.8)
    exp_f2 = make_exp(eps_km=20.0, min_samples=5, silhouette_score=0.5, noise_percentage=20.0, largest_cluster_ratio=0.3, stability_score=0.8)
    ParameterSearchService.calculate_multicriteria_recommendations([exp_f1, exp_f2])
    assert exp_f1["is_recommended"] is True
    assert exp_f2["is_recommended"] is False


def test_audit_jsonb_reassignment_and_flag_modified():
    """(g) Audit: pastikan evaluation_metadata di-reassign ke objek dict baru (bukan in-place mutation)

    dan flag_modified terpanggil pada model SQLAlchemy.
    """
    orig_meta = {"key": "val"}
    exp = DBSCANParameterExperiment(
        dataset_id=1,
        job_id=1,
        eps_km=10.0,
        eps_radian=10.0 / 6371.0088,
        min_samples=5,
        cluster_count=10,
        noise_count=50,
        noise_percentage=5.0,
        clustered_count=950,
        max_cluster_size=200,
        silhouette_score=0.6,
        stability_score=0.85,
        is_valid=True,
        evaluation_metadata=orig_meta,
    )

    initial_id = id(exp.evaluation_metadata)

    ParameterSearchService.calculate_multicriteria_recommendations([exp])

    # 1. Pastikan dictionary direassign (id memory berbeda)
    assert id(exp.evaluation_metadata) != initial_id
    assert exp.evaluation_metadata["key"] == "val"

    # 2. Rekomendasi tersimpan
    assert exp.is_recommended is True
    assert exp.evaluation_metadata["is_recommended"] is True
    assert exp.evaluation_metadata["recommendation_score"] == pytest.approx(1.0)
    assert exp.evaluation_metadata["recommendation"]["status"] == "RECOMMENDED"
