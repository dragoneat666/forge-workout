// Mirrors the training-weight math in backend/server.js: each lift stores one Max,
// and its Endurance / Strength weights are percentages of that Max (global, or the
// lift's own). Every displayed weight is rounded down to a whole pound.
export const DEFAULT_PCTS = { endurance_pct: 40, strength_pct: 60 };

export const TRAINING_TYPES = [
  { key: 'strength',  label: 'Strength Training',  color: '#ff8c5a' },
  { key: 'endurance', label: 'Endurance Training', color: '#4aa3ff' },
];

export const floorWeight = w => Math.floor(w + 1e-9); // epsilon absorbs float error, e.g. 64.99999999

export const pctFor = (field, pcts) => field === 'max' ? 100 : pcts[`${field}_pct`];

export const maxFrom = (field, weight, pcts) => weight * 100 / pctFor(field, pcts);

// Effective percentages for a lift, from a /api/training-weights response
export function liftPcts(trainingWeights, exerciseId) {
  const lift = trainingWeights?.lifts?.[exerciseId];
  const src  = lift || trainingWeights || DEFAULT_PCTS;
  return { endurance_pct: src.endurance_pct, strength_pct: src.strength_pct };
}

export function deriveWeights(max, pcts) {
  if (!(max > 0)) return { max: 0, endurance: 0, strength: 0 };
  return {
    max:       floorWeight(max),
    endurance: floorWeight(max * pcts.endurance_pct / 100),
    strength:  floorWeight(max * pcts.strength_pct  / 100),
  };
}
