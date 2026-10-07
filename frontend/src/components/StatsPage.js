import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DEFAULT_PCTS, deriveWeights, maxFrom, pctFor } from '../trainingWeights';

const WEIGHT_FIELDS = [
  { key:'endurance', label:'Endurance', color:'#4aa3ff' },
  { key:'strength',  label:'Strength',  color:'#ff8c5a' },
  { key:'max',       label:'Max',       color:'var(--accent)' },
];

export default function StatsPage({ api }) {
  const [exercises, setExercises] = useState([]);
  const [pcts,      setPcts]      = useState(DEFAULT_PCTS);
  const [search,    setSearch]    = useState('');
  const [expanded,  setExpanded]  = useState(null);
  const [loading,   setLoading]   = useState(true);

  const load = () => {
    Promise.all([api.get('/stats/exercises'), api.get('/training-weights')]).then(([ex, tw]) => {
      setExercises(ex);
      setPcts({ endurance_pct: tw.endurance_pct, strength_pct: tw.strength_pct });
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return exercises;
    return exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
  }, [exercises, search]);

  return (
    <div>
      <div className="flex-between mb-16">
        <h1 className="section-title">My <span>Stats</span></h1>
      </div>

      <div style={{ marginBottom:20 }}>
        <input className="form-input" style={{ maxWidth:360 }}
          placeholder="Search exercises…" value={search} onChange={e => setSearch(e.target.value)} />
        {search && <span className="text-muted text-sm" style={{ marginLeft:12 }}>{filtered.length} results</span>}
      </div>

      {loading && <div className="text-muted text-sm">Loading…</div>}

      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
        {filtered.map((ex, i) => {
          const isExpanded = expanded === ex.id;
          const isCardio   = ex.exercise_type === 'cardio';
          const linked     = (ex.linked_entries?.strength || 0) + (ex.linked_entries?.endurance || 0);

          return (
            <div key={ex.id}>
              {/* Row */}
              <div style={{
                display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                background: isExpanded ? 'var(--bg3)' : i%2===0 ? 'var(--bg2)' : 'var(--bg)',
                border:'1px solid var(--border)',
                borderTop: i===0 ? '1px solid var(--border)' : 'none',
                cursor:'pointer', transition:'background 0.12s',
              }} onClick={() => setExpanded(isExpanded ? null : ex.id)}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:16,
                    textTransform:'uppercase', letterSpacing:0.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {ex.name}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                    {isCardio ? 'Cardio' : linked ? `Linked to ${linked} workout${linked!==1?'s':''}` : 'Not linked to any workouts'}
                  </div>
                </div>
                {!isCardio && (
                  <div className="weight-cols">
                    {WEIGHT_FIELDS.map(f => (
                      <div key={f.key} className="weight-col">
                        <div className="weight-col-label">{f.label}</div>
                        <div className="weight-col-value" style={{ color: ex[`${f.key}_weight`] ? f.color : 'var(--text3)' }}>
                          {ex[`${f.key}_weight`] || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <span style={{ color:'var(--text3)', fontSize:14, flexShrink:0 }}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding:'16px 20px', background:'var(--bg3)', border:'1px solid var(--border)',
                  borderTop:'none', borderLeft:'3px solid var(--accent)' }}>
                  {!isCardio && <TrainingWeightsEditor ex={ex} pcts={pcts} api={api} onSaved={load} />}

                  {/* Progress graph */}
                  <ExerciseGraph exId={ex.id} api={api} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Three linked inputs: typing in any one recalculates the other two from the implied Max
function TrainingWeightsEditor({ ex, pcts, api, onSaved }) {
  const [draft,  setDraft]  = useState(null); // { field, value } — the box being typed in
  const [saving, setSaving] = useState(false);

  const draftNum = draft ? parseFloat(draft.value) : NaN;
  const preview  = draftNum > 0 ? deriveWeights(maxFrom(draft.field, draftNum, pcts), pcts) : null;
  const shown = field => {
    if (draft?.field === field) return draft.value;
    if (draft) return preview ? preview[field] : '';
    return ex[`${field}_weight`] || '';
  };
  const canSave = draft && draftNum >= 0;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    await api.put(`/stats/exercises/${ex.id}/max`, { training_type: draft.field, weight: draftNum });
    setSaving(false);
    setDraft(null);
    onSaved();
  };

  const clear = async () => {
    if (!window.confirm(`Clear the saved weights for ${ex.name}?\n\nLinked workouts keep their current weight.`)) return;
    await api.put(`/stats/exercises/${ex.id}/max`, { training_type: 'max', weight: 0 });
    onSaved();
  };

  const { strength=0, endurance=0 } = ex.linked_entries || {};
  const linkedText = [strength && `${strength} Strength`, endurance && `${endurance} Endurance`].filter(Boolean).join(', ');

  return (
    <div className="card-sm" style={{ marginBottom:16 }}>
      <div style={{ fontSize:10, color:'var(--text3)', letterSpacing:1.5, textTransform:'uppercase', marginBottom:10 }}>Training Weights (lbs)</div>
      <div className="weight-editor">
        {WEIGHT_FIELDS.map(f => (
          <div key={f.key} className="form-group" style={{ margin:0 }}>
            <label className="form-label" style={{ color:f.color }}>
              {f.label} <span style={{ color:'var(--text3)', fontWeight:400 }}>{pctFor(f.key, pcts)}%</span>
            </label>
            <input className="form-input" type="number" min="0" step="0.25" inputMode="decimal"
              aria-label={`${f.label} weight`} placeholder="—" value={shown(f.key)}
              onChange={e => setDraft({ field:f.key, value:e.target.value })}
              onKeyDown={e => { if (e.key==='Enter') save(); if (e.key==='Escape') setDraft(null); }} />
          </div>
        ))}
      </div>
      <div style={{ fontSize:11, color:'var(--text3)', marginTop:8, lineHeight:1.6 }}>
        Enter any one — the other two are calculated.
        {linkedText
          ? <> Linked workouts ({linkedText}) update automatically.</>
          : <> Pick Strength or Endurance Training on a workout exercise to link it here.</>}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:10 }}>
        {draft ? (<>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={!canSave || saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Cancel</button>
        </>) : ex.max_weight > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={clear}>Clear</button>
        )}
      </div>
    </div>
  );
}

function ExerciseGraph({ exId, api }) {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api.get(`/stats/exercises/${exId}/history`).then(setHistory);
  }, [exId]);

  if (history === null) return <div style={{ color:'var(--text3)', fontSize:12 }}>Loading history…</div>;
  if (history.length === 0) return <div style={{ color:'var(--text3)', fontSize:12 }}>No workout history yet for this exercise.</div>;
  if (history.length === 1) return (
    <div style={{ fontSize:12, color:'var(--text3)' }}>
      1 session logged — {history[0].weight} lbs. Complete more sessions to see a graph.
    </div>
  );

  const data = history.map((h, i) => ({
    session: `S${i+1}`,
    weight: h.weight,
    date: new Date(h.completed_at).toLocaleDateString('en-US', { month:'short', day:'numeric' }),
  }));

  return (
    <div>
      <div style={{ fontSize:10, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>
        Weight Progress ({history.length} sessions)
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top:5, right:10, left:0, bottom:5 }}>
          <CartesianGrid stroke="#222230" strokeDasharray="4 4" />
          <XAxis dataKey="session" tick={{ fontSize:10, fill:'#606070' }} />
          <YAxis tick={{ fontSize:10, fill:'#606070' }} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background:'#1a1a1f', border:'1px solid #2a2a35', borderRadius:6, fontSize:11 }}
            labelStyle={{ color:'#a0a0b0' }}
            formatter={(val, name, props) => [`${val} lbs`, 'Weight']}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) return `${label} — ${payload[0].payload.date}`;
              return label;
            }}
          />
          <Line type="monotone" dataKey="weight" stroke="#e8ff00" strokeWidth={2.5}
            dot={{ fill:'#e8ff00', r:4, strokeWidth:0 }}
            activeDot={{ r:6, fill:'#fff', stroke:'#e8ff00', strokeWidth:2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
