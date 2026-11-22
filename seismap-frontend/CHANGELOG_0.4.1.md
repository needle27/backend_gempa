# SEISMAP Frontend 0.4.1

## Final DBSCAN contract update


- Removed minimum/maximum depth threshold controls from Final DBSCAN form.
- Final run request now sends exactly `{"experiment_id": <id>}` to `POST /api/admin/datasets/{dataset_id}/runs`.
- Epsilon and MinPts remain inherited from the selected valid Parameter Search experiment.
- Job progress polling by `job_id` and run tracking remain unchanged.
- Public cluster profile retains average/minimum/maximum depth and shallow/medium/deep event counts from `/api/profil`; the UI now exposes all six depth fields and documents the category boundaries.
- No public WebGIS endpoint or clustering feature selection was changed.
