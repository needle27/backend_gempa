#!/usr/bin/env python3
"""Safely disable DBI/DBCV calculations while preserving historical output schema.

This patch edits runtime evaluation/services/config and tests only. It does NOT
connect to PostgreSQL, run migrations, edit Job records, alter model columns,
change serializers/routes, or delete historical artifacts/results.
"""
from __future__ import annotations

import ast
import datetime as dt
import re
import shutil
import sys
from pathlib import Path

ROOT = Path.cwd()

EVALUATOR_PATH = Path("services/clustering_evaluation_service.py")
PARAM_PATH = Path("services/parameter_search_service.py")
RUN_PATH = Path("services/dbscan_run_service.py")
CONFIG_PATH = Path("config.py")
UNIT_TEST_PATH = Path("tests/unit/test_clustering_evaluation.py")
FUNCTIONAL_TEST_PATH = Path("tests/service_functional/test_dbscan_services.py")

NEW_EVALUATE = '''    def evaluate(self, coordinates_rad, labels):
        """Evaluate spatial labels with Haversine Silhouette only.

        Noise label -1 is excluded. Sampling remains deterministic and
        cluster-stratified so repeated evaluations are reproducible.
        """
        coordinates, labels = self._validate_inputs(coordinates_rad, labels)
        clustered_mask = labels != self.NOISE_LABEL
        clustered_count = int(np.sum(clustered_mask))
        cluster_ids = np.unique(labels[clustered_mask])
        cluster_count = int(len(cluster_ids))

        metadata = {
            "version": self.VERSION,
            "distance_context": "spatial_latitude_longitude",
            "noise_label": self.NOISE_LABEL,
            "noise_excluded": True,
            "total_points": int(len(labels)),
            "clustered_points": clustered_count,
            "noise_points": int(len(labels) - clustered_count),
            "cluster_count": cluster_count,
            "random_state": self.random_state,
            "metrics": {},
        }

        silhouette_value = None
        silhouette_sample_size = None
        silhouette_reason = None

        if cluster_count < 2:
            silhouette_reason = "Silhouette memerlukan minimal dua klaster non-noise."
        elif clustered_count <= cluster_count:
            silhouette_reason = "Jumlah titik anggota harus lebih besar daripada jumlah klaster."
        else:
            sample_indices, silhouette_reason = self._allocate_stratified(
                labels[clustered_mask],
                self.silhouette_max_sample,
                1,
                self.random_state,
            )
            if sample_indices is not None:
                global_indices = np.flatnonzero(clustered_mask)[sample_indices]
                sample_labels = labels[global_indices]
                if len(np.unique(sample_labels)) < 2 or len(np.unique(sample_labels)) >= len(sample_labels):
                    silhouette_reason = (
                        "Jumlah klaster pada sampel harus minimal dua dan lebih kecil "
                        "daripada jumlah sampel."
                    )
                else:
                    try:
                        silhouette_value = float(
                            silhouette_score(
                                coordinates[global_indices],
                                sample_labels,
                                metric="haversine",
                            )
                        )
                        silhouette_sample_size = int(len(global_indices))
                    except (ValueError, FloatingPointError) as exc:
                        silhouette_reason = f"Silhouette tidak dapat dihitung: {exc}"

        metadata["metrics"]["silhouette"] = {
            "status": "computed" if silhouette_value is not None else "not_computed",
            "score": silhouette_value,
            "metric": "haversine",
            "sample_size": silhouette_sample_size,
            "sample_strategy": "deterministic_stratified_non_noise",
            "max_sample_size": self.silhouette_max_sample,
            "random_state": self.random_state,
            "noise_excluded": True,
            "reason": silhouette_reason,
        }
        metadata["overall_status"] = "complete" if silhouette_value is not None else "unavailable"
        metadata["evaluation_scope"] = "silhouette_only"

        # Legacy model/API fields are retained for historical compatibility.
        # New calculations do not produce DBI or DBCV values.
        return {
            "silhouette_score": silhouette_value,
            "silhouette_sample_size": silhouette_sample_size,
            "dbi_score": None,
            "dbcv_score": None,
            "evaluation_metadata": metadata,
        }
'''


def _parse(text: str, label: str) -> ast.Module:
    try:
        return ast.parse(text)
    except SyntaxError as exc:
        raise RuntimeError(f"Syntax Python tidak valid pada {label}: {exc}") from exc


def _node_start(node: ast.AST) -> int:
    decos = getattr(node, "decorator_list", [])
    return min([getattr(node, "lineno", 1)] + [d.lineno for d in decos])


def _remove_line_ranges(lines: list[str], ranges: list[tuple[int, int]]) -> list[str]:
    remove = set()
    for start, end in ranges:
        remove.update(range(start, end + 1))
    return [line for number, line in enumerate(lines, 1) if number not in remove]


def patch_evaluator(text: str) -> str:
    tree = _parse(text, str(EVALUATOR_PATH))
    cls = next((n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "ClusteringEvaluationService"), None)
    if cls is None:
        raise RuntimeError("Class ClusteringEvaluationService tidak ditemukan.")

    methods = {n.name: n for n in cls.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
    if "evaluate" not in methods or "_allocate_stratified" not in methods or "_validate_inputs" not in methods:
        raise RuntimeError("Struktur evaluator tidak sesuai; file tidak diubah.")

    lines = text.splitlines()
    ranges: list[tuple[int, int]] = []

    # Remove DBI/DBCV-only methods by AST boundaries (including decorators).
    for name, node in methods.items():
        if name in {"_unit_sphere_xyz", "_davies_bouldin_unit_sphere", "_dbcv_haversine_sample"} or "dbcv" in name.lower() or "davies_bouldin" in name.lower():
            ranges.append((_node_start(node), node.end_lineno))

    # Remove DBCV constants and any constructor statement that references its sample setting.
    for node in cls.body:
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            if isinstance(node, ast.Assign):
                targets = [t.id for t in node.targets if isinstance(t, ast.Name)]
            else:
                targets = [node.target.id] if isinstance(node.target, ast.Name) else []
            if any(name.startswith("DBCV_") for name in targets):
                ranges.append((node.lineno, node.end_lineno))
        if isinstance(node, ast.FunctionDef) and node.name == "__init__":
            for stmt in node.body:
                if "dbcv_max_sample" in ast.dump(stmt):
                    ranges.append((_node_start(stmt), stmt.end_lineno))

    # Drop DBCV-only imports; keep NumPy and sklearn Silhouette.
    for node in tree.body:
        if isinstance(node, ast.ImportFrom):
            module = node.module or ""
            if module.startswith("scipy.sparse") or module == "sklearn.metrics.pairwise":
                ranges.append((_node_start(node), node.end_lineno))

    # Replace evaluate() as a single atomic method, retaining validation and sampling helpers.
    eval_node = methods["evaluate"]
    eval_start, eval_end = _node_start(eval_node), eval_node.end_lineno
    lines = _remove_line_ranges(lines, [r for r in ranges if not (r[0] <= eval_start <= r[1])])
    # Re-parse after deletions to find evaluate's new exact range.
    intermediate = "\n".join(lines) + "\n"
    tree2 = _parse(intermediate, str(EVALUATOR_PATH))
    cls2 = next(n for n in tree2.body if isinstance(n, ast.ClassDef) and n.name == "ClusteringEvaluationService")
    eval2 = next((n for n in cls2.body if isinstance(n, ast.FunctionDef) and n.name == "evaluate"), None)
    if eval2 is None:
        raise RuntimeError("Gagal menemukan kembali evaluate() setelah penghapusan helper.")
    lines2 = intermediate.splitlines()
    new_lines = lines2[:_node_start(eval2)-1] + NEW_EVALUATE.rstrip("\n").splitlines() + lines2[eval2.end_lineno:]
    result = "\n".join(new_lines).rstrip() + "\n"

    # Remove any lingering DBCV-only constructor parameter/assignment fragments.
    result = re.sub(r"^\s*dbcv_max_sample\s*:\s*[^,\n]+,\s*\n", "", result, flags=re.M)
    result = re.sub(r"^\s*dbcv_max_sample\s*=.*\n", "", result, flags=re.M)
    result = re.sub(r"^\s*self\.dbcv_max_sample\s*=.*\n", "", result, flags=re.M)
    result = re.sub(r"^\s*if\s+self\.dbcv_max_sample[^\n]*:\n(?:^[ \t]+.*\n)+", "", result, flags=re.M)

    # Bump the evaluator metadata version so new results are distinguishable from old runs.
    result, version_count = re.subn(r'(?m)^(\s*VERSION\s*=\s*)["\'][^"\']+["\']', r'\g<1>"2.0.0-silhouette-only"', result, count=1)
    if version_count == 0:
        raise RuntimeError("VERSION evaluator tidak ditemukan; file tidak diubah.")

    _parse(result, str(EVALUATOR_PATH) + " (patched)")
    forbidden = ("dbcv_max_sample", "_dbcv_haversine_sample", "_davies_bouldin_unit_sphere", "minimum_spanning_tree", "haversine_distances", "_unit_sphere_xyz")
    remaining = [token for token in forbidden if token in result]
    if remaining:
        raise RuntimeError(f"Referensi kalkulasi DBI/DBCV masih tertinggal di evaluator: {remaining}")
    return result


def patch_service_wiring(text: str, rel: str) -> str:
    tree = _parse(text, rel)
    init_nodes = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == "__init__"]
    if not init_nodes:
        raise RuntimeError(f"__init__ tidak ditemukan di {rel}")
    lines = text.splitlines()
    ranges = []
    for init in init_nodes:
        for stmt in init.body:
            if isinstance(stmt, (ast.Assign, ast.AnnAssign)) and "dbcv_max_sample" in ast.dump(stmt):
                # Remove the standalone DBCV config assignment, not evaluator construction.
                targets = []
                if isinstance(stmt, ast.Assign):
                    targets = [t.id for t in stmt.targets if isinstance(t, ast.Name)]
                elif isinstance(stmt.target, ast.Name):
                    targets = [stmt.target.id]
                if "dbcv_max_sample" in targets:
                    ranges.append((_node_start(stmt), stmt.end_lineno))
    lines = _remove_line_ranges(lines, ranges)
    result = "\n".join(lines) + "\n"
    result = re.sub(r"(?m)^\s*dbcv_max_sample\s*=\s*None,?\s*\n", "", result)
    result = re.sub(r"(?m)^\s*dbcv_max_sample\s*=\s*\(\n(?:^[ \t]+.*\n){1,8}", "", result)
    result = re.sub(r"(?m)^\s*dbcv_max_sample\s*=\s*dbcv_max_sample,?\s*\n", "", result)
    result = re.sub(r"(?m)^\s*dbcv_max_sample\s*=\s*None\s*,?\s*\n", "", result)
    result = re.sub(r"(?m)^\s*dbcv_max_sample\s*=\s*dbcv_max_sample\s*,?\s*\n", "", result)
    result = re.sub(r"(?m)^\s*dbcv_max_sample\s*:\s*[^,\n]+,\s*\n", "", result)
    result = re.sub(r"(?m)^\s*dbcv_max_sample\s*=\s*\([^\n]*\n(?:^[ \t]+.*\n){1,8}", "", result)
    result = re.sub(r"(?m)^\s*dbcv_max_sample\s*=\s*configured\([^\n]*\n", "", result)
    result = re.sub(r"(?m)^\s*dbcv_max_sample=dbcv_max_sample,?\s*\n", "", result)
    if "dbcv_max_sample" in result:
        raise RuntimeError(f"Referensi dbcv_max_sample masih tertinggal di {rel}; file tidak diubah.")
    _parse(result, rel + " (patched)")
    return result


def patch_config(text: str) -> str:
    result, count = re.subn(r"(?m)^\s*DBCV_MAX_SAMPLE\s*=.*\n", "", text)
    if count == 0 and "DBCV_MAX_SAMPLE" in text:
        raise RuntimeError("Baris DBCV_MAX_SAMPLE di config.py tidak dikenali.")
    return result


def patch_unit_tests(text: str) -> str:
    # Replace the old DBI/DBCV-specific test module with focused Silhouette tests.
    return '''"""Tests for the research evaluation metric: Haversine Silhouette only."""

import numpy as np
import pytest

from services.clustering_evaluation_service import ClusteringEvaluationService


def _two_spatial_clusters():
    rng = np.random.default_rng(2026)
    first = np.column_stack((rng.normal(-0.25, 0.002, 18), rng.normal(2.0, 0.002, 18)))
    second = np.column_stack((rng.normal(0.25, 0.002, 18), rng.normal(2.5, 0.002, 18)))
    noise = np.array([[0.0, 0.0]])
    coordinates = np.vstack((first, second, noise))
    labels = np.array([0] * len(first) + [1] * len(second) + [-1])
    return coordinates, labels


def test_haversine_silhouette_is_computed_and_noise_is_excluded():
    coordinates, labels = _two_spatial_clusters()
    result = ClusteringEvaluationService(silhouette_max_sample=30, random_state=42).evaluate(coordinates, labels)
    assert result["silhouette_score"] is not None
    assert -1 <= result["silhouette_score"] <= 1
    assert result["dbi_score"] is None
    assert result["dbcv_score"] is None
    metadata = result["evaluation_metadata"]
    assert metadata["noise_points"] == 1
    assert metadata["clustered_points"] == 36
    assert metadata["noise_excluded"] is True
    assert set(metadata["metrics"]) == {"silhouette"}
    assert metadata["overall_status"] == "complete"
    assert metadata["evaluation_scope"] == "silhouette_only"


def test_silhouette_sampling_is_deterministic():
    coordinates, labels = _two_spatial_clusters()
    service = ClusteringEvaluationService(silhouette_max_sample=20, random_state=7)
    first = service.evaluate(coordinates, labels)
    second = service.evaluate(coordinates, labels)
    assert first["silhouette_score"] == pytest.approx(second["silhouette_score"])
    assert first["evaluation_metadata"]["metrics"]["silhouette"]["sample_size"] == 20
    assert first["dbi_score"] is None and first["dbcv_score"] is None


def test_silhouette_is_unavailable_with_one_cluster():
    coordinates = np.array([[0.1, 1.0], [0.1001, 1.0], [0.1002, 1.0]])
    labels = np.array([0, 0, 0])
    result = ClusteringEvaluationService().evaluate(coordinates, labels)
    assert result["silhouette_score"] is None
    assert result["evaluation_metadata"]["metrics"]["silhouette"]["status"] == "not_computed"


def test_input_validation_rejects_invalid_latitude_radians():
    coordinates = np.array([[2.0, 0.0], [0.1, 1.0]])
    labels = np.array([0, 1])
    with pytest.raises(ValueError, match="Latitude radian"):
        ClusteringEvaluationService().evaluate(coordinates, labels)
'''


def patch_functional_tests(text: str) -> str:
    original = text
    # Search result assertions: DBI and DBCV are no longer calculated for new jobs.
    text = text.replace(
        '        assert experiment.dbi_score is not None\n        assert experiment.dbi_score >= 0\n        # The seeded fixture has fewer than five points in each cluster, so\n        # DBCV is explicitly unavailable with a reason rather than fabricated.\n        assert experiment.dbcv_score is None\n        assert experiment.evaluation_metadata["metrics"]["dbcv"]["status"] == "not_computed"\n',
        '        assert experiment.dbi_score is None\n        assert experiment.dbcv_score is None\n        assert set(experiment.evaluation_metadata["metrics"]) == {"silhouette"}\n'
    )
    text = text.replace(
        '        assert run.dbi_score == pytest.approx(search["experiments"][0].dbi_score)\n        assert run.dbcv_score == search["experiments"][0].dbcv_score\n',
        '        assert run.dbi_score is None\n        assert run.dbcv_score is None\n'
    )
    stale_markers = (
        "experiment.dbi_score is not None",
        'metrics"]["dbcv"]',
        'pytest.approx(search["experiments"][0].dbi_score)',
    )
    if any(marker in text for marker in stale_markers):
        raise RuntimeError("Pola test DBI/DBCV tidak cocok; functional test tidak diubah.")
    _parse(text, str(FUNCTIONAL_TEST_PATH) + " (patched)")
    return text


def main() -> int:
    if not (ROOT / "app.py").is_file() or not (ROOT / EVALUATOR_PATH).is_file():
        print("ERROR: Jalankan script dari root project BE 4.1.", file=sys.stderr)
        return 2

    targets = [EVALUATOR_PATH, PARAM_PATH, RUN_PATH, CONFIG_PATH, UNIT_TEST_PATH, FUNCTIONAL_TEST_PATH]
    missing = [str(p) for p in targets if not (ROOT / p).is_file()]
    if missing:
        print("ERROR: File wajib tidak ditemukan: " + ", ".join(missing), file=sys.stderr)
        return 2

    originals = {p: (ROOT / p).read_text(encoding="utf-8") for p in targets}
    try:
        patched = {
            EVALUATOR_PATH: patch_evaluator(originals[EVALUATOR_PATH]),
            PARAM_PATH: patch_service_wiring(originals[PARAM_PATH], str(PARAM_PATH)),
            RUN_PATH: patch_service_wiring(originals[RUN_PATH], str(RUN_PATH)),
            CONFIG_PATH: patch_config(originals[CONFIG_PATH]),
            UNIT_TEST_PATH: patch_unit_tests(originals[UNIT_TEST_PATH]),
            FUNCTIONAL_TEST_PATH: patch_functional_tests(originals[FUNCTIONAL_TEST_PATH]),
        }
        for rel, content in patched.items():
            _parse(content, str(rel) + " (preflight)")
    except Exception as exc:
        print(f"PATCH ABORTED — tidak ada file project yang diubah: {exc}", file=sys.stderr)
        return 1

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_root = ROOT.parent / f"BACKUP_REMOVE_DBI_DBCV_{stamp}"
    backup_root.mkdir(parents=True, exist_ok=False)
    for rel in targets:
        dest = backup_root / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / rel, dest)

    # All preflight checks passed; now write patched files.
    for rel, content in patched.items():
        temp = ROOT / (str(rel) + ".remove-metrics.tmp")
        temp.write_text(content, encoding="utf-8")
        temp.replace(ROOT / rel)

    print("PATCH APPLIED.")
    print(f"Backup: {backup_root}")
    print("Runtime DBI/DBCV calculations removed; Haversine Silhouette retained.")
    print("Legacy model columns, migrations, API serializers/routes, Job records, and historical outputs were NOT touched.")
    print("New evaluation results return dbi_score=None and dbcv_score=None for compatibility.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
