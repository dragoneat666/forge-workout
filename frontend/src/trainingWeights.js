// Mirrors the training-weight math in backend/server.js: each lift stores one Max,
// and its Endurance / Strength weights are percentages of that Max. Weights round to
// the lift's increment (5 or 2.5 lbs): Endurance and Max round down, Strength up.
// Percentages and rounding come from the global settings unless the lift has its own.
export const DEFAULT_SETTINGS = { endurance_pct: 40, strength_pct: 60, round_to: 5 };
export const ROUND_OPTIONS = [2.5, 5];

export const TRAINING_TYPES = [
  { key: 'strength',  label: 'Strength Training',  color: '#ff8c5a' },
  { key: 'endurance', label: 'Endurance Training', color: '#4aa3ff' },
];

// Epsilon absorbs float error so an exact multiple (e.g. 64.99999999 of 5) isn't pushed a step
const roundDownTo = (w, inc) => Math.floor(w / inc + 1e-9) * inc;
const roundUpTo   = (w, inc) => Math.ceil(w / inc - 1e-9) * inc;
const ROUNDING = { endurance: roundDownTo, strength: roundUpTo, max: roundDownTo };

// field: 'endurance' | 'strength' | 'max'
export const roundTraining = (field, weight, settings) => ROUNDING[field](weight, settings.round_to);
export const ROUNDING_LABEL = { endurance: 'rounds down', strength: 'rounds up', max: 'rounds down' };

export const pctFor = (field, settings) => field === 'max' ? 100 : settings[`${field}_pct`];

export const maxFrom = (field, weight, settings) => weight * 100 / pctFor(field, settings);

// Effective settings for a lift, from a /api/training-weights response
export function liftSettings(trainingWeights, exerciseId) {
  const src = trainingWeights?.lifts?.[exerciseId] || trainingWeights || DEFAULT_SETTINGS;
  return { endurance_pct: src.endurance_pct, strength_pct: src.strength_pct, round_to: src.round_to };
}

export function deriveWeights(max, settings) {
  if (!(max > 0)) return { max: 0, endurance: 0, strength: 0 };
  return {
    max:       roundTraining('max', max, settings),
    endurance: roundTraining('endurance', max * settings.endurance_pct / 100, settings),
    strength:  roundTraining('strength',  max * settings.strength_pct  / 100, settings),
  };
}
