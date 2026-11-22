import type {
  ExperimentParameterSearchMetadata,
  ParameterExperiment,
  ParameterSearchMetadata,
} from '../types/domain';

export interface ExperimentProvenance {
  epsSources: string[] | null;
  roundingKm: number | null;
  methodVersion: string | null;
  epsRadian: number | null;
  combinationMode: string | null;
  useDefaultGrid: boolean | null;
  epsilonCandidateStrategy: string | null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Resolve provenance without deriving it from the selected MinPts.
 * Candidate origin (e.g. knee:minpts=8:-20%) is preserved verbatim from BE.
 */
export function resolveExperimentProvenance(
  experiment: ParameterExperiment,
  jobMetadata?: ParameterSearchMetadata | null,
): ExperimentProvenance {
  const nested: ExperimentParameterSearchMetadata | null | undefined =
    experiment.evaluation_metadata?.parameter_search;
  const candidate = jobMetadata?.epsilon_candidates?.find((item) =>
    Math.abs(item.eps_km - experiment.eps_km) < 1e-9,
  );

  return {
    epsSources: nested?.eps_sources ?? experiment.eps_sources ?? candidate?.eps_sources ?? null,
    roundingKm:
      finiteNumber(nested?.epsilon_rounding_km) ??
      finiteNumber(nested?.rounding_km) ??
      finiteNumber(experiment.epsilon_rounding_km) ??
      finiteNumber(jobMetadata?.epsilon_rounding_km) ??
      finiteNumber(jobMetadata?.rounding_km),
    methodVersion:
      nested?.method_version ?? experiment.method_version ?? jobMetadata?.method_version ?? null,
    epsRadian: finiteNumber(nested?.eps_radian) ?? finiteNumber(experiment.eps_radian),
    combinationMode: nested?.combination_mode ?? jobMetadata?.combination_mode ?? null,
    useDefaultGrid: nested?.use_default_grid ?? jobMetadata?.use_default_grid ?? null,
    epsilonCandidateStrategy:
      nested?.epsilon_candidate_strategy ?? jobMetadata?.epsilon_candidate_strategy ?? null,
  };
}
