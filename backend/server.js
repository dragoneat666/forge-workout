const express  = require('express');
const cron     = require('node-cron');
const archiver = require('archiver');
const cors     = require('cors');
const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Directories ───────────────────────────────────────────────────────────────
// Env overrides let the server run outside Docker (local test environments)
const dataDir       = process.env.DATA_DIR       || '/data';
const uploadsDir    = path.join(dataDir, 'uploads');
const animationsDir = process.env.ANIMATIONS_DIR || '/animation_files';
const frontendBuild = process.env.FRONTEND_BUILD || '/app/frontend/build';
const PORT          = process.env.PORT           || 3001;
const backupsDir = path.join(dataDir, 'backups');
[dataDir, uploadsDir, backupsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
if (!fs.existsSync(animationsDir)) { try { fs.mkdirSync(animationsDir, { recursive: true }); } catch(e) {} }

// ── File upload ───────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const ex   = db.prepare('SELECT name FROM exercises WHERE id=?').get(req.params.id);
    const safe = ex ? ex.name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'') : `exercise_${req.params.id}`;
    cb(null, `${safe}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });
app.use('/uploads', express.static(uploadsDir));

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Database(path.join(dataDir, 'workout.db'));
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    primary_muscles TEXT NOT NULL DEFAULT '[]',
    secondary_muscles TEXT NOT NULL DEFAULT '[]',
    custom INTEGER NOT NULL DEFAULT 0,
    exercise_type TEXT NOT NULL DEFAULT 'strength',
    description TEXT DEFAULT '',
    image_path TEXT DEFAULT '',
    uuid TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS workout_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS workout_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    exercise_type TEXT NOT NULL DEFAULT 'strength',
    weight REAL DEFAULT 0,
    sets INTEGER DEFAULT 3,
    reps INTEGER DEFAULT 10,
    distance REAL DEFAULT 0,
    distance_unit TEXT DEFAULT 'miles',
    duration_minutes REAL DEFAULT 0,
    target_speed REAL DEFAULT 0,
    weight_increase_type TEXT NOT NULL DEFAULT 'flat',
    weight_increase_value REAL NOT NULL DEFAULT 10,
    last_set_bump INTEGER DEFAULT 0,
    last_set_bump_type TEXT DEFAULT 'flat',
    last_set_bump_value REAL DEFAULT 10,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (day_id) REFERENCES workout_days(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
  );
  CREATE TABLE IF NOT EXISTS workout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL,
    session_number INTEGER NOT NULL DEFAULT 1,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    duration_seconds INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    FOREIGN KEY (day_id) REFERENCES workout_days(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS session_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    entry_id INTEGER,
    weight REAL DEFAULT 0,
    sets INTEGER DEFAULT 0,
    reps INTEGER DEFAULT 0,
    distance REAL DEFAULT 0,
    distance_unit TEXT DEFAULT 'miles',
    duration_minutes REAL DEFAULT 0,
    target_speed REAL DEFAULT 0,
    last_set_bump INTEGER DEFAULT 0,
    last_set_bump_type TEXT DEFAULT 'flat',
    last_set_bump_value REAL DEFAULT 10,
    completed INTEGER DEFAULT 0,
    temporary INTEGER DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
  );
  CREATE TABLE IF NOT EXISTS workout_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL,
    entry_id INTEGER,
    exercise_id INTEGER NOT NULL,
    exercise_type TEXT NOT NULL DEFAULT 'strength',
    weight REAL DEFAULT 0,
    sets INTEGER DEFAULT 0,
    reps INTEGER DEFAULT 0,
    distance REAL DEFAULT 0,
    distance_unit TEXT DEFAULT 'miles',
    duration_minutes REAL DEFAULT 0,
    target_speed REAL DEFAULT 0,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT DEFAULT '',
    FOREIGN KEY (day_id) REFERENCES workout_days(id)
  );
  CREATE TABLE IF NOT EXISTS exercise_maxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id INTEGER NOT NULL UNIQUE,
    max_weight REAL DEFAULT 0,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
  );
  CREATE TABLE IF NOT EXISTS body_weight_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    weight REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'lbs',
    logged_at TEXT NOT NULL,
    notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS routines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS routine_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id INTEGER NOT NULL,
    day_id INTEGER NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
    FOREIGN KEY (day_id) REFERENCES workout_days(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS routine_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id INTEGER NOT NULL,
    session_number INTEGER NOT NULL DEFAULT 1,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    duration_seconds INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS exercise_equipment (
    exercise_id INTEGER NOT NULL,
    equipment_id INTEGER NOT NULL,
    PRIMARY KEY (exercise_id, equipment_id),
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
  );
`);

// ── Migrations ────────────────────────────────────────────────────────────────
const safeAlter = (tbl, col, def) => { try { db.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def}`); } catch(e) {} };
safeAlter('exercises', 'exercise_type', "TEXT NOT NULL DEFAULT 'strength'");
safeAlter('exercises', 'description', 'TEXT DEFAULT ""');
safeAlter('exercises', 'image_path', 'TEXT DEFAULT ""');
safeAlter('workout_entries', 'exercise_type', "TEXT NOT NULL DEFAULT 'strength'");
safeAlter('workout_entries', 'distance', 'REAL DEFAULT 0');
safeAlter('workout_entries', 'distance_unit', "TEXT DEFAULT 'miles'");
safeAlter('workout_entries', 'duration_minutes', 'REAL DEFAULT 0');
safeAlter('workout_entries', 'target_speed', 'REAL DEFAULT 0');
safeAlter('workout_entries', 'last_set_bump', 'INTEGER DEFAULT 0');
safeAlter('workout_entries', 'last_set_bump_type', "TEXT DEFAULT 'flat'");
safeAlter('workout_entries', 'last_set_bump_value', 'REAL DEFAULT 10');
safeAlter('workout_logs', 'exercise_type', "TEXT NOT NULL DEFAULT 'strength'");
safeAlter('workout_logs', 'distance', 'REAL DEFAULT 0');
safeAlter('workout_logs', 'distance_unit', "TEXT DEFAULT 'miles'");
safeAlter('workout_logs', 'duration_minutes', 'REAL DEFAULT 0');
safeAlter('workout_logs', 'target_speed', 'REAL DEFAULT 0');
safeAlter('workout_logs', 'entry_id', 'INTEGER');
safeAlter('workout_days', 'sort_order', 'INTEGER DEFAULT 0');
safeAlter('workout_entries', 'cardio_mode', "TEXT DEFAULT 'treadmill'");
safeAlter('routine_sessions', 'progress_data', "TEXT DEFAULT '{}'");
safeAlter('workout_sessions', 'routine_session_id', 'INTEGER DEFAULT NULL');
safeAlter('workout_sessions', 'progress_data', "TEXT DEFAULT '{}'");
safeAlter('session_exercises', 'note', "TEXT DEFAULT ''");
safeAlter('workout_entries', 'cardio_stages', "TEXT DEFAULT '[]'");
safeAlter('session_exercises', 'last_set_bump', 'INTEGER DEFAULT 0');
safeAlter('session_exercises', 'last_set_bump_type', "TEXT DEFAULT 'flat'");
safeAlter('session_exercises', 'last_set_bump_value', 'REAL DEFAULT 10');
safeAlter('exercises', 'uuid', "TEXT DEFAULT ''");
safeAlter('exercises', 'model_url', "TEXT DEFAULT ''");
// 'strength' | 'endurance' links the entry's weight to that lift's training weight; '' = unlinked (legacy)
safeAlter('workout_entries', 'training_type', "TEXT DEFAULT ''");

// ── App settings table ────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
`);

// ── Helper: read app setting from DB ─────────────────────────────────────────
function getSetting(key, def='') {
  try {
    const row = db.prepare('SELECT value FROM app_settings WHERE key=?').get(key);
    return row ? row.value : def;
  } catch(e) { return def; }
}

// ── Training weights ──────────────────────────────────────────────────────────
// Each lift stores a single Max (exercise_maxes). Endurance and Strength weights
// are fixed percentages of it, and workout entries linked to a training type
// always carry that derived weight. Changing any one of them moves the Max.
const TRAINING_TYPES = ['endurance', 'strength'];
const roundWeight = w => Math.round(w * 4) / 4;

function getTrainingPcts() {
  const pct = (key, def) => { const v = parseFloat(getSetting(key, def)); return v > 0 && v <= 100 ? v : def; };
  return { endurance: pct('endurance_pct', 40), strength: pct('strength_pct', 60) };
}
function getMax(exerciseId) {
  return db.prepare('SELECT max_weight FROM exercise_maxes WHERE exercise_id=?').get(exerciseId)?.max_weight || 0;
}
function trainingWeights(max, pcts = getTrainingPcts()) {
  const has = max > 0;
  return {
    max_weight:       has ? roundWeight(max) : 0,
    endurance_weight: has ? roundWeight(max * pcts.endurance / 100) : 0,
    strength_weight:  has ? roundWeight(max * pcts.strength  / 100) : 0,
  };
}
function syncLinkedEntries(exerciseId, max, pcts = getTrainingPcts()) {
  if (!(max > 0)) return;
  const upd = db.prepare('UPDATE workout_entries SET weight=? WHERE exercise_id=? AND training_type=?');
  TRAINING_TYPES.forEach(t => upd.run(roundWeight(max * pcts[t] / 100), exerciseId, t));
}
function syncAllLinkedEntries() {
  const pcts = getTrainingPcts();
  db.prepare('SELECT exercise_id, max_weight FROM exercise_maxes').all()
    .forEach(m => syncLinkedEntries(m.exercise_id, m.max_weight, pcts));
}
function upsertMax(exerciseId, max) {
  db.prepare(`INSERT INTO exercise_maxes (exercise_id,max_weight) VALUES (?,?)
    ON CONFLICT(exercise_id) DO UPDATE SET max_weight=excluded.max_weight`).run(exerciseId, max);
}
function setExerciseMax(exerciseId, max) {
  upsertMax(exerciseId, max);
  syncLinkedEntries(exerciseId, max);
}
// A weight entered on a linked entry becomes that lift's training weight. It only
// moves the Max when it differs from the current derived weight, so rounding never
// drifts the Max. With weight 0 the entry simply pulls the existing training weight.
function applyTrainingWeight(exerciseId, trainingType, weight) {
  if (!TRAINING_TYPES.includes(trainingType)) return;
  const pcts = getTrainingPcts();
  let max = getMax(exerciseId);
  const unchanged = max > 0 && roundWeight(max * pcts[trainingType] / 100) === roundWeight(weight);
  if (weight > 0 && !unchanged) {
    max = weight * 100 / pcts[trainingType];
    upsertMax(exerciseId, max);
  }
  syncLinkedEntries(exerciseId, max, pcts);
}
const cleanTrainingType = (tt, exerciseType) =>
  exerciseType !== 'cardio' && TRAINING_TYPES.includes(tt) ? tt : '';

// Bump next session's weight for each completed, non-cardio entry. Linked entries
// raise the lift's Max instead (highest implied Max wins), re-syncing every linked entry.
function applyProgressiveOverload(sessionExercises) {
  const pcts = getTrainingPcts();
  const newMaxes = {};
  sessionExercises.filter(e => e.entry_id && e.completed).forEach(e => {
    const entry = db.prepare('SELECT * FROM workout_entries WHERE id=?').get(e.entry_id);
    if (!entry || entry.exercise_type === 'cardio') return;
    const newWeight = roundWeight(entry.weight_increase_type === 'percent'
      ? e.weight * (1 + entry.weight_increase_value / 100)
      : e.weight + entry.weight_increase_value);
    if (TRAINING_TYPES.includes(entry.training_type)) {
      const max = newWeight * 100 / pcts[entry.training_type];
      newMaxes[entry.exercise_id] = Math.max(newMaxes[entry.exercise_id] || 0, max);
    } else {
      db.prepare('UPDATE workout_entries SET weight=? WHERE id=?').run(newWeight, entry.id);
    }
  });
  Object.entries(newMaxes).forEach(([exId, max]) => setExerciseMax(Number(exId), max));
}

// ── UUID migration ────────────────────────────────────────────────────────────
// Assign fixed UUIDs to seeded exercises, random to custom ones
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Fixed UUIDs for seeded exercises (same on every install)
const SEED_UUIDS = {
  'Bench Press':               '00000001-0000-4000-0000-000000000001',
  'Incline Dumbbell Press':    '00000001-0000-4000-0000-000000000002',
  'Dumbbell Flyes':            '00000001-0000-4000-0000-000000000003',
  'Cable Crossover':           '00000001-0000-4000-0000-000000000004',
  'Push-Up':                   '00000001-0000-4000-0000-000000000005',
  'Chest Dip':                 '00000001-0000-4000-0000-000000000006',
  'Pullover':                  '00000001-0000-4000-0000-000000000007',
  'Serratus Crunch':           '00000001-0000-4000-0000-000000000008',
  'Lat Pulldown':              '00000001-0000-4000-0000-000000000009',
  'Seated Cable Row':          '00000001-0000-4000-0000-000000000010',
  'Barbell Row':               '00000001-0000-4000-0000-000000000011',
  'Dumbbell Row':              '00000001-0000-4000-0000-000000000012',
  'Pull-Up':                   '00000001-0000-4000-0000-000000000013',
  'Chin-Up':                   '00000001-0000-4000-0000-000000000014',
  'Deadlift':                  '00000001-0000-4000-0000-000000000015',
  'Romanian Deadlift':         '00000001-0000-4000-0000-000000000016',
  'Hyperextension':            '00000001-0000-4000-0000-000000000017',
  'Face Pull':                 '00000001-0000-4000-0000-000000000018',
  'Reverse Fly':               '00000001-0000-4000-0000-000000000019',
  'Band Pull-Apart':           '00000001-0000-4000-0000-000000000020',
  'Overhead Press':            '00000001-0000-4000-0000-000000000021',
  'Dumbbell Shoulder Press':   '00000001-0000-4000-0000-000000000022',
  'Lateral Raise':             '00000001-0000-4000-0000-000000000023',
  'Front Raise':               '00000001-0000-4000-0000-000000000024',
  'Rear Delt Fly':             '00000001-0000-4000-0000-000000000025',
  'Upright Row':               '00000001-0000-4000-0000-000000000026',
  'Shrugs':                    '00000001-0000-4000-0000-000000000027',
  'Barbell Curl':              '00000001-0000-4000-0000-000000000028',
  'Dumbbell Curl':             '00000001-0000-4000-0000-000000000029',
  'Hammer Curl':               '00000001-0000-4000-0000-000000000030',
  'Preacher Curl':             '00000001-0000-4000-0000-000000000031',
  'Concentration Curl':        '00000001-0000-4000-0000-000000000032',
  'Tricep Pushdown':           '00000001-0000-4000-0000-000000000033',
  'Skull Crusher':             '00000001-0000-4000-0000-000000000034',
  'Overhead Tricep Extension': '00000001-0000-4000-0000-000000000035',
  'Tricep Dip':                '00000001-0000-4000-0000-000000000036',
  'Wrist Curl':                '00000001-0000-4000-0000-000000000037',
  'Reverse Wrist Curl':        '00000001-0000-4000-0000-000000000038',
  'Farmer Carry':              '00000001-0000-4000-0000-000000000039',
  'Squat':                     '00000001-0000-4000-0000-000000000040',
  'Leg Press':                 '00000001-0000-4000-0000-000000000041',
  'Leg Extension':             '00000001-0000-4000-0000-000000000042',
  'Leg Curl':                  '00000001-0000-4000-0000-000000000043',
  'Lunge':                     '00000001-0000-4000-0000-000000000044',
  'Calf Raise':                '00000001-0000-4000-0000-000000000045',
  'Seated Calf Raise':         '00000001-0000-4000-0000-000000000046',
  'Hip Thrust':                '00000001-0000-4000-0000-000000000047',
  'Sumo Deadlift':             '00000001-0000-4000-0000-000000000048',
  'Hack Squat':                '00000001-0000-4000-0000-000000000049',
  'Split Squat':               '00000001-0000-4000-0000-000000000050',
  'Hip Abduction Machine':     '00000001-0000-4000-0000-000000000051',
  'Hip Adduction Machine':     '00000001-0000-4000-0000-000000000052',
  'Sumo Squat':                '00000001-0000-4000-0000-000000000053',
  'Leg Raise':                 '00000001-0000-4000-0000-000000000054',
  'Hanging Knee Raise':        '00000001-0000-4000-0000-000000000055',
  'Plank':                     '00000001-0000-4000-0000-000000000056',
  'Crunch':                    '00000001-0000-4000-0000-000000000057',
  'Cable Crunch':              '00000001-0000-4000-0000-000000000058',
  'Russian Twist':             '00000001-0000-4000-0000-000000000059',
  'Ab Rollout':                '00000001-0000-4000-0000-000000000060',
  'Side Plank':                '00000001-0000-4000-0000-000000000061',
  'Woodchop':                  '00000001-0000-4000-0000-000000000062',
  'Running':                   '00000001-0000-4000-0000-000000000063',
  'Cycling':                   '00000001-0000-4000-0000-000000000064',
  'Rowing Machine':            '00000001-0000-4000-0000-000000000065',
  'Jump Rope':                 '00000001-0000-4000-0000-000000000066',
  'Elliptical':                '00000001-0000-4000-0000-000000000067',
  'Swimming':                  '00000001-0000-4000-0000-000000000068',
  'Stair Climber':             '00000001-0000-4000-0000-000000000069',
  'Walking':                   '00000001-0000-4000-0000-000000000070',
};

// ── Force-update seeded exercise muscle tags ─────────────────────────────────
// Ensures stale data from INSERT OR IGNORE gets corrected
const seedUpdates = [
  { name:"Bench Press",               p:["chest"],                       s:["triceps","front_delts","serratus"] },
  { name:"Incline Dumbbell Press",    p:["chest"],                       s:["triceps","front_delts"] },
  { name:"Dumbbell Flyes",            p:["chest"],                       s:["front_delts","serratus"] },
  { name:"Cable Crossover",           p:["chest"],                       s:["front_delts","serratus"] },
  { name:"Push-Up",                   p:["chest"],                       s:["triceps","front_delts","serratus"] },
  { name:"Chest Dip",                 p:["chest"],                       s:["triceps"] },
  { name:"Pullover",                  p:["serratus","lats"],             s:["chest","triceps"] },
  { name:"Serratus Crunch",           p:["serratus"],                    s:["abs"] },
  { name:"Lat Pulldown",              p:["lats"],                        s:["biceps","rear_delts","mid_back"] },
  { name:"Seated Cable Row",          p:["lats","mid_back"],             s:["biceps","rear_delts","lower_back"] },
  { name:"Barbell Row",               p:["lats","mid_back"],             s:["biceps","rear_delts","lower_back"] },
  { name:"Dumbbell Row",              p:["lats"],                        s:["biceps","rear_delts","mid_back"] },
  { name:"Pull-Up",                   p:["lats"],                        s:["biceps","rear_delts","mid_back"] },
  { name:"Chin-Up",                   p:["lats","biceps"],               s:["rear_delts","mid_back"] },
  { name:"Deadlift",                  p:["lower_back","glutes","hamstrings"], s:["lats","traps","quads"] },
  { name:"Romanian Deadlift",         p:["hamstrings","glutes"],         s:["lower_back","lats"] },
  { name:"Hyperextension",            p:["lower_back"],                  s:["glutes","hamstrings"] },
  { name:"Face Pull",                 p:["rear_delts"],                  s:["traps","mid_back"] },
  { name:"Reverse Fly",               p:["rear_delts"],                  s:["mid_back","traps"] },
  { name:"Band Pull-Apart",           p:["rear_delts","mid_back"],       s:["traps"] },
  { name:"Overhead Press",            p:["front_delts","side_delts"],    s:["triceps","traps","serratus"] },
  { name:"Dumbbell Shoulder Press",   p:["front_delts","side_delts"],    s:["triceps"] },
  { name:"Lateral Raise",             p:["side_delts"],                  s:[] },
  { name:"Front Raise",               p:["front_delts"],                 s:["side_delts"] },
  { name:"Rear Delt Fly",             p:["rear_delts"],                  s:["traps"] },
  { name:"Upright Row",               p:["traps","side_delts"],          s:["front_delts","biceps"] },
  { name:"Shrugs",                    p:["traps"],                       s:[] },
  { name:"Barbell Curl",              p:["biceps"],                      s:["forearms"] },
  { name:"Dumbbell Curl",             p:["biceps"],                      s:["forearms"] },
  { name:"Hammer Curl",               p:["biceps"],                      s:["forearms"] },
  { name:"Preacher Curl",             p:["biceps"],                      s:[] },
  { name:"Concentration Curl",        p:["biceps"],                      s:[] },
  { name:"Tricep Pushdown",           p:["triceps"],                     s:[] },
  { name:"Skull Crusher",             p:["triceps"],                     s:[] },
  { name:"Overhead Tricep Extension", p:["triceps"],                     s:[] },
  { name:"Tricep Dip",                p:["triceps"],                     s:["chest"] },
  { name:"Wrist Curl",                p:["forearms"],                    s:[] },
  { name:"Reverse Wrist Curl",        p:["forearms"],                    s:[] },
  { name:"Farmer Carry",              p:["forearms"],                    s:["traps","lower_back"] },
  { name:"Squat",                     p:["quads","glutes"],              s:["hamstrings","calves","lower_back","adductors"] },
  { name:"Leg Press",                 p:["quads","glutes"],              s:["hamstrings","adductors"] },
  { name:"Leg Extension",             p:["quads"],                       s:[] },
  { name:"Leg Curl",                  p:["hamstrings"],                  s:[] },
  { name:"Lunge",                     p:["quads","glutes"],              s:["hamstrings","calves","hip_flexors"] },
  { name:"Calf Raise",                p:["calves"],                      s:["shins"] },
  { name:"Seated Calf Raise",         p:["calves"],                      s:[] },
  { name:"Hip Thrust",                p:["glutes"],                      s:["hamstrings"] },
  { name:"Sumo Deadlift",             p:["glutes","quads"],              s:["hamstrings","lower_back","adductors"] },
  { name:"Hack Squat",                p:["quads"],                       s:["glutes","hamstrings"] },
  { name:"Split Squat",               p:["quads","glutes"],              s:["hamstrings","hip_flexors"] },
  { name:"Hip Abduction Machine",     p:["abductors"],                   s:["glutes"] },
  { name:"Hip Adduction Machine",     p:["adductors"],                   s:[] },
  { name:"Sumo Squat",                p:["adductors","quads","glutes"],  s:["hamstrings"] },
  { name:"Leg Raise",                 p:["abs","hip_flexors"],           s:["obliques"] },
  { name:"Hanging Knee Raise",        p:["abs","hip_flexors"],           s:["obliques"] },
  { name:"Plank",                     p:["abs"],                         s:["lower_back","glutes","obliques"] },
  { name:"Crunch",                    p:["abs"],                         s:[] },
  { name:"Cable Crunch",              p:["abs"],                         s:[] },
  { name:"Russian Twist",             p:["obliques"],                    s:["abs"] },
  { name:"Ab Rollout",                p:["abs","serratus"],              s:["lower_back","obliques"] },
  { name:"Side Plank",                p:["obliques"],                    s:["abs","abductors"] },
  { name:"Woodchop",                  p:["obliques"],                    s:["abs","side_delts"] },
  { name:"Running",                   p:["quads","hamstrings","calves"], s:["glutes","hip_flexors","shins"] },
  { name:"Cycling",                   p:["quads","hamstrings","glutes"], s:["calves","hip_flexors"] },
  { name:"Rowing Machine",            p:["lats","quads"],                s:["biceps","rear_delts","hamstrings","lower_back"] },
  { name:"Jump Rope",                 p:["calves"],                      s:["quads","forearms","shins"] },
  { name:"Elliptical",                p:["quads","hamstrings"],          s:["glutes","calves","hip_flexors"] },
  { name:"Swimming",                  p:["lats","chest"],                s:["triceps","front_delts","serratus"] },
  { name:"Stair Climber",             p:["glutes","quads"],              s:["hamstrings","calves"] },
  { name:"Walking",                   p:["quads","hamstrings","calves"], s:["glutes","hip_flexors"] },
];
const forceUpdate = db.prepare('UPDATE exercises SET primary_muscles=?, secondary_muscles=? WHERE name=? AND custom=0');
seedUpdates.forEach(e => forceUpdate.run(JSON.stringify(e.p), JSON.stringify(e.s), e.name));

// Assign UUIDs to any exercise missing one
const updateUUID = db.prepare("UPDATE exercises SET uuid=? WHERE id=? AND (uuid IS NULL OR uuid='')");
const allExercises = db.prepare('SELECT * FROM exercises').all();
allExercises.forEach(ex => {
  if (!ex.uuid) {
    const uuid = SEED_UUIDS[ex.name] || generateUUID();
    updateUUID.run(uuid, ex.id);
  }
});
// Also update seed UUIDs for named exercises
Object.entries(SEED_UUIDS).forEach(([name, uuid]) => {
  db.prepare('UPDATE exercises SET uuid=? WHERE name=? AND custom=0').run(uuid, name);
});

// ── Seed default equipment ────────────────────────────────────────────────────
const equipSeeds = [
  { name:'Body Weight',    desc:'No equipment needed — uses your own body weight', sort:1 },
  { name:'Dumbbells',      desc:'Free weights held in each hand', sort:2 },
  { name:'Barbell',        desc:'Long bar loaded with weight plates', sort:3 },
  { name:'Cable Machine',  desc:'Pulley-based resistance machine', sort:4 },
  { name:'Bench',          desc:'Flat, incline, or decline bench', sort:5 },
  { name:'Pull-Up Bar',    desc:'Overhead bar for pulling movements', sort:6 },
  { name:'Leg Press Machine', desc:'Machine for pressing weight with legs', sort:7 },
  { name:'Leg Extension Machine', desc:'Machine for isolating quads', sort:8 },
  { name:'Leg Curl Machine', desc:'Machine for isolating hamstrings', sort:9 },
  { name:'Smith Machine',  desc:'Barbell on guided vertical track', sort:10 },
  { name:'Resistance Bands', desc:'Elastic bands for resistance training', sort:11 },
  { name:'Kettlebell',     desc:'Cast iron ball with a handle', sort:12 },
  { name:'Dip Bars',       desc:'Parallel bars for dips and support', sort:13 },
  { name:'Treadmill',      desc:'Running machine for cardio', sort:14 },
  { name:'Stationary Bike', desc:'Cycling machine for cardio', sort:15 },
  { name:'Rowing Machine', desc:'Rowing ergometer for cardio', sort:16 },
  { name:'Elliptical',     desc:'Low-impact cardio machine', sort:17 },
];
const insEquip = db.prepare('INSERT OR IGNORE INTO equipment (name,description,sort_order) VALUES (?,?,?)');
equipSeeds.forEach(e => insEquip.run(e.name, e.desc, e.sort));

// ── Seed exercises ────────────────────────────────────────────────────────────
const seeds = [
  { name:"Bench Press",               t:"strength", p:["chest"],                       s:["triceps","front_delts","serratus"] },
  { name:"Incline Dumbbell Press",    t:"strength", p:["chest"],                       s:["triceps","front_delts"] },
  { name:"Dumbbell Flyes",            t:"strength", p:["chest"],                       s:["front_delts","serratus"] },
  { name:"Cable Crossover",           t:"strength", p:["chest"],                       s:["front_delts","serratus"] },
  { name:"Push-Up",                   t:"strength", p:["chest"],                       s:["triceps","front_delts","serratus"] },
  { name:"Chest Dip",                 t:"strength", p:["chest"],                       s:["triceps"] },
  { name:"Pullover",                  t:"strength", p:["serratus","lats"],             s:["chest","triceps"] },
  { name:"Serratus Crunch",           t:"strength", p:["serratus"],                    s:["abs"] },
  { name:"Lat Pulldown",              t:"strength", p:["lats"],                        s:["biceps","rear_delts","mid_back"] },
  { name:"Seated Cable Row",          t:"strength", p:["lats","mid_back"],             s:["biceps","rear_delts","lower_back"] },
  { name:"Barbell Row",               t:"strength", p:["lats","mid_back"],             s:["biceps","rear_delts","lower_back"] },
  { name:"Dumbbell Row",              t:"strength", p:["lats"],                        s:["biceps","rear_delts","mid_back"] },
  { name:"Pull-Up",                   t:"strength", p:["lats"],                        s:["biceps","rear_delts","mid_back"] },
  { name:"Chin-Up",                   t:"strength", p:["lats","biceps"],               s:["rear_delts","mid_back"] },
  { name:"Deadlift",                  t:"strength", p:["lower_back","glutes","hamstrings"], s:["lats","traps","quads"] },
  { name:"Romanian Deadlift",         t:"strength", p:["hamstrings","glutes"],         s:["lower_back","lats"] },
  { name:"Hyperextension",            t:"strength", p:["lower_back"],                  s:["glutes","hamstrings"] },
  { name:"Face Pull",                 t:"strength", p:["rear_delts"],                  s:["traps","mid_back"] },
  { name:"Reverse Fly",               t:"strength", p:["rear_delts"],                  s:["mid_back","traps"] },
  { name:"Band Pull-Apart",           t:"strength", p:["rear_delts","mid_back"],       s:["traps"] },
  { name:"Overhead Press",            t:"strength", p:["front_delts","side_delts"],    s:["triceps","traps","serratus"] },
  { name:"Dumbbell Shoulder Press",   t:"strength", p:["front_delts","side_delts"],    s:["triceps"] },
  { name:"Lateral Raise",             t:"strength", p:["side_delts"],                  s:[] },
  { name:"Front Raise",               t:"strength", p:["front_delts"],                 s:["side_delts"] },
  { name:"Rear Delt Fly",             t:"strength", p:["rear_delts"],                  s:["traps"] },
  { name:"Upright Row",               t:"strength", p:["traps","side_delts"],          s:["front_delts","biceps"] },
  { name:"Shrugs",                    t:"strength", p:["traps"],                       s:[] },
  { name:"Barbell Curl",              t:"strength", p:["biceps"],                      s:["forearms"] },
  { name:"Dumbbell Curl",             t:"strength", p:["biceps"],                      s:["forearms"] },
  { name:"Hammer Curl",               t:"strength", p:["biceps"],                      s:["forearms"] },
  { name:"Preacher Curl",             t:"strength", p:["biceps"],                      s:[] },
  { name:"Concentration Curl",        t:"strength", p:["biceps"],                      s:[] },
  { name:"Tricep Pushdown",           t:"strength", p:["triceps"],                     s:[] },
  { name:"Skull Crusher",             t:"strength", p:["triceps"],                     s:[] },
  { name:"Overhead Tricep Extension", t:"strength", p:["triceps"],                     s:[] },
  { name:"Tricep Dip",                t:"strength", p:["triceps"],                     s:["chest"] },
  { name:"Wrist Curl",                t:"strength", p:["forearms"],                    s:[] },
  { name:"Reverse Wrist Curl",        t:"strength", p:["forearms"],                    s:[] },
  { name:"Farmer Carry",              t:"strength", p:["forearms"],                    s:["traps","lower_back"] },
  { name:"Squat",                     t:"strength", p:["quads","glutes"],              s:["hamstrings","calves","lower_back","adductors"] },
  { name:"Leg Press",                 t:"strength", p:["quads","glutes"],              s:["hamstrings","adductors"] },
  { name:"Leg Extension",             t:"strength", p:["quads"],                       s:[] },
  { name:"Leg Curl",                  t:"strength", p:["hamstrings"],                  s:[] },
  { name:"Lunge",                     t:"strength", p:["quads","glutes"],              s:["hamstrings","calves","hip_flexors"] },
  { name:"Calf Raise",                t:"strength", p:["calves"],                      s:["shins"] },
  { name:"Seated Calf Raise",         t:"strength", p:["calves"],                      s:[] },
  { name:"Hip Thrust",                t:"strength", p:["glutes"],                      s:["hamstrings"] },
  { name:"Sumo Deadlift",             t:"strength", p:["glutes","quads"],              s:["hamstrings","lower_back","adductors"] },
  { name:"Hack Squat",                t:"strength", p:["quads"],                       s:["glutes","hamstrings"] },
  { name:"Split Squat",               t:"strength", p:["quads","glutes"],              s:["hamstrings","hip_flexors"] },
  { name:"Hip Abduction Machine",     t:"strength", p:["abductors"],                   s:["glutes"] },
  { name:"Hip Adduction Machine",     t:"strength", p:["adductors"],                   s:[] },
  { name:"Sumo Squat",                t:"strength", p:["adductors","quads","glutes"],  s:["hamstrings"] },
  { name:"Leg Raise",                 t:"strength", p:["abs","hip_flexors"],           s:["obliques"] },
  { name:"Hanging Knee Raise",        t:"strength", p:["abs","hip_flexors"],           s:["obliques"] },
  { name:"Plank",                     t:"strength", p:["abs"],                         s:["lower_back","glutes","obliques"] },
  { name:"Crunch",                    t:"strength", p:["abs"],                         s:[] },
  { name:"Cable Crunch",              t:"strength", p:["abs"],                         s:[] },
  { name:"Russian Twist",             t:"strength", p:["obliques"],                    s:["abs"] },
  { name:"Ab Rollout",                t:"strength", p:["abs","serratus"],              s:["lower_back","obliques"] },
  { name:"Side Plank",                t:"strength", p:["obliques"],                    s:["abs","abductors"] },
  { name:"Woodchop",                  t:"strength", p:["obliques"],                    s:["abs","side_delts"] },
  { name:"Running",                   t:"cardio",   p:["quads","hamstrings","calves"], s:["glutes","hip_flexors","shins"] },
  { name:"Cycling",                   t:"cardio",   p:["quads","hamstrings","glutes"], s:["calves","hip_flexors"] },
  { name:"Rowing Machine",            t:"cardio",   p:["lats","quads"],                s:["biceps","rear_delts","hamstrings","lower_back"] },
  { name:"Jump Rope",                 t:"cardio",   p:["calves"],                      s:["quads","forearms","shins"] },
  { name:"Elliptical",                t:"cardio",   p:["quads","hamstrings"],          s:["glutes","calves","hip_flexors"] },
  { name:"Swimming",                  t:"cardio",   p:["lats","chest"],                s:["triceps","front_delts","serratus"] },
  { name:"Stair Climber",             t:"cardio",   p:["glutes","quads"],              s:["hamstrings","calves"] },
  { name:"Walking",                   t:"cardio",   p:["quads","hamstrings","calves"], s:["glutes","hip_flexors"] },
];
const ins = db.prepare(`INSERT OR IGNORE INTO exercises (name,primary_muscles,secondary_muscles,custom,exercise_type) VALUES (?,?,?,0,?)`);
seeds.forEach(e => ins.run(e.name, JSON.stringify(e.p), JSON.stringify(e.s), e.t));

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseEx = r => ({ ...r, primary_muscles: JSON.parse(r.primary_muscles), secondary_muscles: JSON.parse(r.secondary_muscles) });

// ── Exercises ─────────────────────────────────────────────────────────────────
app.get('/api/exercises', (req, res) => {
  const exercises = db.prepare('SELECT * FROM exercises ORDER BY exercise_type ASC, name ASC').all().map(parseEx);
  const allLinks  = db.prepare('SELECT ee.exercise_id, e.id, e.name FROM exercise_equipment ee JOIN equipment e ON e.id=ee.equipment_id ORDER BY e.name ASC').all();
  exercises.forEach(ex => {
    ex.equipment = allLinks.filter(l => l.exercise_id === ex.id).map(l => ({ id:l.id, name:l.name }));
  });
  res.json(exercises);
});
app.post('/api/exercises', (req, res) => {
  const { name, primary_muscles=[], secondary_muscles=[], exercise_type='strength', description='' } = req.body;
  if (!name) return res.status(400).json({ error:'Name required' });
  try {
    const uuid = generateUUID();
    const r = db.prepare('INSERT INTO exercises (name,primary_muscles,secondary_muscles,custom,exercise_type,description,uuid) VALUES (?,?,?,1,?,?,?)').run(name, JSON.stringify(primary_muscles), JSON.stringify(secondary_muscles), exercise_type, description, uuid);
    res.json(parseEx(db.prepare('SELECT * FROM exercises WHERE id=?').get(r.lastInsertRowid)));
  } catch(e) { res.status(400).json({ error:'Name already exists' }); }
});
app.put('/api/exercises/:id', (req, res) => {
  const { name, primary_muscles, secondary_muscles, exercise_type, description='' } = req.body;
  db.prepare('UPDATE exercises SET name=?,primary_muscles=?,secondary_muscles=?,exercise_type=?,description=? WHERE id=?')
    .run(name, JSON.stringify(primary_muscles), JSON.stringify(secondary_muscles), exercise_type, description, req.params.id);
  res.json(parseEx(db.prepare('SELECT * FROM exercises WHERE id=?').get(req.params.id)));
});
app.delete('/api/exercises/:id', (req, res) => {
  const ex = db.prepare('SELECT * FROM exercises WHERE id=?').get(req.params.id);
  if (!ex) return res.status(404).json({ error:'Exercise not found' });
  // Check if used in any workout routines
  const usedCount = db.prepare('SELECT COUNT(*) as c FROM workout_entries WHERE exercise_id=?').get(req.params.id).c;
  if (usedCount > 0 && !req.query.force) {
    return res.status(409).json({ error:`This exercise is used in ${usedCount} workout routine${usedCount!==1?'s':''}. Add ?force=1 to delete anyway.`, usedCount });
  }
  if (ex.image_path) {
    const fullPath = path.join(uploadsDir, path.basename(ex.image_path));
    if (fs.existsSync(fullPath)) try { fs.unlinkSync(fullPath); } catch(e) {}
  }
  db.prepare('DELETE FROM exercises WHERE id=?').run(req.params.id);
  res.json({ ok:true });
});

// Image upload
app.post('/api/exercises/:id/image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error:'No file' });
  // Delete old image if exists
  const ex = db.prepare('SELECT * FROM exercises WHERE id=?').get(req.params.id);
  if (ex?.image_path) {
    const old = path.join(uploadsDir, path.basename(ex.image_path));
    if (fs.existsSync(old)) try { fs.unlinkSync(old); } catch(e) {}
  }
  const imagePath = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE exercises SET image_path=? WHERE id=?').run(imagePath, req.params.id);
  res.json({ image_path: imagePath });
});
app.delete('/api/exercises/:id/image', (req, res) => {
  const ex = db.prepare('SELECT * FROM exercises WHERE id=?').get(req.params.id);
  if (ex?.image_path) {
    const fullPath = path.join(uploadsDir, path.basename(ex.image_path));
    if (fs.existsSync(fullPath)) try { fs.unlinkSync(fullPath); } catch(e) {}
  }
  db.prepare('UPDATE exercises SET image_path="" WHERE id=?').run(req.params.id);
  res.json({ ok:true });
});

// ── Workout Days ──────────────────────────────────────────────────────────────
app.get('/api/days', (req, res) => {
  const days = db.prepare('SELECT * FROM workout_days ORDER BY sort_order ASC, created_at ASC').all();
  const getEntries = db.prepare(`
    SELECT we.*, e.name as exercise_name, e.primary_muscles, e.secondary_muscles, e.exercise_type as ex_type, e.image_path, e.description as exercise_description
    FROM workout_entries we JOIN exercises e ON e.id=we.exercise_id
    WHERE we.day_id=? ORDER BY we.sort_order ASC
  `);
  res.json(days.map(d => ({
    ...d,
    entries: getEntries.all(d.id).map(e => {
      const { sort_order, ...rest } = e;
      return {
        ...rest,
        primary_muscles:  JSON.parse(e.primary_muscles),
        secondary_muscles:JSON.parse(e.secondary_muscles),
        cardio_stages:    JSON.parse(e.cardio_stages||'[]'),
      };
    })
  })));
});
app.post('/api/days', (req, res) => {
  const { name, description='' } = req.body;
  if (!name) return res.status(400).json({ error:'Name required' });
  const r = db.prepare('INSERT INTO workout_days (name,description) VALUES (?,?)').run(name, description);
  res.json(db.prepare('SELECT * FROM workout_days WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/days/:id', (req, res) => {
  const { name, description } = req.body;
  db.prepare('UPDATE workout_days SET name=?,description=? WHERE id=?').run(name, description, req.params.id);
  res.json(db.prepare('SELECT * FROM workout_days WHERE id=?').get(req.params.id));
});
app.delete('/api/days/:id', (req, res) => {
  db.prepare('DELETE FROM workout_days WHERE id=?').run(req.params.id);
  res.json({ ok:true });
});

// Reorder workout days
app.put('/api/days/reorder', (req, res) => {
  const { ids } = req.body; // array of day ids in new order
  const update = db.prepare('UPDATE workout_days SET sort_order=? WHERE id=?');
  ids.forEach((id, idx) => update.run(idx, id));
  res.json({ ok:true });
});

// ── Workout Entries ───────────────────────────────────────────────────────────
app.post('/api/days/:dayId/entries', (req, res) => {
  const { exercise_id, exercise_type='strength', weight=0, sets=3, reps=10,
    distance=0, distance_unit='miles', duration_minutes=0, target_speed=0,
    weight_increase_type='flat', weight_increase_value=10,
    last_set_bump=0, last_set_bump_type='flat', last_set_bump_value=10,
    cardio_mode='treadmill', cardio_stages=[], training_type='' } = req.body;
  const trainingType = cleanTrainingType(training_type, exercise_type);
  const count = db.prepare('SELECT COUNT(*) as c FROM workout_entries WHERE day_id=?').get(req.params.dayId).c;
  const r = db.prepare(`INSERT INTO workout_entries
    (day_id,exercise_id,exercise_type,weight,sets,reps,distance,distance_unit,duration_minutes,target_speed,
     weight_increase_type,weight_increase_value,last_set_bump,last_set_bump_type,last_set_bump_value,sort_order,cardio_mode,cardio_stages,training_type)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    req.params.dayId, exercise_id, exercise_type, weight, sets, reps,
    distance, distance_unit, duration_minutes, target_speed,
    weight_increase_type, weight_increase_value, last_set_bump?1:0, last_set_bump_type, last_set_bump_value, count,
    cardio_mode, JSON.stringify(cardio_stages), trainingType);
  applyTrainingWeight(exercise_id, trainingType, parseFloat(weight) || 0);
  const row = db.prepare(`SELECT we.*,e.name as exercise_name,e.primary_muscles,e.secondary_muscles,e.exercise_type as ex_type,e.image_path,e.description as exercise_description
    FROM workout_entries we JOIN exercises e ON e.id=we.exercise_id WHERE we.id=?`).get(r.lastInsertRowid);
  res.json({ ...row, primary_muscles:JSON.parse(row.primary_muscles), secondary_muscles:JSON.parse(row.secondary_muscles) });
});
app.put('/api/entries/:id', (req, res) => {
  const { weight=0, sets=3, reps=10, distance=0, distance_unit='miles', duration_minutes=0, target_speed=0,
    weight_increase_type='flat', weight_increase_value=10,
    last_set_bump=0, last_set_bump_type='flat', last_set_bump_value=10,
    cardio_mode='treadmill', cardio_stages=[], training_type='' } = req.body;
  const existing = db.prepare('SELECT * FROM workout_entries WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error:'Entry not found' });
  const trainingType = cleanTrainingType(training_type, existing.exercise_type);
  db.prepare(`UPDATE workout_entries SET weight=?,sets=?,reps=?,distance=?,distance_unit=?,
    duration_minutes=?,target_speed=?,weight_increase_type=?,weight_increase_value=?,
    last_set_bump=?,last_set_bump_type=?,last_set_bump_value=?,cardio_mode=?,cardio_stages=?,training_type=? WHERE id=?`).run(
    weight, sets, reps, distance, distance_unit, duration_minutes, target_speed,
    weight_increase_type, weight_increase_value, last_set_bump?1:0, last_set_bump_type, last_set_bump_value,
    cardio_mode, JSON.stringify(cardio_stages), trainingType, req.params.id);
  applyTrainingWeight(existing.exercise_id, trainingType, parseFloat(weight) || 0);
  const row = db.prepare(`SELECT we.*,e.name as exercise_name,e.primary_muscles,e.secondary_muscles,e.exercise_type as ex_type,e.image_path,e.description as exercise_description
    FROM workout_entries we JOIN exercises e ON e.id=we.exercise_id WHERE we.id=?`).get(req.params.id);
  res.json({ ...row, primary_muscles:JSON.parse(row.primary_muscles), secondary_muscles:JSON.parse(row.secondary_muscles) });
});
app.delete('/api/entries/:id', (req, res) => {
  db.prepare('DELETE FROM workout_entries WHERE id=?').run(req.params.id);
  res.json({ ok:true });
});

// Reorder entries within a day
app.put('/api/days/:dayId/entries/reorder', (req, res) => {
  const { ids } = req.body;
  const update = db.prepare('UPDATE workout_entries SET sort_order=? WHERE id=?');
  ids.forEach((id, idx) => update.run(idx, id));
  res.json({ ok:true });
});

// ── Sessions ──────────────────────────────────────────────────────────────────
// Global stats summary for home page
app.get('/api/stats/summary', (req, res) => {
  const workouts  = db.prepare('SELECT COUNT(*) as c FROM workout_days').get().c;
  const exercises = db.prepare('SELECT COUNT(*) as c FROM exercises').get().c;
  const sessions  = db.prepare('SELECT COUNT(*) as c FROM workout_sessions WHERE completed_at IS NOT NULL').get().c;
  const routines  = db.prepare('SELECT COUNT(*) as c FROM routines').get().c;
  res.json({ workouts, exercises, sessions, routines });
});

app.get('/api/days/:dayId/sessions', (req, res) => {
  const sessions = db.prepare('SELECT * FROM workout_sessions WHERE day_id=? ORDER BY session_number ASC').all(req.params.dayId);
  const getExercises = db.prepare(`
    SELECT se.id, se.session_id, se.exercise_id, se.entry_id, se.weight, se.sets, se.reps,
           se.distance, se.distance_unit, se.duration_minutes, se.target_speed,
           se.last_set_bump, se.last_set_bump_type, se.last_set_bump_value,
           se.completed, se.temporary, COALESCE(se.note, '') as note,
           e.name as exercise_name, e.primary_muscles, e.secondary_muscles,
           e.image_path, e.description as exercise_description, e.exercise_type as ex_type,
           we.cardio_mode, we.cardio_stages
    FROM session_exercises se
    JOIN exercises e ON e.id=se.exercise_id
    LEFT JOIN workout_entries we ON we.id=se.entry_id
    WHERE se.session_id=? ORDER BY se.id ASC
  `);
  res.json(sessions.map(s => ({
    ...s,
    exercises: getExercises.all(s.id).map(e => ({
      ...e,
      exercise_type:    e.ex_type || 'strength',
      primary_muscles:  JSON.parse(e.primary_muscles||'[]'),
      secondary_muscles:JSON.parse(e.secondary_muscles||'[]'),
      cardio_stages:    JSON.parse(e.cardio_stages||'[]'),
    })),
    progress_data: (() => { try { return JSON.parse(s.progress_data||'{}'); } catch(e) { return {}; } })()
  })));
});

// Start a new session
app.post('/api/days/:dayId/sessions', (req, res) => {
  const dayId = req.params.dayId;
  const lastSession = db.prepare('SELECT MAX(session_number) as max_num FROM workout_sessions WHERE day_id=?').get(dayId);
  const sessionNum = (lastSession.max_num || 0) + 1;
  const r = db.prepare('INSERT INTO workout_sessions (day_id, session_number) VALUES (?,?)').run(dayId, sessionNum);
  const sessionId = r.lastInsertRowid;

  // Copy current workout entries into session_exercises
  const entries = db.prepare(`
    SELECT we.*, e.name as exercise_name, e.primary_muscles, e.secondary_muscles, e.image_path, e.description as exercise_description
    FROM workout_entries we JOIN exercises e ON e.id=we.exercise_id
    WHERE we.day_id=? ORDER BY we.sort_order ASC
  `).all(dayId);

  const insEx = db.prepare(`INSERT INTO session_exercises
    (session_id,exercise_id,entry_id,weight,sets,reps,distance,distance_unit,duration_minutes,target_speed,
     last_set_bump,last_set_bump_type,last_set_bump_value,completed,temporary)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,0)`);

  entries.forEach(e => insEx.run(
    sessionId, e.exercise_id, e.id, e.weight, e.sets, e.reps,
    e.distance, e.distance_unit, e.duration_minutes, e.target_speed,
    e.last_set_bump||0, e.last_set_bump_type||'flat', e.last_set_bump_value||10
  ));

  const session = db.prepare('SELECT * FROM workout_sessions WHERE id=?').get(sessionId);
  // Join back to workout_entries to get cardio_mode and cardio_stages
  const exRows = db.prepare(`SELECT se.*,e.name as exercise_name,e.primary_muscles,e.secondary_muscles,
    e.image_path,e.description as exercise_description,e.exercise_type as ex_type,
    we.cardio_mode,we.cardio_stages
    FROM session_exercises se 
    JOIN exercises e ON e.id=se.exercise_id
    LEFT JOIN workout_entries we ON we.id=se.entry_id
    WHERE se.session_id=? ORDER BY se.id ASC`).all(sessionId);

  res.json({
    ...session,
    exercises: exRows.map(e => ({
      ...e,
      exercise_type:    e.ex_type || 'strength',
      primary_muscles:  JSON.parse(e.primary_muscles||'[]'),
      secondary_muscles:JSON.parse(e.secondary_muscles||'[]'),
      cardio_stages:    JSON.parse(e.cardio_stages||'[]'),
    }))
  });
});

// Save workout progress (elapsed time + cardio stage positions)
app.put('/api/sessions/:id/progress', express.json(), (req, res) => {
  const { elapsed_seconds=0, cardio_timers={} } = req.body;
  const progress = JSON.stringify({ elapsed_seconds, cardio_timers, saved_at: new Date().toISOString() });
  db.prepare('UPDATE workout_sessions SET progress_data=?, duration_seconds=? WHERE id=?')
    .run(progress, elapsed_seconds, req.params.id);
  res.json({ ok:true });
});

// Add temporary exercise to active session
app.post('/api/sessions/:id/temp-exercise', express.json(), (req, res) => {
  const { exercise_id } = req.body;
  const session = db.prepare('SELECT * FROM workout_sessions WHERE id=?').get(req.params.id);
  if (!session) return res.status(404).json({ error:'Session not found' });
  const ex = db.prepare('SELECT * FROM exercises WHERE id=?').get(exercise_id);
  if (!ex) return res.status(404).json({ error:'Exercise not found' });
  const r = db.prepare(`INSERT INTO session_exercises
    (session_id,exercise_id,entry_id,weight,sets,reps,distance,distance_unit,
     duration_minutes,target_speed,last_set_bump,last_set_bump_type,last_set_bump_value,completed,temporary,note)
    VALUES (?,?,NULL,0,3,10,0,'miles',0,0,0,'flat',10,0,1,'(Added during session)')`).run(req.params.id, exercise_id);
  const newEx = db.prepare(`SELECT se.*,e.name as exercise_name,e.primary_muscles,e.secondary_muscles,
    e.exercise_type as ex_type,e.image_path,e.description as exercise_description
    FROM session_exercises se JOIN exercises e ON e.id=se.exercise_id WHERE se.id=?`).get(r.lastInsertRowid);
  res.json({
    ...newEx,
    exercise_type: newEx.ex_type || 'strength',
    primary_muscles: JSON.parse(newEx.primary_muscles||'[]'),
    secondary_muscles: JSON.parse(newEx.secondary_muscles||'[]'),
    cardio_stages: [],
  });
});

// Update session exercise note
app.put('/api/session-exercises/:id/note', express.json(), (req, res) => {
  const { note='' } = req.body;
  db.prepare('UPDATE session_exercises SET note=? WHERE id=?').run(note, req.params.id);
  res.json({ ok:true });
});

// Edit a workout session (date, duration, notes)
app.put('/api/sessions/:id/edit', express.json(), (req, res) => {
  const { date, duration_seconds, notes='' } = req.body;
  const session = db.prepare('SELECT * FROM workout_sessions WHERE id=?').get(req.params.id);
  if (!session) return res.status(404).json({ error:'Session not found' });
  
  if (date) {
    const newDate = new Date(date).toISOString();
    db.prepare('UPDATE workout_sessions SET started_at=?, completed_at=? WHERE id=?')
      .run(newDate, newDate, req.params.id);
  }
  if (duration_seconds !== undefined) {
    db.prepare('UPDATE workout_sessions SET duration_seconds=? WHERE id=?')
      .run(duration_seconds, req.params.id);
  }
  db.prepare('UPDATE workout_sessions SET notes=? WHERE id=?').run(notes, req.params.id);
  res.json(db.prepare('SELECT * FROM workout_sessions WHERE id=?').get(req.params.id));
});

// Edit a routine session (date, duration)  
app.put('/api/routine-sessions/:id/edit', express.json(), (req, res) => {
  const { date, duration_seconds } = req.body;
  const rs = db.prepare('SELECT * FROM routine_sessions WHERE id=?').get(req.params.id);
  if (!rs) return res.status(404).json({ error:'Not found' });
  if (date) {
    const newDate = new Date(date).toISOString();
    db.prepare('UPDATE routine_sessions SET started_at=?, completed_at=? WHERE id=?')
      .run(newDate, newDate, req.params.id);
    // Also update all linked workout sessions
    db.prepare('UPDATE workout_sessions SET started_at=?, completed_at=? WHERE routine_session_id=?')
      .run(newDate, newDate, req.params.id);
  }
  if (duration_seconds !== undefined) {
    db.prepare('UPDATE routine_sessions SET duration_seconds=? WHERE id=?')
      .run(duration_seconds, req.params.id);
  }
  res.json({ ok:true });
});

// Delete a workout session
app.delete('/api/sessions/:id', (req, res) => {
  db.prepare('DELETE FROM session_exercises WHERE session_id=?').run(req.params.id);
  db.prepare('DELETE FROM workout_sessions WHERE id=?').run(req.params.id);
  res.json({ ok:true });
});

// Complete a session
app.put('/api/sessions/:id/complete', (req, res) => {
  const { duration_seconds=0, apply_overload=false, entry_overloads={}, notes='' } = req.body;
  const sessionId = req.params.id;

  db.prepare('UPDATE workout_sessions SET completed_at=CURRENT_TIMESTAMP, duration_seconds=?, notes=? WHERE id=?')
    .run(duration_seconds, notes, sessionId);

  const session = db.prepare('SELECT * FROM workout_sessions WHERE id=?').get(sessionId);
  const exercises = db.prepare('SELECT * FROM session_exercises WHERE session_id=?').all(sessionId);

  // Log each completed exercise
  exercises.filter(e => e.completed).forEach(e => {
    db.prepare(`INSERT INTO workout_logs (day_id,entry_id,exercise_id,exercise_type,weight,sets,reps,distance,distance_unit,duration_minutes,target_speed)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      session.day_id, e.entry_id, e.exercise_id, 'strength',
      e.weight, e.sets, e.reps, e.distance, e.distance_unit, e.duration_minutes, e.target_speed);
  });

  // Apply progressive overload if requested
  if (apply_overload) {
    // Use per-entry overload map if provided, otherwise fall back to apply_overload bool
    const shouldApply = e => Object.keys(entry_overloads).length > 0 ? !!entry_overloads[String(e.entry_id)] : true;
    applyProgressiveOverload(exercises.filter(shouldApply));
  }

  res.json({ ok:true });
});

// Delete a session
app.delete('/api/sessions/:id', (req, res) => {
  db.prepare('DELETE FROM session_exercises WHERE session_id=?').run(req.params.id);
  db.prepare('DELETE FROM workout_sessions WHERE id=?').run(req.params.id);
  res.json({ ok:true });
});

// Check off an exercise in a session
app.put('/api/session-exercises/:id/complete', (req, res) => {
  const { completed } = req.body;
  db.prepare('UPDATE session_exercises SET completed=? WHERE id=?').run(completed?1:0, req.params.id);
  res.json({ ok:true });
});

// Update weight for a session exercise
app.put('/api/session-exercises/:id/weight', (req, res) => {
  const { weight, update_routine=false } = req.body;
  db.prepare('UPDATE session_exercises SET weight=? WHERE id=?').run(weight, req.params.id);
  // Optionally update the routine entry weight
  if (update_routine) {
    const se = db.prepare('SELECT * FROM session_exercises WHERE id=?').get(req.params.id);
    const entry = se?.entry_id && db.prepare('SELECT * FROM workout_entries WHERE id=?').get(se.entry_id);
    if (entry) {
      db.prepare('UPDATE workout_entries SET weight=? WHERE id=?').run(weight, entry.id);
      applyTrainingWeight(entry.exercise_id, entry.training_type, parseFloat(weight) || 0);
    }
  }
  res.json({ ok:true });
});

// Add exercise to active session
app.post('/api/sessions/:id/exercises', (req, res) => {
  const { exercise_id, weight=0, sets=3, reps=10, distance=0, distance_unit='miles',
    duration_minutes=0, target_speed=0, temporary=false, add_to_routine=false } = req.body;
  const sessionId = req.params.id;
  const session = db.prepare('SELECT * FROM workout_sessions WHERE id=?').get(sessionId);

  // Add to session
  const r = db.prepare(`INSERT INTO session_exercises
    (session_id,exercise_id,entry_id,weight,sets,reps,distance,distance_unit,duration_minutes,target_speed,completed,temporary)
    VALUES (?,?,null,?,?,?,?,?,?,?,0,?)`).run(sessionId, exercise_id, weight, sets, reps, distance, distance_unit, duration_minutes, target_speed, temporary?1:0);

  // If permanent, add to routine
  if (add_to_routine && session) {
    const count = db.prepare('SELECT COUNT(*) as c FROM workout_entries WHERE day_id=?').get(session.day_id).c;
    const ex = db.prepare('SELECT * FROM exercises WHERE id=?').get(exercise_id);
    db.prepare(`INSERT INTO workout_entries (day_id,exercise_id,exercise_type,weight,sets,reps,distance,distance_unit,duration_minutes,target_speed,weight_increase_type,weight_increase_value,sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,'flat',10,?)`).run(session.day_id, exercise_id, ex?.exercise_type||'strength', weight, sets, reps, distance, distance_unit, duration_minutes, target_speed, count);
  }

  const row = db.prepare(`SELECT se.*,e.name as exercise_name,e.primary_muscles,e.secondary_muscles,e.image_path,e.description as exercise_description
    FROM session_exercises se JOIN exercises e ON e.id=se.exercise_id WHERE se.id=?`).get(r.lastInsertRowid);
  res.json({ ...row, primary_muscles:JSON.parse(row.primary_muscles), secondary_muscles:JSON.parse(row.secondary_muscles) });
});

// ── Logs ──────────────────────────────────────────────────────────────────────
app.get('/api/logs/exercise/:id', (req, res) => {
  const logs = db.prepare(`
    SELECT wl.*, ws.session_number
    FROM workout_logs wl
    LEFT JOIN workout_sessions ws ON ws.day_id=wl.day_id AND ws.completed_at IS NOT NULL
    WHERE wl.exercise_id=?
    ORDER BY wl.completed_at ASC
  `).all(req.params.id);
  res.json(logs);
});
app.get('/api/logs/recent', (req, res) => {
  res.json(db.prepare(`SELECT wl.*,e.name as exercise_name,wd.name as day_name
    FROM workout_logs wl JOIN exercises e ON e.id=wl.exercise_id JOIN workout_days wd ON wd.id=wl.day_id
    ORDER BY wl.completed_at DESC LIMIT 100`).all());
});

// ── Exercise Stats (for My Stats page) ───────────────────────────────────────
app.get('/api/stats/exercises', (req, res) => {
  const exercises = db.prepare('SELECT * FROM exercises ORDER BY name ASC').all().map(parseEx);
  const maxes = Object.fromEntries(db.prepare('SELECT exercise_id, max_weight FROM exercise_maxes').all()
    .map(m => [m.exercise_id, m.max_weight]));
  const linkCounts = db.prepare(`SELECT exercise_id, training_type, COUNT(*) as c FROM workout_entries
    WHERE training_type IN ('strength','endurance') GROUP BY exercise_id, training_type`).all();
  const pcts = getTrainingPcts();

  res.json(exercises.map(ex => {
    const linked = { strength:0, endurance:0 };
    linkCounts.filter(l => l.exercise_id === ex.id).forEach(l => { linked[l.training_type] = l.c; });
    return { ...ex, ...trainingWeights(maxes[ex.id] || 0, pcts), linked_entries: linked };
  }));
});

// Set a lift's weights from any one of them: { training_type:'strength'|'endurance'|'max', weight }
// (legacy { max_weight } still accepted). A weight of 0 clears the lift.
app.put('/api/stats/exercises/:id/max', (req, res) => {
  const { training_type='max' } = req.body;
  const weight = parseFloat(req.body.weight ?? req.body.max_weight);
  if (!(weight >= 0)) return res.status(400).json({ error:'Weight must be a number of 0 or more' });
  const pcts = getTrainingPcts();
  const max = TRAINING_TYPES.includes(training_type) ? weight * 100 / pcts[training_type] : weight;
  setExerciseMax(req.params.id, max);
  res.json(trainingWeights(max, pcts));
});

// Percentages + every lift's Max, for pulling training weights into workout entries
app.get('/api/training-weights', (req, res) => {
  const pcts = getTrainingPcts();
  const maxes = {};
  db.prepare('SELECT exercise_id, max_weight FROM exercise_maxes WHERE max_weight > 0').all()
    .forEach(m => { maxes[m.exercise_id] = m.max_weight; });
  res.json({ endurance_pct: pcts.endurance, strength_pct: pcts.strength, maxes });
});

app.get('/api/stats/exercises/:id/history', (req, res) => {
  const logs = db.prepare(`
    SELECT wl.weight, wl.completed_at,
      ROW_NUMBER() OVER (ORDER BY wl.completed_at ASC) as session_num
    FROM workout_logs wl
    WHERE wl.exercise_id=? AND wl.weight > 0
    ORDER BY wl.completed_at ASC
  `).all(req.params.id);
  res.json(logs);
});

// ── Equipment ────────────────────────────────────────────────────────────────
app.get('/api/equipment', (req, res) => {
  res.json(db.prepare('SELECT * FROM equipment ORDER BY name ASC').all());
});
app.post('/api/equipment', (req, res) => {
  const { name, description='' } = req.body;
  if (!name) return res.status(400).json({ error:'Name required' });
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM equipment').get().c;
    const r = db.prepare('INSERT INTO equipment (name,description,sort_order) VALUES (?,?,?)').run(name.trim(), description, count+1);
    res.json(db.prepare('SELECT * FROM equipment WHERE id=?').get(r.lastInsertRowid));
  } catch(e) { res.status(400).json({ error:'Equipment name already exists' }); }
});
app.put('/api/equipment/:id', (req, res) => {
  const { name, description='' } = req.body;
  db.prepare('UPDATE equipment SET name=?,description=? WHERE id=?').run(name.trim(), description, req.params.id);
  res.json(db.prepare('SELECT * FROM equipment WHERE id=?').get(req.params.id));
});
app.delete('/api/equipment/:id', (req, res) => {
  db.prepare('DELETE FROM equipment WHERE id=?').run(req.params.id);
  res.json({ ok:true });
});

// Exercise equipment assignments
app.get('/api/exercises/:id/equipment', (req, res) => {
  const rows = db.prepare(`SELECT e.* FROM equipment e
    JOIN exercise_equipment ee ON ee.equipment_id=e.id
    WHERE ee.exercise_id=? ORDER BY e.sort_order ASC`).all(req.params.id);
  res.json(rows);
});
app.put('/api/exercises/:id/equipment', (req, res) => {
  const { equipment_ids=[] } = req.body;
  db.prepare('DELETE FROM exercise_equipment WHERE exercise_id=?').run(req.params.id);
  const ins = db.prepare('INSERT INTO exercise_equipment (exercise_id,equipment_id) VALUES (?,?)');
  equipment_ids.forEach(eid => ins.run(req.params.id, eid));
  res.json({ ok:true });
});

// Get all exercises with their equipment
app.get('/api/exercises/with-equipment', (req, res) => {
  const exercises = db.prepare('SELECT * FROM exercises ORDER BY exercise_type ASC, name ASC').all().map(e => ({
    ...e,
    primary_muscles: JSON.parse(e.primary_muscles),
    secondary_muscles: JSON.parse(e.secondary_muscles),
  }));
  const allLinks = db.prepare('SELECT ee.exercise_id, e.id, e.name FROM exercise_equipment ee JOIN equipment e ON e.id=ee.equipment_id').all();
  exercises.forEach(ex => {
    ex.equipment = allLinks.filter(l => l.exercise_id === ex.id).map(l => ({ id:l.id, name:l.name }));
  });
  res.json(exercises);
});

// ── Body weight ───────────────────────────────────────────────────────────────
app.get('/api/bodyweight', (req, res) => {
  res.json(db.prepare('SELECT * FROM body_weight_logs ORDER BY logged_at DESC').all());
});
app.post('/api/bodyweight', (req, res) => {
  const { weight, unit='lbs', logged_at, notes='' } = req.body;
  if (!weight) return res.status(400).json({ error:'Weight required' });
  const date = logged_at || new Date().toISOString().split('T')[0];
  const r = db.prepare('INSERT INTO body_weight_logs (weight,unit,logged_at,notes) VALUES (?,?,?,?)').run(weight, unit, date, notes);
  res.json(db.prepare('SELECT * FROM body_weight_logs WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/bodyweight/:id', (req, res) => {
  const { weight, unit='lbs', logged_at, notes='' } = req.body;
  db.prepare('UPDATE body_weight_logs SET weight=?,unit=?,logged_at=?,notes=? WHERE id=?').run(weight, unit, logged_at, notes, req.params.id);
  res.json(db.prepare('SELECT * FROM body_weight_logs WHERE id=?').get(req.params.id));
});
app.delete('/api/bodyweight/:id', (req, res) => {
  db.prepare('DELETE FROM body_weight_logs WHERE id=?').run(req.params.id);
  res.json({ ok:true });
});

// ── App Settings ─────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM app_settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  const token = process.env.GITHUB_EXERCISES_TOKEN || '';
  const repo  = process.env.GITHUB_EXERCISES_REPO  || '';
  settings.has_exercises_token = !!token;
  settings.exercises_repo      = repo;
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const allowed = ['backup_schedule','backup_time','backup_retain_weeks','endurance_pct','strength_pct'];
  const pctKeys = { endurance_pct:'Endurance %', strength_pct:'Strength %' };
  for (const [k, label] of Object.entries(pctKeys)) {
    if (k in req.body && !(parseFloat(req.body[k]) > 0 && parseFloat(req.body[k]) <= 100))
      return res.status(400).json({ error:`${label} must be between 1 and 100` });
  }
  const upsert  = db.prepare('INSERT OR REPLACE INTO app_settings (key,value) VALUES (?,?)');
  Object.entries(req.body).forEach(([k,v]) => {
    if (allowed.includes(k)) upsert.run(k, String(v));
  });
  // New percentages change every derived training weight
  if (Object.keys(pctKeys).some(k => k in req.body)) syncAllLinkedEntries();
  res.json({ ok:true });
});

// ── Exercise Export ───────────────────────────────────────────────────────────
app.get('/api/exercises/export', (req, res) => {
  const exercises = db.prepare('SELECT * FROM exercises ORDER BY name ASC').all().map(e => ({
    ...e,
    primary_muscles:   JSON.parse(e.primary_muscles),
    secondary_muscles: JSON.parse(e.secondary_muscles),
    equipment: db.prepare(`SELECT eq.name FROM equipment eq
      JOIN exercise_equipment ee ON ee.equipment_id=eq.id
      WHERE ee.exercise_id=?`).all(e.id).map(r => r.name),
  }));
  const data = {
    exported_at: new Date().toISOString(),
    version: '1.0',
    source: process.env.GITHUB_EXERCISES_REPO || 'forge-workout',
    exercises,
  };
  res.setHeader('Content-Disposition', `attachment; filename="forge_exercises_${new Date().toISOString().split('T')[0]}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(data);
});

// ── Exercise Import ───────────────────────────────────────────────────────────
app.post('/api/exercises/check-conflicts', express.json({ limit:'10mb' }), (req, res) => {
  const { exercises=[] } = req.body;
  const conflicts = [], newExercises = [];
  exercises.forEach(ex => {
    const byUUID = ex.uuid ? db.prepare("SELECT * FROM exercises WHERE uuid=?").get(ex.uuid) : null;
    const byName = db.prepare('SELECT * FROM exercises WHERE name=?').get(ex.name);
    const existing = byUUID || byName;
    if (!existing) {
      newExercises.push(ex.name);
    } else {
      const ep = JSON.parse(existing.primary_muscles||'[]').sort().join(',');
      const es = JSON.parse(existing.secondary_muscles||'[]').sort().join(',');
      const ip = (ex.primary_muscles||[]).sort().join(',');
      const is = (ex.secondary_muscles||[]).sort().join(',');
      const differs = existing.description !== (ex.description||'') ||
                      existing.exercise_type !== (ex.exercise_type||'strength') ||
                      ep !== ip || es !== is;
      if (differs) conflicts.push({
        name: ex.name,
        yours:    { description:existing.description, exercise_type:existing.exercise_type, primary_muscles:JSON.parse(existing.primary_muscles||'[]'), secondary_muscles:JSON.parse(existing.secondary_muscles||'[]') },
        imported: { description:ex.description||'',  exercise_type:ex.exercise_type||'strength', primary_muscles:ex.primary_muscles||[], secondary_muscles:ex.secondary_muscles||[] },
      });
    }
  });
  res.json({ conflicts, new_count: newExercises.length, new_exercises: newExercises });
});

app.post('/api/exercises/import', express.json({ limit:'10mb' }), (req, res) => {
  const { exercises=[], conflict_resolution='keep' } = req.body;
  const results = { added:0, kept:0, overwritten:0, duplicated:0, errors:[] };
  const findByUUID = db.prepare("SELECT * FROM exercises WHERE uuid=?");
  const findByName = db.prepare('SELECT * FROM exercises WHERE name=?');
  exercises.forEach(ex => {
    try {
      const existing = (ex.uuid ? findByUUID.get(ex.uuid) : null) || findByName.get(ex.name);
      if (!existing) {
        const uuid = ex.uuid || generateUUID();
        const r = db.prepare(`INSERT INTO exercises (name,primary_muscles,secondary_muscles,custom,exercise_type,description,image_path,uuid) VALUES (?,?,?,0,?,?,?,?)`)
          .run(ex.name, JSON.stringify(ex.primary_muscles||[]), JSON.stringify(ex.secondary_muscles||[]), ex.exercise_type||'strength', ex.description||'', ex.image_path||'', uuid);
        if (ex.equipment?.length) {
          ex.equipment.forEach(eqName => {
            const eq = db.prepare('SELECT id FROM equipment WHERE name=?').get(eqName);
            if (eq) db.prepare('INSERT OR IGNORE INTO exercise_equipment (exercise_id,equipment_id) VALUES (?,?)').run(r.lastInsertRowid, eq.id);
          });
        }
        results.added++;
      } else if (conflict_resolution === 'overwrite') {
        db.prepare(`UPDATE exercises SET name=?,primary_muscles=?,secondary_muscles=?,exercise_type=?,description=?,image_path=?,uuid=? WHERE id=?`)
          .run(ex.name, JSON.stringify(ex.primary_muscles||[]), JSON.stringify(ex.secondary_muscles||[]), ex.exercise_type||'strength', ex.description||'', ex.image_path||'', ex.uuid||existing.uuid, existing.id);
        results.overwritten++;
      } else if (conflict_resolution === 'duplicate') {
        const dupName = `${ex.name} (Imported)`;
        if (!findByName.get(dupName)) {
          db.prepare(`INSERT INTO exercises (name,primary_muscles,secondary_muscles,custom,exercise_type,description,image_path,uuid) VALUES (?,?,?,0,?,?,?,?)`)
            .run(dupName, JSON.stringify(ex.primary_muscles||[]), JSON.stringify(ex.secondary_muscles||[]), ex.exercise_type||'strength', ex.description||'', ex.image_path||'', generateUUID());
          results.duplicated++;
        } else { results.kept++; }
      } else { results.kept++; }
    } catch(e) { results.errors.push(`${ex.name}: ${e.message}`); }
  });
  res.json(results);
});

// ── Exercise Repo Sync ────────────────────────────────────────────────────────
async function githubRequest(method, repoPath, body=null) {
  const token = process.env.GITHUB_EXERCISES_TOKEN || '';
  if (!token) throw new Error('No GitHub token configured — add GITHUB_EXERCISES_TOKEN to docker-compose.yml');
  const res = await fetch(`https://api.github.com/repos/${repoPath}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'forge-workout',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `GitHub API error ${res.status}`);
  return data;
}

app.post('/api/exercises/repo/pull', async (req, res) => {
  const repo  = process.env.GITHUB_EXERCISES_REPO || '';
  const token = process.env.GITHUB_EXERCISES_TOKEN || '';
  if (!repo) return res.status(400).json({ error:'GITHUB_EXERCISES_REPO not set in docker-compose.yml' });
  try {
    let exercises;
    if (token) {
      const data    = await githubRequest('GET', `${repo}/contents/exercises.json`);
      const decoded = Buffer.from(data.content, 'base64').toString('utf8');
      const parsed  = JSON.parse(decoded);
      exercises = parsed.exercises || parsed;
    } else {
      const r  = await fetch(`https://raw.githubusercontent.com/${repo}/main/exercises.json`);
      const parsed = await r.json();
      exercises = parsed.exercises || parsed;
    }
    res.json({ exercises, count: exercises.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/exercises/repo/push', async (req, res) => {
  const repo = process.env.GITHUB_EXERCISES_REPO || '';
  if (!repo) return res.status(400).json({ error:'GITHUB_EXERCISES_REPO not set in docker-compose.yml' });
  try {
    const exercises = db.prepare('SELECT * FROM exercises ORDER BY name ASC').all().map(e => ({
      ...e,
      primary_muscles:   JSON.parse(e.primary_muscles),
      secondary_muscles: JSON.parse(e.secondary_muscles),
      equipment: db.prepare(`SELECT eq.name FROM equipment eq JOIN exercise_equipment ee ON ee.equipment_id=eq.id WHERE ee.exercise_id=?`).all(e.id).map(r => r.name),
    }));
    const exportData = { exported_at:new Date().toISOString(), version:'1.0', count:exercises.length, exercises };
    const content    = Buffer.from(JSON.stringify(exportData, null, 2)).toString('base64');
    let sha;
    try { const cur = await githubRequest('GET', `${repo}/contents/exercises.json`); sha = cur.sha; } catch(e) {}
    await githubRequest('PUT', `${repo}/contents/exercises.json`, {
      message: `Sync exercises from Forge — ${new Date().toISOString().split('T')[0]}`,
      content,
      ...(sha ? { sha } : {}),
    });
    res.json({ ok:true, count:exercises.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Equipment Export / Import / Repo Sync ────────────────────────────────────
app.get('/api/equipment/export', (req, res) => {
  const equipment = db.prepare('SELECT * FROM equipment ORDER BY sort_order ASC, name ASC').all();
  const data = { exported_at: new Date().toISOString(), version:'1.0', equipment };
  res.setHeader('Content-Disposition', `attachment; filename="forge_equipment_${new Date().toISOString().split('T')[0]}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(data);
});

app.post('/api/equipment/import', express.json({ limit:'2mb' }), (req, res) => {
  const { equipment=[], conflict_resolution='keep' } = req.body;
  const results = { added:0, kept:0, overwritten:0 };
  equipment.forEach(eq => {
    const existing = db.prepare('SELECT * FROM equipment WHERE name=?').get(eq.name);
    if (!existing) {
      const count = db.prepare('SELECT COUNT(*) as c FROM equipment').get().c;
      db.prepare('INSERT INTO equipment (name,description,sort_order) VALUES (?,?,?)').run(eq.name, eq.description||'', count+1);
      results.added++;
    } else if (conflict_resolution === 'overwrite') {
      db.prepare('UPDATE equipment SET description=? WHERE name=?').run(eq.description||'', eq.name);
      results.overwritten++;
    } else {
      results.kept++;
    }
  });
  res.json(results);
});

app.post('/api/equipment/check-conflicts', express.json({ limit:'2mb' }), (req, res) => {
  const { equipment=[] } = req.body;
  const conflicts = [], newItems = [];
  equipment.forEach(eq => {
    const existing = db.prepare('SELECT * FROM equipment WHERE name=?').get(eq.name);
    if (!existing) {
      newItems.push(eq.name);
    } else if (existing.description !== (eq.description||'')) {
      conflicts.push({
        name: eq.name,
        yours:    existing.description || '(no description)',
        imported: eq.description       || '(no description)',
      });
    }
  });
  res.json({ conflicts, new_count: newItems.length });
});

app.post('/api/equipment/repo/pull', async (req, res) => {
  const repo  = process.env.GITHUB_EXERCISES_REPO || '';
  const token = process.env.GITHUB_EXERCISES_TOKEN || '';
  if (!repo) return res.status(400).json({ error:'GITHUB_EXERCISES_REPO not configured' });
  try {
    let equipment;
    if (token) {
      const data    = await githubRequest('GET', `${repo}/contents/equipment.json`);
      const decoded = Buffer.from(data.content, 'base64').toString('utf8');
      const parsed  = JSON.parse(decoded);
      equipment = parsed.equipment || parsed;
    } else {
      const r      = await fetch(`https://raw.githubusercontent.com/${repo}/main/equipment.json`);
      const parsed = await r.json();
      equipment = parsed.equipment || parsed;
    }
    res.json({ equipment, count: equipment.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/equipment/repo/push', async (req, res) => {
  const repo = process.env.GITHUB_EXERCISES_REPO || '';
  if (!repo) return res.status(400).json({ error:'GITHUB_EXERCISES_REPO not configured' });
  try {
    const equipment  = db.prepare('SELECT * FROM equipment ORDER BY sort_order ASC, name ASC').all();
    const exportData = { exported_at: new Date().toISOString(), version:'1.0', count: equipment.length, equipment };
    const content    = Buffer.from(JSON.stringify(exportData, null, 2)).toString('base64');
    let sha;
    try { const cur = await githubRequest('GET', `${repo}/contents/equipment.json`); sha = cur.sha; } catch(e) {}
    await githubRequest('PUT', `${repo}/contents/equipment.json`, {
      message: `Sync equipment from Forge — ${new Date().toISOString().split('T')[0]}`,
      content,
      ...(sha ? { sha } : {}),
    });
    res.json({ ok:true, count: equipment.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Backup System ──────────────────────────────────────────────────────────────

function buildUserDataJson() {
  return {
    exported_at: new Date().toISOString(),
    version: '1.0',
    custom_exercises: db.prepare('SELECT * FROM exercises WHERE custom=1').all().map(e => ({
      ...e, primary_muscles: JSON.parse(e.primary_muscles), secondary_muscles: JSON.parse(e.secondary_muscles),
    })),
    equipment: db.prepare('SELECT * FROM equipment').all(),
    exercise_equipment: db.prepare('SELECT ee.* FROM exercise_equipment ee JOIN exercises e ON e.id=ee.exercise_id WHERE e.custom=1').all(),
    workout_days: db.prepare('SELECT * FROM workout_days').all().map(day => ({
      ...day,
      entries: db.prepare('SELECT we.* FROM workout_entries we WHERE we.day_id=? ORDER BY we.sort_order ASC').all(day.id),
    })),
    workout_sessions: db.prepare('SELECT * FROM workout_sessions').all().map(s => ({
      ...s,
      exercises: db.prepare('SELECT se.* FROM session_exercises se WHERE se.session_id=?').all(s.id),
    })),
    workout_logs: db.prepare('SELECT * FROM workout_logs').all(),
    exercise_maxes: db.prepare('SELECT * FROM exercise_maxes').all(),
    body_weight_logs: db.prepare('SELECT * FROM body_weight_logs').all(),
  };
}

async function createBackup() {
  const dateStr = new Date().toISOString().split('T')[0];
  const backupPath = path.join(backupsDir, `forge_backup_${dateStr}.zip`);
  return new Promise((resolve, reject) => {
    const output  = fs.createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => { pruneBackups('forge_backup_'); resolve(backupPath); });
    archive.on('error', reject);
    archive.pipe(output);
    const dbPath = path.join(dataDir, 'workout.db');
    if (fs.existsSync(dbPath)) archive.file(dbPath, { name: 'forge_database.db' });
    archive.append(JSON.stringify(buildUserDataJson(), null, 2), { name: 'forge_data.json' });
    archive.finalize();
  });
}

async function createImagesBackup() {
  const dateStr = new Date().toISOString().split('T')[0];
  const backupPath = path.join(backupsDir, `forge_images_${dateStr}.zip`);
  return new Promise((resolve, reject) => {
    const output  = fs.createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', () => { pruneBackups('forge_images_'); resolve(backupPath); });
    archive.on('error', reject);
    archive.pipe(output);
    if (fs.existsSync(uploadsDir)) archive.directory(uploadsDir, 'uploads');
    archive.finalize();
  });
}

function pruneBackups(prefix) {
  try {
    const retain = parseInt(getSetting('backup_retain_weeks', '4'));
    const files  = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith(prefix) && f.endsWith('.zip'))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime }))
      .sort((a, b) => b.time - a.time);
    files.slice(retain).forEach(f => {
      fs.unlinkSync(path.join(backupsDir, f.name));
      console.log(`Pruned old backup: ${f.name}`);
    });
  } catch(e) { console.error('Prune error:', e); }
}

// Backup Now — server side only, no download
app.post('/api/backup/now', async (req, res) => {
  try {
    const [dataPath, imagesPath] = await Promise.all([createBackup(), createImagesBackup()]);
    res.json({ ok:true, data: path.basename(dataPath), images: path.basename(imagesPath) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DB restore — upload .db file, swap it out
const dbUpload = multer({ storage: multer.diskStorage({
  destination: (req, file, cb) => cb(null, backupsDir),
  filename:    (req, file, cb) => cb(null, `restore_upload_${Date.now()}.db`),
}) });

app.post('/api/backup/restore-db', dbUpload.single('database'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const uploadedPath = req.file.path;
  const dbPath = path.join(dataDir, 'workout.db');
  const backupPath = path.join(backupsDir, `pre_restore_${Date.now()}.db`);
  try {
    // Back up current DB first
    fs.copyFileSync(dbPath, backupPath);
    // Close DB, swap file, signal restart needed
    db.close();
    fs.copyFileSync(uploadedPath, dbPath);
    fs.unlinkSync(uploadedPath);
    res.json({ ok:true, message:'Database restored. Run "docker compose restart" to complete.' });
    // Give response time to send then exit — Docker will restart the container
    setTimeout(() => process.exit(0), 500);
  } catch(e) {
    // Try to restore backup if swap failed
    try { if (fs.existsSync(backupPath)) fs.copyFileSync(backupPath, dbPath); } catch(e2) {}
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/backup/status', (req, res) => {
  try {
    const dataBackups  = fs.readdirSync(backupsDir).filter(f => f.startsWith('forge_backup_') && f.endsWith('.zip')).sort().reverse();
    const imageBackups = fs.readdirSync(backupsDir).filter(f => f.startsWith('forge_images_') && f.endsWith('.zip')).sort().reverse();
    res.json({
      last_data_backup:   dataBackups[0]  ? fs.statSync(path.join(backupsDir, dataBackups[0])).mtime  : null,
      last_images_backup: imageBackups[0] ? fs.statSync(path.join(backupsDir, imageBackups[0])).mtime : null,
      data_backups:   dataBackups,
      image_backups:  imageBackups,
      schedule:       getSetting('backup_schedule', 'weekly'),
      backup_time:    getSetting('backup_time', '00:00'),
      retain_weeks:   getSetting('backup_retain_weeks', '4'),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/backup/download-data', async (req, res) => {
  try {
    const p = await createBackup();
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(p)}"`);
    res.setHeader('Content-Type', 'application/zip');
    fs.createReadStream(p).pipe(res);
  } catch(e) { res.status(500).json({ error: 'Backup failed: ' + e.message }); }
});

app.get('/api/backup/download-images', async (req, res) => {
  try {
    const p = await createImagesBackup();
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(p)}"`);
    res.setHeader('Content-Type', 'application/zip');
    fs.createReadStream(p).pipe(res);
  } catch(e) { res.status(500).json({ error: 'Images backup failed: ' + e.message }); }
});

app.post('/api/backup/restore-json', express.json({ limit: '50mb' }), (req, res) => {
  const data = req.body;
  if (!data || !data.version) return res.status(400).json({ error: 'Invalid backup file' });
  try {
    const restore = db.transaction(() => {
      if (data.custom_exercises?.length) {
        const ins = db.prepare('INSERT OR REPLACE INTO exercises (id,name,primary_muscles,secondary_muscles,custom,exercise_type,description,image_path) VALUES (?,?,?,?,1,?,?,?)');
        data.custom_exercises.forEach(e => ins.run(e.id, e.name, JSON.stringify(e.primary_muscles), JSON.stringify(e.secondary_muscles), e.exercise_type||'strength', e.description||'', e.image_path||''));
      }
      if (data.equipment?.length) {
        const ins = db.prepare('INSERT OR REPLACE INTO equipment (id,name,description,sort_order) VALUES (?,?,?,?)');
        data.equipment.forEach(e => ins.run(e.id, e.name, e.description||'', e.sort_order||0));
      }
      if (data.exercise_equipment?.length) {
        const ins = db.prepare('INSERT OR IGNORE INTO exercise_equipment (exercise_id,equipment_id) VALUES (?,?)');
        data.exercise_equipment.forEach(e => ins.run(e.exercise_id, e.equipment_id));
      }
      if (data.workout_days?.length) {
        const insD = db.prepare('INSERT OR REPLACE INTO workout_days (id,name,description,sort_order,created_at) VALUES (?,?,?,?,?)');
        const insE = db.prepare('INSERT OR REPLACE INTO workout_entries (id,day_id,exercise_id,exercise_type,weight,sets,reps,distance,distance_unit,duration_minutes,target_speed,weight_increase_type,weight_increase_value,last_set_bump,last_set_bump_type,last_set_bump_value,sort_order,training_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        data.workout_days.forEach(day => {
          insD.run(day.id, day.name, day.description||'', day.sort_order||0, day.created_at);
          (day.entries||[]).forEach(e => insE.run(e.id,e.day_id,e.exercise_id,e.exercise_type||'strength',e.weight||0,e.sets||3,e.reps||10,e.distance||0,e.distance_unit||'miles',e.duration_minutes||0,e.target_speed||0,e.weight_increase_type||'flat',e.weight_increase_value||2.5,e.last_set_bump||0,e.last_set_bump_type||'flat',e.last_set_bump_value||10,e.sort_order||0,e.training_type||''));
        });
      }
      if (data.workout_sessions?.length) {
        const insS = db.prepare('INSERT OR REPLACE INTO workout_sessions (id,day_id,session_number,started_at,completed_at,duration_seconds,notes) VALUES (?,?,?,?,?,?,?)');
        data.workout_sessions.forEach(s => insS.run(s.id,s.day_id,s.session_number,s.started_at,s.completed_at,s.duration_seconds||0,s.notes||''));
      }
      if (data.workout_logs?.length) {
        const ins = db.prepare('INSERT OR REPLACE INTO workout_logs (id,day_id,entry_id,exercise_id,exercise_type,weight,sets,reps,distance,distance_unit,duration_minutes,target_speed,completed_at,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        data.workout_logs.forEach(l => ins.run(l.id,l.day_id,l.entry_id,l.exercise_id,l.exercise_type||'strength',l.weight||0,l.sets||0,l.reps||0,l.distance||0,l.distance_unit||'miles',l.duration_minutes||0,l.target_speed||0,l.completed_at,l.notes||''));
      }
      if (data.exercise_maxes?.length) {
        const ins = db.prepare('INSERT OR REPLACE INTO exercise_maxes (exercise_id,max_weight) VALUES (?,?)');
        data.exercise_maxes.forEach(m => ins.run(m.exercise_id, m.max_weight||0));
      }
      if (data.body_weight_logs?.length) {
        const ins = db.prepare('INSERT OR REPLACE INTO body_weight_logs (id,weight,unit,logged_at,notes) VALUES (?,?,?,?,?)');
        data.body_weight_logs.forEach(l => ins.run(l.id,l.weight,l.unit||'lbs',l.logged_at,l.notes||''));
      }
    });
    restore();
    syncAllLinkedEntries();
    res.json({ ok:true, message:'Data restored successfully' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Dynamic auto-backup scheduler
function scheduleBackup() {
  const schedule = getSetting('backup_schedule', 'weekly');
  const time     = getSetting('backup_time', '00:00');
  const [hour, minute] = time.split(':').map(Number);
  const h = isNaN(hour)   ? 0 : hour;
  const m = isNaN(minute) ? 0 : minute;

  let cronExpr;
  if      (schedule === 'daily')   cronExpr = `${m} ${h} * * *`;
  else if (schedule === 'monthly') cronExpr = `${m} ${h} 1 * *`;
  else                             cronExpr = `${m} ${h} * * 0`; // weekly = Sunday

  console.log(`Backup scheduled: ${schedule} at ${h}:${String(m).padStart(2,'0')} (cron: ${cronExpr})`);
  cron.schedule(cronExpr, async () => {
    console.log('Running auto-backup...');
    try { await createBackup(); await createImagesBackup(); console.log('Auto-backup complete'); }
    catch(e) { console.error('Auto-backup failed:', e); }
  });
}
scheduleBackup();

// ── Routines ─────────────────────────────────────────────────────────────────

app.get('/api/routines', (req, res) => {
  const routines = db.prepare('SELECT * FROM routines ORDER BY sort_order ASC, created_at ASC').all();
  const getDays  = db.prepare(`
    SELECT rd.id as routine_day_id, rd.sort_order, wd.*
    FROM routine_days rd JOIN workout_days wd ON wd.id=rd.day_id
    WHERE rd.routine_id=? ORDER BY rd.sort_order ASC
  `);
  const getEntries = db.prepare(`
    SELECT we.*, e.name as exercise_name, e.primary_muscles, e.secondary_muscles,
           e.exercise_type as ex_type, e.image_path, e.description as exercise_description
    FROM workout_entries we JOIN exercises e ON e.id=we.exercise_id
    WHERE we.day_id=? ORDER BY we.sort_order ASC
  `);
  const getInProgress = db.prepare(`
    SELECT id, session_number FROM routine_sessions
    WHERE routine_id=? AND completed_at IS NULL
    ORDER BY id DESC LIMIT 1
  `);

  res.json(routines.map(r => ({
    ...r,
    in_progress_session: getInProgress.get(r.id) || null,
    days: getDays.all(r.id).map(d => ({
      ...d,
      entries: getEntries.all(d.id).map(e => ({
        ...e,
        primary_muscles:   JSON.parse(e.primary_muscles||'[]'),
        secondary_muscles: JSON.parse(e.secondary_muscles||'[]'),
        cardio_stages:     JSON.parse(e.cardio_stages||'[]'),
      }))
    }))
  })));
});

app.post('/api/routines', (req, res) => {
  const { name, description='' } = req.body;
  if (!name) return res.status(400).json({ error:'Name required' });
  const count = db.prepare('SELECT COUNT(*) as c FROM routines').get().c;
  const r = db.prepare('INSERT INTO routines (name,description,sort_order) VALUES (?,?,?)').run(name, description, count);
  res.json(db.prepare('SELECT * FROM routines WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/routines/:id', (req, res) => {
  const { name, description='' } = req.body;
  db.prepare('UPDATE routines SET name=?,description=? WHERE id=?').run(name, description, req.params.id);
  res.json(db.prepare('SELECT * FROM routines WHERE id=?').get(req.params.id));
});

app.delete('/api/routines/:id', (req, res) => {
  const id = req.params.id;
  // Get all routine_session ids first
  const routineSessions = db.prepare('SELECT id FROM routine_sessions WHERE routine_id=?').all(id);
  const routine = db.prepare('SELECT name FROM routines WHERE id=?').get(id);
  // Delete workout_sessions that were part of these routine sessions
  console.log(`Deleting routine ${id}: ${routineSessions.length} routine sessions, routine name: ${routine?.name}`);
  routineSessions.forEach(rs => {
    // Find by routine_session_id (new sessions) OR by notes match (old sessions)
    const wSessions = db.prepare(`
      SELECT id, notes, routine_session_id FROM workout_sessions
      WHERE routine_session_id=?
      OR (notes LIKE ? AND routine_session_id IS NULL)
    `).all(rs.id, `Part of routine: ${routine?.name || '%'}`);
    console.log(`  Routine session ${rs.id}: found ${wSessions.length} workout sessions`);
    wSessions.forEach(ws => {
      console.log(`    Deleting workout session ${ws.id} (notes: ${ws.notes})`);
      db.prepare('DELETE FROM session_exercises WHERE session_id=?').run(ws.id);
      db.prepare('DELETE FROM workout_sessions WHERE id=?').run(ws.id);
    });
  });
  db.prepare('DELETE FROM routine_sessions WHERE routine_id=?').run(id);
  db.prepare('DELETE FROM routine_days WHERE routine_id=?').run(id);
  db.prepare('DELETE FROM routines WHERE id=?').run(id);
  res.json({ ok:true });
});

// Add workout day to routine
app.post('/api/routines/:id/days', (req, res) => {
  const { day_id } = req.body;
  const count = db.prepare('SELECT COUNT(*) as c FROM routine_days WHERE routine_id=?').get(req.params.id).c;
  const r = db.prepare('INSERT INTO routine_days (routine_id,day_id,sort_order) VALUES (?,?,?)').run(req.params.id, day_id, count);
  res.json(db.prepare('SELECT * FROM routine_days WHERE id=?').get(r.lastInsertRowid));
});

app.delete('/api/routines/:routineId/days/:routineDayId', (req, res) => {
  db.prepare('DELETE FROM routine_days WHERE id=? AND routine_id=?').run(req.params.routineDayId, req.params.routineId);
  res.json({ ok:true });
});

app.put('/api/routines/:id/days/reorder', (req, res) => {
  const { ids } = req.body;
  const upd = db.prepare('UPDATE routine_days SET sort_order=? WHERE id=?');
  ids.forEach((id, idx) => upd.run(idx, id));
  res.json({ ok:true });
});

// Start a routine session
app.post('/api/routines/:id/sessions', (req, res) => {
  const routineId = req.params.id;
  const lastSess  = db.prepare('SELECT MAX(session_number) as max FROM routine_sessions WHERE routine_id=?').get(routineId);
  const sessNum   = (lastSess.max || 0) + 1;
  const r         = db.prepare('INSERT INTO routine_sessions (routine_id,session_number) VALUES (?,?)').run(routineId, sessNum);
  const routine   = db.prepare('SELECT * FROM routines WHERE id=?').get(routineId);
  const days      = db.prepare('SELECT rd.*, wd.name as day_name FROM routine_days rd JOIN workout_days wd ON wd.id=rd.day_id WHERE rd.routine_id=? ORDER BY rd.sort_order ASC').all(routineId);

  // Create individual sessions for each day in the routine
  const daySessions = [];
  days.forEach(day => {
    const dayLastSess = db.prepare('SELECT MAX(session_number) as max FROM workout_sessions WHERE day_id=?').get(day.day_id);
    const dayNum      = (dayLastSess.max || 0) + 1;
    const ds          = db.prepare('INSERT INTO workout_sessions (day_id,session_number,notes,routine_session_id) VALUES (?,?,?,?)').run(day.day_id, dayNum, `Part of routine: ${routine.name}`, r.lastInsertRowid);
    const sessionId   = ds.lastInsertRowid;
    // Copy entries into session exercises
    const entries = db.prepare(`SELECT we.*,e.name as exercise_name,e.primary_muscles,e.secondary_muscles,e.image_path,e.description as exercise_description
      FROM workout_entries we JOIN exercises e ON e.id=we.exercise_id WHERE we.day_id=? ORDER BY we.sort_order ASC`).all(day.day_id);
    const insEx = db.prepare(`INSERT INTO session_exercises (session_id,exercise_id,entry_id,weight,sets,reps,distance,distance_unit,duration_minutes,target_speed,last_set_bump,last_set_bump_type,last_set_bump_value,completed,temporary)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,0)`);
    entries.forEach(e => insEx.run(sessionId,e.exercise_id,e.id,e.weight,e.sets,e.reps,e.distance,e.distance_unit||'miles',e.duration_minutes||0,e.target_speed||0,e.last_set_bump||0,e.last_set_bump_type||'flat',e.last_set_bump_value||10));
    const exRows = db.prepare(`SELECT se.*,
      e.name as exercise_name, e.primary_muscles, e.secondary_muscles,
      e.image_path, e.description as exercise_description,
      e.exercise_type as ex_type,
      we.cardio_mode, we.cardio_stages
      FROM session_exercises se
      JOIN exercises e ON e.id=se.exercise_id
      LEFT JOIN workout_entries we ON we.id=se.entry_id
      WHERE se.session_id=? ORDER BY se.id ASC`).all(sessionId);
    daySessions.push({
      session_id: sessionId, day_id: day.day_id, day_name: day.day_name,
      routine_day_id: day.id, sort_order: day.sort_order,
      exercises: exRows.map(e => ({
        ...e,
        exercise_type:     e.ex_type || 'strength',
        primary_muscles:   JSON.parse(e.primary_muscles||'[]'),
        secondary_muscles: JSON.parse(e.secondary_muscles||'[]'),
        cardio_stages:     JSON.parse(e.cardio_stages||'[]'),
      }))
    });
  });

  res.json({ routine_session_id: r.lastInsertRowid, session_number: sessNum, routine_name: routine.name, day_sessions: daySessions });
});

// Complete a routine session
app.put('/api/routine-sessions/:id/complete', (req, res) => {
  const { duration_seconds=0, day_overloads=[] } = req.body;
  db.prepare('UPDATE routine_sessions SET completed_at=CURRENT_TIMESTAMP,duration_seconds=? WHERE id=?').run(duration_seconds, req.params.id);

  // Complete each day session and apply overload if requested
  day_overloads.forEach(({ session_id, apply_overload }) => {
    db.prepare('UPDATE workout_sessions SET completed_at=CURRENT_TIMESTAMP,duration_seconds=? WHERE id=?').run(duration_seconds, session_id);
    const exercises = db.prepare('SELECT * FROM session_exercises WHERE session_id=?').all(session_id);
    exercises.filter(e => e.completed).forEach(e => {
      db.prepare(`INSERT INTO workout_logs (day_id,entry_id,exercise_id,exercise_type,weight,sets,reps,distance,distance_unit,duration_minutes,target_speed) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(db.prepare('SELECT day_id FROM workout_sessions WHERE id=?').get(session_id)?.day_id, e.entry_id, e.exercise_id, 'strength', e.weight, e.sets, e.reps, e.distance||0, e.distance_unit||'miles', e.duration_minutes||0, e.target_speed||0);
    });
    if (apply_overload) applyProgressiveOverload(exercises);
  });
  res.json({ ok:true });
});

// Save routine progress
app.put('/api/routine-sessions/:id/progress', express.json(), (req, res) => {
  const { elapsed_seconds=0, cardio_timers={} } = req.body;
  const progress = JSON.stringify({ elapsed_seconds, cardio_timers, saved_at: new Date().toISOString() });
  db.prepare('UPDATE routine_sessions SET progress_data=?, duration_seconds=? WHERE id=?')
    .run(progress, elapsed_seconds, req.params.id);
  res.json({ ok:true });
});

// Get in-progress routine session (for resume)
app.get('/api/routine-sessions/:id/resume', (req, res) => {
  const routineSession = db.prepare('SELECT * FROM routine_sessions WHERE id=?').get(req.params.id);
  if (!routineSession) return res.status(404).json({ error:'Session not found' });

  const routine = db.prepare('SELECT * FROM routines WHERE id=?').get(routineSession.routine_id);
  // Get day sessions linked to THIS specific routine session
  // Try routine_session_id first (new sessions), fall back to notes+time matching for old sessions
  let daySessions = db.prepare(`
    SELECT ws.*, wd.name as day_name
    FROM workout_sessions ws
    JOIN workout_days wd ON wd.id=ws.day_id
    WHERE ws.routine_session_id=?
    ORDER BY ws.id ASC
  `).all(routineSession.id);

  // Fallback for old sessions: match by time window (within 1 hour of routine session start)
  if (daySessions.length === 0) {
    daySessions = db.prepare(`
      SELECT ws.*, wd.name as day_name
      FROM workout_sessions ws
      JOIN workout_days wd ON wd.id=ws.day_id
      WHERE ws.notes=?
      AND ws.day_id IN (SELECT day_id FROM routine_days WHERE routine_id=?)
      AND ws.started_at >= datetime(?, '-1 hour')
      AND ws.started_at <= datetime(?, '+1 hour')
      AND ws.completed_at IS NULL
      ORDER BY ws.id ASC
    `).all(`Part of routine: ${routine.name}`, routineSession.routine_id, routineSession.started_at, routineSession.started_at);
  }

  const result = {
    routine_session_id: routineSession.id,
    session_number: routineSession.session_number,
    routine_name: routine.name,
    day_sessions: daySessions.map(ds => {
      const exRows = db.prepare(`
        SELECT se.*, e.name as exercise_name, e.primary_muscles, e.secondary_muscles,
               e.image_path, e.description as exercise_description, e.exercise_type as ex_type,
               we.cardio_mode, we.cardio_stages
        FROM session_exercises se
        JOIN exercises e ON e.id=se.exercise_id
        LEFT JOIN workout_entries we ON we.id=se.entry_id
        WHERE se.session_id=? ORDER BY se.id ASC
      `).all(ds.id);
      return {
        session_id: ds.id,
        day_id: ds.day_id,
        day_name: ds.day_name,
        exercises: exRows.map(e => ({
          ...e,
          exercise_type:     e.ex_type || 'strength',
          primary_muscles:   JSON.parse(e.primary_muscles||'[]'),
          secondary_muscles: JSON.parse(e.secondary_muscles||'[]'),
          cardio_stages:     JSON.parse(e.cardio_stages||'[]'),
        }))
      };
    })
  };
  res.json(result);
});

app.delete('/api/routine-sessions/:id', (req, res) => {
  const id = req.params.id;
  // Also delete the associated workout_sessions for this routine session
  db.prepare('UPDATE workout_sessions SET routine_session_id=NULL WHERE routine_session_id=?').run(id);
  db.prepare('DELETE FROM routine_sessions WHERE id=?').run(id);
  res.json({ ok:true });
});

app.get('/api/routines/:id/sessions', (req, res) => {
  const sessions = db.prepare('SELECT * FROM routine_sessions WHERE routine_id=? ORDER BY session_number ASC').all(req.params.id);
  res.json(sessions.map(s => ({
    ...s,
    progress_data: (() => { try { return JSON.parse(s.progress_data||'{}'); } catch(e) { return {}; } })()
  })));
});

// Update exercise 3D model
app.put('/api/exercises/:id/model', express.json(), (req, res) => {
  const { model_url='' } = req.body;
  db.prepare('UPDATE exercises SET model_url=? WHERE id=?').run(model_url, req.params.id);
  res.json({ ok:true });
});

// ── Serve animation files ────────────────────────────────────────────────────
app.use('/animations', express.static(animationsDir));

// ── Serve GLB 3D models ───────────────────────────────────────────────────────
app.get('/api/models', (req, res) => {
  try {
    const files = fs.existsSync(animationsDir)
      ? fs.readdirSync(animationsDir)
          .filter(f => f.endsWith('.glb') || f.endsWith('.fbx'))
          .map(f => ({ name: f, url: `/animations/${f}` }))
      : [];
    res.json(files);
  } catch(e) { res.json([]); }
});

// ── Static / Frontend ─────────────────────────────────────────────────────────
app.use(express.static(frontendBuild));
app.get('*', (req, res) => res.sendFile(path.join(frontendBuild, 'index.html')));

app.listen(PORT, () => console.log(`Forge API running on :${PORT}`));
