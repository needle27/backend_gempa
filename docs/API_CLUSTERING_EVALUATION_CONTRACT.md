# API Contract — Clustering Evaluation Metrics

Backend memperluas response yang sudah ada. Tidak ada endpoint perhitungan
metrik di frontend dan tidak ada metrik yang dihitung ulang oleh browser.

## 1. Parameter Search experiments

`GET /api/admin/jobs/{job_id}/experiments`

Setiap object eksperimen sekarang menyertakan:

| Field | Type | Meaning |
|---|---|---|
| `silhouette_score` | number or null | Silhouette pada Haversine |
| `silhouette_sample_size` | integer or null | Jumlah titik yang dipakai untuk Silhouette |
| `dbi_score` | number or null | DBI pada 3-D unit-sphere embedding |
| `dbcv_score` | number or null | DBCV Haversine berbasis mutual-reachability MST |
| `evaluation_metadata` | object | Metode, metrik jarak, sample size, random state, status, dan alasan |

## 2. Final run

Field yang sama disertakan pada:

- `GET /api/admin/datasets/{dataset_id}/runs`
- `GET /api/admin/runs/{run_id}` (pada object `data.run`)
- `GET /api/metadata` (pada object `data.run`)
- `GET /api/summary`

## 3. Evaluation metadata shape

Contoh struktur (angka di bawah hanya ilustrasi kontrak, bukan hasil dataset):

```json
{
  "version": "1.0.0",
  "noise_label": -1,
  "noise_excluded": true,
  "total_points": 100,
  "clustered_points": 92,
  "noise_points": 8,
  "cluster_count": 2,
  "random_state": 42,
  "overall_status": "partial",
  "metrics": {
    "silhouette": {
      "status": "computed",
      "score": 0.71,
      "metric": "haversine",
      "sample_size": 92,
      "sample_strategy": "deterministic_stratified_non_noise",
      "reason": null
    },
    "davies_bouldin": {
      "status": "computed",
      "score": 0.18,
      "method": "standard_dbi_on_3d_unit_sphere_embedding",
      "coordinate_representation": "unit_sphere_xyz",
      "distance_metric": "euclidean_chord",
      "sample_size": 92,
      "reason": null
    },
    "dbcv": {
      "status": "not_computed",
      "score": null,
      "method": "density_based_clustering_validation_mutual_reachability_mst",
      "distance_metric": "haversine",
      "dimension": 2,
      "min_points": 4,
      "sample_size": 0,
      "max_sample_size": 2000,
      "reason": "reason is supplied by backend"
    }
  }
}
```

A `null` score is not converted to zero. Consumers must distinguish `null`
from a valid score of `0.0` and read the metric `status` and `reason`.

## 4. Elbow upper-tail audit artifact

`GET /api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=upper_tail`

Returns a PNG with three panels: full distribution, final 10%, and final 1%.
All panels use the original sorted K-distance values and global Knee rank. The
visual crop never recalculates Knee and never removes observations from DBSCAN.

The existing elbow summary/detail responses include `upper_tail_plot_url`.

## 5. Compatibility

Existing endpoint paths and request payloads remain unchanged. New response
fields are additive. Historical records with no evaluation metadata return an
empty object and historical metric values remain `null`.
