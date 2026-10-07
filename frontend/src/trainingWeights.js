// Mirrors the training-weight math in backend/server.js: each lift stores one Max,
// and its Endurance / Strength weights are fixed percentages of that Max.
export const DEFAULT_PCTS = { endurance_pct: 40, strength_pct: 60 };

export const TRAINING_TYPES = [
  { key: 'strength',  label: 'Strength Training',  color: '#ff8c5a' },
  { key: 'endurance', label: 'Endurance Training', color: '#4aa3ff' },
];

export const roundWeight = w => Math.round(w * 4) / 4;

export const pctFor = (field, pcts) => field === 'max' ? 100 : pcts[`${field}_pct`];

export const maxFrom = (field, weight, pcts) => weight * 100 / pctFor(field, pcts);

export function deriveWeights(max, pcts) {
  if (!(max > 0)) return { max: 0, endurance: 0, strength: 0 };
  return {
    max:       roundWeight(max),
    endurance: roundWeight(max * pcts.endurance_pct / 100),
    strength:  roundWeight(max * pcts.strength_pct  / 100),
  };
}
