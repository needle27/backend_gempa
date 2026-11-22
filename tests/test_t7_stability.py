import pytest

from services.parameter_search_service import ParameterSearchService


def make_experiment(eps_km, min_samples, cluster_count, metadata=None):
    return {
        "eps_km": float(eps_km),
        "min_samples": int(min_samples),
        "cluster_count": int(cluster_count) if cluster_count is not None else None,
        "stability_score": None,
        "evaluation_metadata": dict(metadata or {}),
    }


def test_fully_stable_grid():
    """a. Grid stabil penuh (stability_score == 1.0) ketika semua cluster_count seragam."""
    eps_list = [10.0, 20.0, 30.0]
    minpts_list = [5, 10, 15]

    experiments = [
        make_experiment(eps, minpts, cluster_count=8)
        for eps in eps_list
        for minpts in minpts_list
    ]

    result = ParameterSearchService.calculate_grid_stability(experiments)

    for exp in result:
        assert exp["stability_score"] == pytest.approx(1.0)
        stab = exp["evaluation_metadata"]["stability"]
        assert stab["mean_relative_cluster_change"] == pytest.approx(0.0)


def test_fully_stable_zero_clusters():
    """Grid stabil penuh ketika cluster_count bernilai 0 (k == 0 dan k_n == 0 -> rel_diff == 0.0)."""
    experiments = [
        make_experiment(10.0, 5, cluster_count=0),
        make_experiment(20.0, 5, cluster_count=0),
    ]

    result = ParameterSearchService.calculate_grid_stability(experiments)

    for exp in result:
        assert exp["stability_score"] == pytest.approx(1.0)
        stab = exp["evaluation_metadata"]["stability"]
        assert stab["mean_relative_cluster_change"] == pytest.approx(0.0)


def test_drastic_cluster_change_between_neighbors():
    """b. Perubahan jumlah klaster drastis antar tetangga menghasilkan skor stabilitas rendah."""
    # Eksperimen 1: k = 10; Tetangga: k_n = 100
    # rel_diff = |10 - 100| / max(10, 100, 1) = 90 / 100 = 0.90
    # stability_score = 1.0 - 0.90 = 0.10
    exp1 = make_experiment(10.0, 5, cluster_count=10)
    exp2 = make_experiment(20.0, 5, cluster_count=100)

    result = ParameterSearchService.calculate_grid_stability([exp1, exp2])

    assert exp1["stability_score"] == pytest.approx(0.10)
    assert exp1["evaluation_metadata"]["stability"]["mean_relative_cluster_change"] == pytest.approx(0.90)

    assert exp2["stability_score"] == pytest.approx(0.10)
    assert exp2["evaluation_metadata"]["stability"]["mean_relative_cluster_change"] == pytest.approx(0.90)

    # Ekstrem: k = 10 vs k_n = 0
    # rel_diff = |10 - 0| / max(10, 0, 1) = 10 / 10 = 1.0
    # stability_score = 1.0 - 1.0 = 0.0
    exp3 = make_experiment(10.0, 10, cluster_count=10)
    exp4 = make_experiment(20.0, 10, cluster_count=0)

    ParameterSearchService.calculate_grid_stability([exp3, exp4])
    assert exp3["stability_score"] == pytest.approx(0.0)
    assert exp4["stability_score"] == pytest.approx(0.0)


def test_grid_corners_edges_and_center():
    """c. Titik sudut (2 tetangga), tepi (3 tetangga), dan tengah (4 tetangga)."""
    eps_list = [10.0, 20.0, 30.0]
    minpts_list = [5, 10, 15]

    # Grid 3x3 dengan cluster_count berbeda untuk setiap titik
    # Format cluster_count: (i + 1) * 10 + (j + 1)
    grid_map = {}
    experiments = []
    for i, eps in enumerate(eps_list):
        for j, minpts in enumerate(minpts_list):
            k = (i + 1) * 10 + (j + 1)
            exp = make_experiment(eps, minpts, cluster_count=k)
            grid_map[(eps, minpts)] = exp
            experiments.append(exp)

    ParameterSearchService.calculate_grid_stability(experiments)

    # 1. Sudut (Corner): i=0, j=0 -> (10.0, 5)
    # Tetangga ortogonal: (20.0, 5) dan (10.0, 10) -> 2 tetangga
    corner = grid_map[(10.0, 5)]
    stab_corner = corner["evaluation_metadata"]["stability"]
    assert stab_corner["neighbor_count"] == 2
    assert stab_corner["eps_neighbor_count"] == 1
    assert stab_corner["min_samples_neighbor_count"] == 1
    assert corner["stability_score"] is not None

    # 2. Tepi (Edge): i=1, j=0 -> (20.0, 5)
    # Tetangga ortogonal: (10.0, 5), (30.0, 5), dan (20.0, 10) -> 3 tetangga
    edge = grid_map[(20.0, 5)]
    stab_edge = edge["evaluation_metadata"]["stability"]
    assert stab_edge["neighbor_count"] == 3
    assert stab_edge["eps_neighbor_count"] == 2
    assert stab_edge["min_samples_neighbor_count"] == 1
    assert edge["stability_score"] is not None

    # 3. Tengah (Center): i=1, j=1 -> (20.0, 10)
    # Tetangga ortogonal: (10.0, 10), (30.0, 10), (20.0, 5), (20.0, 15) -> 4 tetangga
    center = grid_map[(20.0, 10)]
    stab_center = center["evaluation_metadata"]["stability"]
    assert stab_center["neighbor_count"] == 4
    assert stab_center["eps_neighbor_count"] == 2
    assert stab_center["min_samples_neighbor_count"] == 2
    assert center["stability_score"] is not None


def test_single_experiment_grid_without_neighbors():
    """d. Grid 1x1 tanpa tetangga menghasilkan stability_score == None."""
    exp = make_experiment(15.0, 10, cluster_count=5)

    result = ParameterSearchService.calculate_grid_stability([exp])
    single = result[0]

    assert single["stability_score"] is None
    stab = single["evaluation_metadata"]["stability"]
    assert stab["neighbor_count"] == 0
    assert stab["eps_neighbor_count"] == 0
    assert stab["min_samples_neighbor_count"] == 0
    assert stab["mean_relative_cluster_change"] is None


def test_empty_experiments_list():
    """List eksperimen kosong ditangani dengan aman."""
    assert ParameterSearchService.calculate_grid_stability([]) == []


def test_audit_metadata_reassignment_and_dual_storage():
    """Audit: pastikan evaluation_metadata di-reassign ke dict baru (bukan in-place mutation)

    dan stability_score tersimpan baik di atribut model maupun di evaluation_metadata.
    """
    from models.experiment import DBSCANParameterExperiment

    original_metadata = {"existing_key": "existing_value"}
    exp1 = DBSCANParameterExperiment(
        dataset_id=1,
        job_id=1,
        eps_km=10.0,
        eps_radian=10.0 / 6371.0088,
        min_samples=5,
        cluster_count=10,
        noise_count=50,
        noise_percentage=5.0,
        clustered_count=950,
        is_valid=True,
        evaluation_metadata=original_metadata,
    )
    exp2 = DBSCANParameterExperiment(
        dataset_id=1,
        job_id=1,
        eps_km=20.0,
        eps_radian=20.0 / 6371.0088,
        min_samples=5,
        cluster_count=10,
        noise_count=50,
        noise_percentage=5.0,
        clustered_count=950,
        is_valid=True,
        evaluation_metadata={"existing_key": "val2"},
    )

    # Simpan id memory dict awal sebelum kalkulasi
    initial_id = id(exp1.evaluation_metadata)

    ParameterSearchService.calculate_grid_stability([exp1, exp2])

    # 1. Pastikan referensi dictionary berubah (reassign dict baru, bukan in-place mutation)
    assert id(exp1.evaluation_metadata) != initial_id
    assert exp1.evaluation_metadata["existing_key"] == "existing_value"

    # 2. Pastikan stability_score ada di kedua tempat (kolom model & evaluation_metadata)
    assert exp1.stability_score == pytest.approx(1.0)
    assert exp1.evaluation_metadata["stability_score"] == pytest.approx(1.0)
    assert exp1.stability_score == exp1.evaluation_metadata["stability_score"]

    # 3. Pastikan objek ringkasan stability ada dan lengkap
    stab = exp1.evaluation_metadata["stability"]
    assert stab["neighbor_count"] == 1
    assert stab["eps_neighbor_count"] == 1
    assert stab["min_samples_neighbor_count"] == 0
    assert stab["mean_relative_cluster_change"] == pytest.approx(0.0)

