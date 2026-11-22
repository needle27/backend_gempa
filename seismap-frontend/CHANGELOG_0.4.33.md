# SEISMAP Frontend v0.4.33

## Fix parameter-search request signature
- `startParameterSearch` now accepts the fifth `useDefaultGrid` argument already passed by `ParameterSearchPage`.
- Sends `use_default_grid` explicitly in the POST body.
- Sends empty explicit epsilon candidates as `null`, matching the BE 4.1.3 request contract.
- Preserves existing endpoint and other request fields.
