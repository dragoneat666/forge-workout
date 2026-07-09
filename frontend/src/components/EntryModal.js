import React, { useState, useMemo, useRef } from 'react';
import BodyDiagram, { MUSCLE_GROUPS } from './BodyDiagram';

function loadSavedMuscles() {
  try {
    const s = localStorage.getItem('forge_muscle_aliases');
    if (s) { const p=JSON.parse(s); return MUSCLE_GROUPS.map(mg=>{const m=p.find(x=>x.key===mg.key);return m?{...mg,...m}:{...mg};}); }
  } catch(e) {}
  return MUSCLE_GROUPS.map(mg=>({...mg}));
}

export default function EntryModal({ title, exercises, initial, onSave, onClose }) {
  const [exerciseId,      setExerciseId]      = useState(initial?.exercise_id || '');
  const [search,          setSearch]          = useState('');
  // Strength fields
  const [weight,          setWeight]          = useState(initial?.weight ?? 0);
  const [sets,            setSets]            = useState(initial?.sets ?? 3);
  const [reps,            setReps]            = useState(initial?.reps ?? 10);
  const [increaseType,    setIncreaseType]    = useState(initial?.weight_increase_type ?? 'flat');
  const [increaseVal,     setIncreaseVal]     = useState(initial?.weight_increase_value ?? 10);
  // Cardio fields
  const [distance,        setDistance]        = useState(initial?.distance ?? '');
  const [distUnit,        setDistUnit]        = useState(initial?.distance_unit ?? 'miles');
  const [duration,        setDuration]        = useState(initial?.duration_minutes ?? '');
  const [targetSpeed,     setTargetSpeed]     = useState(initial?.target_speed ?? '');
  // Heavy last set
  const [lastSetBump,     setLastSetBump]     = useState(initial?.last_set_bump === 1 || initial?.last_set_bump === true);
  const [lastSetBumpType, setLastSetBumpType] = useState(initial?.last_set_bump_type ?? 'flat');
  const [lastSetBumpVal,  setLastSetBumpVal]  = useState(initial?.last_set_bump_value ?? 10);

  const muscleData = useMemo(() => loadSavedMuscles(), []);

  // Cardio stage builder
  const [cardioMode,   setCardioMode]   = useState(initial?.cardio_mode || 'treadmill');
  const [cardioStages, setCardioStages] = useState(() => {
    const raw = initial?.cardio_stages;
    if (!raw) return [];
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch(e) { return []; } }
    return Array.isArray(raw) ? raw : [];
  });
  const [showStages,   setShowStages]   = useState(() => {
    const raw = initial?.cardio_stages;
    if (!raw) return false;
    if (typeof raw === 'string') { try { return JSON.parse(raw).length > 0; } catch(e) { return false; } }
    return Array.isArray(raw) && raw.length > 0;
  });

  const addStage = () => setCardioStages(prev => [...prev, {
    duration_seconds: 120,
    speed:    cardioMode==='treadmill' ? 3.5 : null,
    incline:  null,
    effort:   cardioMode==='outdoor' ? 'moderate' : null,
  }]);

  const updateStage = (i, field, val) => setCardioStages(prev =>
    prev.map((s, si) => si===i ? {...s, [field]: val} : s)
  );

  const removeStage = (i) => setCardioStages(prev => prev.filter((_,si) => si!==i));

  const filteredEx = useMemo(() => {
    if (!search.trim()) return exercises;
    return exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
  }, [exercises, search]);

  const selectedEx = exercises.find(e => e.id === parseInt(exerciseId));
  const isCardio = selectedEx?.exercise_type === 'cardio';

  // When exercise changes, flip defaults
  const handleExerciseChange = (id) => {
    setExerciseId(id);
    const ex = exercises.find(e => e.id === parseInt(id));
    if (ex?.exercise_type === 'cardio') {
      setDistance(''); setDuration(''); setTargetSpeed('');
    } else {
      setWeight(initial?.weight ?? 0); setSets(initial?.sets ?? 3); setReps(initial?.reps ?? 10);
    }
  };

  const handleSave = () => {
    if (!exerciseId) return alert('Please select an exercise');
    if (isCardio) {
      if (!distance && !duration) return alert('Enter at least a distance or duration for cardio exercises');
    }
    onSave({
      exercise_id:          parseInt(exerciseId),
      exercise_type:        selectedEx?.exercise_type || 'strength',
      weight:               parseFloat(weight) || 0,
      sets:                 parseInt(sets) || 1,
      reps:                 parseInt(reps) || 1,
      distance:             parseFloat(distance) || 0,
      distance_unit:        distUnit,
      duration_minutes:     parseFloat(duration) || 0,
      target_speed:         parseFloat(targetSpeed) || 0,
      weight_increase_type: increaseType,
      weight_increase_value: parseFloat(increaseVal) || 0,
      last_set_bump: lastSetBump,
      last_set_bump_type: lastSetBumpType,
      last_set_bump_value: parseFloat(lastSetBumpVal) || 10,
      cardio_mode:   cardioMode,
      cardio_stages: showStages ? cardioStages : [],
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth:580 }} onClick={e=>e.stopPropagation()}>
        <div className="modal-title">{title}</div>

        {/* Exercise picker */}
        <div className="form-group">
          <label className="form-label">Exercise *</label>
          <input className="form-input" placeholder="Search…" value={search}
            onChange={e=>setSearch(e.target.value)} style={{ marginBottom:6 }} />

          <select className="form-select" size="5" value={exerciseId}
            onChange={e=>handleExerciseChange(e.target.value)}>
            <option value="">— select —</option>
            {filteredEx.map(ex => (
              <option key={ex.id} value={ex.id}>
                {ex.name} [{ex.exercise_type==='cardio'?'Cardio':'Strength'}]
              </option>
            ))}
          </select>
        </div>

        {/* Selected exercise preview */}
        {selectedEx && (
          <div className="card-sm" style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:16, textTransform:'uppercase' }}>{selectedEx.name}</span>
              <span className={`tag ${isCardio ? 'tag-secondary' : 'tag-primary'}`}>{isCardio ? 'Cardio' : 'Strength'}</span>
            </div>
            <div className="muscle-chips" style={{ marginTop:6 }}>
              {(selectedEx.primary_muscles||[]).map(m => {
                const mg = muscleData.find(g=>g.key===m);
                return <span key={m} className="tag tag-primary">{mg?.label||m.replace(/_/g,' ')}</span>;
              })}
              {(selectedEx.secondary_muscles||[]).map(m => {
                const mg = muscleData.find(g=>g.key===m);
                return <span key={m} className="tag tag-secondary">{mg?.label||m.replace(/_/g,' ')}</span>;
              })}
            </div>
            {!isCardio && <div style={{ marginTop:10 }}>
              <BodyDiagram primaryMuscles={selectedEx.primary_muscles||[]} secondaryMuscles={selectedEx.secondary_muscles||[]} />
            </div>}
            {selectedEx.image_path && (
              <div style={{ marginTop:10 }}>
                <img src={selectedEx.image_path} alt={selectedEx.name}
                  style={{ maxWidth:'100%', maxHeight:180, borderRadius:8, objectFit:'contain', background:'var(--bg2)', display:'block' }} />
              </div>
            )}
          </div>
        )}

        {/* ── CARDIO FIELDS ── */}
        {isCardio && (
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:14, marginBottom:14 }}>
            <div style={{ fontSize:10, letterSpacing:1.5, textTransform:'uppercase', color:'#4af', marginBottom:10, fontWeight:700 }}>Cardio Settings</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Distance</label>
                <input className="form-input" type="number" min="0" step="0.1"
                  value={distance} onChange={e=>setDistance(e.target.value)} placeholder="e.g. 3.1" />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={distUnit} onChange={e=>setDistUnit(e.target.value)}>
                  <option value="miles">Miles</option>
                  <option value="km">Kilometers</option>
                  <option value="meters">Meters</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Duration (minutes)</label>
                <input className="form-input" type="number" min="0" step="1"
                  value={duration} onChange={e=>setDuration(e.target.value)} placeholder="e.g. 30" />
              </div>
              <div className="form-group">
                <label className="form-label">Target Speed <span style={{color:'var(--text3)', fontWeight:400}}>(optional)</span></label>
                <input className="form-input" type="number" min="0" step="0.1"
                  value={targetSpeed} onChange={e=>setTargetSpeed(e.target.value)} placeholder={`e.g. 8 mph`} />
              </div>
            </div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>Distance or Duration is required; Target Speed is optional.</div>

            {/* Cardio mode + stage builder */}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:12, marginTop:10 }}>
              <div style={{ display:'flex', gap:10, marginBottom:10, alignItems:'flex-end', flexWrap:'wrap' }}>
                <div className="form-group" style={{ margin:0, flex:1, minWidth:140 }}>
                  <label className="form-label">Mode</label>
                  <select className="form-select" value={cardioMode} onChange={e=>setCardioMode(e.target.value)}>
                    <option value="treadmill">Treadmill / Machine</option>
                    <option value="outdoor">Outdoor / Open</option>
                  </select>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, paddingBottom:6 }}>
                  <input type="checkbox" id="showStages" checked={showStages}
                    onChange={e=>{ setShowStages(e.target.checked); if(e.target.checked && cardioStages.length===0) addStage(); }}
                    style={{ accentColor:'var(--accent)', width:16, height:16 }} />
                  <label htmlFor="showStages" style={{ cursor:'pointer', fontSize:13, color:'var(--text2)', userSelect:'none' }}>
                    Build interval program
                  </label>
                </div>
              </div>

              {showStages && (
                <div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8 }}>
                    {cardioMode==='treadmill' ? 'Each stage: duration, speed (mph), incline (optional)' : 'Each stage: duration, effort level'}
                  </div>
                  {cardioStages.map((stage, i) => (
                    <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-end', marginBottom:8, flexWrap:'wrap',
                      padding:'8px 10px', background:'var(--bg3)', borderRadius:6, border:'1px solid var(--border)' }}>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13,
                        color:'var(--accent)', minWidth:24, paddingBottom:4 }}>{i+1}</div>
                      <div className="form-group" style={{ margin:0, minWidth:90 }}>
                        <label className="form-label" style={{ fontSize:10 }}>Duration (min)</label>
                        <input className="form-input" type="number" min="0.5" step="0.5" style={{ fontSize:13 }}
                          value={(stage.duration_seconds||120)/60}
                          onChange={e=>updateStage(i,'duration_seconds',Math.round(parseFloat(e.target.value||1)*60))} />
                      </div>
                      {cardioMode==='treadmill' ? (<>
                        <div className="form-group" style={{ margin:0, minWidth:80 }}>
                          <label className="form-label" style={{ fontSize:10 }}>Speed (mph)</label>
                          <input className="form-input" type="number" min="0" step="0.1" style={{ fontSize:13 }}
                            value={stage.speed===null?'':stage.speed} placeholder={i>0?'inherit':'3.5'}
                            onChange={e=>updateStage(i,'speed',e.target.value===''?null:parseFloat(e.target.value))} />
                        </div>
                        <div className="form-group" style={{ margin:0, minWidth:80 }}>
                          <label className="form-label" style={{ fontSize:10 }}>Incline (opt)</label>
                          <input className="form-input" type="number" min="0" step="0.5" style={{ fontSize:13 }}
                            value={stage.incline===null?'':stage.incline} placeholder="0"
                            onChange={e=>updateStage(i,'incline',e.target.value===''?null:parseFloat(e.target.value))} />
                        </div>
                      </>) : (
                        <div className="form-group" style={{ margin:0, minWidth:120 }}>
                          <label className="form-label" style={{ fontSize:10 }}>Effort</label>
                          <select className="form-select" style={{ fontSize:13 }} value={stage.effort||'moderate'}
                            onChange={e=>updateStage(i,'effort',e.target.value)}>
                            <option value="easy">Easy</option>
                            <option value="moderate">Moderate</option>
                            <option value="hard">Hard</option>
                            <option value="sprint">Sprint</option>
                          </select>
                        </div>
                      )}
                      <button onClick={()=>removeStage(i)} style={{ background:'none', border:'none',
                        color:'var(--text3)', cursor:'pointer', fontSize:18, paddingBottom:2 }}>✕</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={addStage} style={{ marginTop:4 }}>
                    + Add Stage
                  </button>
                  {cardioStages.length > 0 && (() => {
                    const totalMins = cardioStages.reduce((sum, s) => sum + (s.duration_seconds||0), 0) / 60;
                    const targetMins = parseFloat(duration) || 0;
                    const over = targetMins > 0 && totalMins > targetMins;
                    const under = targetMins > 0 && totalMins < targetMins;
                    return (
                      <div style={{ marginTop:8, fontSize:12, color: over ? '#ff6b6b' : under ? '#ffaa00' : 'var(--green)' }}>
                        Stage total: <strong>{totalMins.toFixed(1)} min</strong>
                        {targetMins > 0 && <span style={{ color:'var(--text3)' }}> / {targetMins} min target</span>}
                        {over  && <span> ⚠ exceeds duration by {(totalMins-targetMins).toFixed(1)} min</span>}
                        {under && <span> · {(targetMins-totalMins).toFixed(1)} min remaining</span>}
                        {!over && !under && targetMins > 0 && <span> ✓</span>}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STRENGTH FIELDS ── */}
        {!isCardio && selectedEx && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Weight (lbs)</label>
                <input className="form-input" type="number" min="0" step="0.25"
                  value={weight} onChange={e=>setWeight(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Sets</label>
                <input className="form-input" type="number" min="1"
                  value={sets} onChange={e=>setSets(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Reps</label>
                <input className="form-input" type="number" min="1"
                  value={reps} onChange={e=>setReps(e.target.value)} />
              </div>
            </div>

            {!isCardio && <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:14, marginBottom:14 }}>
              <div style={{ fontSize:10, letterSpacing:1.5, textTransform:'uppercase', color:'var(--green)', marginBottom:10, fontWeight:700 }}>Progressive Overload</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Increase Type</label>
                  <select className="form-select" value={increaseType} onChange={e=>setIncreaseType(e.target.value)}>
                    <option value="flat">Flat (lbs)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount</label>
                  <input className="form-input" type="number" min="0" step="0.5"
                    value={increaseVal} onChange={e=>setIncreaseVal(e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize:12, color:'var(--text3)' }}>
                After logging, weight auto-increases by <strong style={{color:'var(--green)'}}>{increaseVal}{increaseType==='percent'?'%':' lbs'}</strong> for next session.
              </div>
            </div>}
          </>
        )}

        {/* ── HEAVY LAST SET (strength only) ── */}
        {!isCardio && <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:14, marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: lastSetBump ? 12 : 0 }}>
            <input type="checkbox" id="lastSetBump" checked={lastSetBump} onChange={e=>setLastSetBump(e.target.checked)}
              style={{ width:16, height:16, cursor:'pointer', accentColor:'var(--accent)' }} />
            <label htmlFor="lastSetBump" style={{ cursor:'pointer', fontSize:13, fontWeight:600, color:'var(--text)', userSelect:'none' }}>
              Heavy Last Set
            </label>
            <span style={{ fontSize:11, color:'var(--text3)' }}>— increase weight on the final set only</span>
          </div>
          {lastSetBump && (
            <>
              <div className="form-row" style={{ marginTop:0 }}>
                <div className="form-group">
                  <label className="form-label">Bump Type</label>
                  <select className="form-select" value={lastSetBumpType} onChange={e=>setLastSetBumpType(e.target.value)}>
                    <option value="flat">Flat (lbs)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount</label>
                  <input className="form-input" type="number" min="0" step="1"
                    value={lastSetBumpVal} onChange={e=>setLastSetBumpVal(e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize:12, color:'var(--text3)' }}>
                Last set: <strong style={{color:'var(--accent)'}}>
                  {lastSetBumpType==='flat'
                    ? `${parseFloat(weight||0) + parseFloat(lastSetBumpVal||0)} lbs`
                    : `${Math.round(parseFloat(weight||0) * (1 + parseFloat(lastSetBumpVal||0)/100) * 4)/4} lbs`
                  }
                </strong>
                {' '}(+{lastSetBumpVal}{lastSetBumpType==='percent'?'%':' lbs'} on the final set)
              </div>
            </>
          )}
        </div>}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{initial ? 'Save Changes' : 'Add Exercise'}</button>
        </div>
      </div>
    </div>
  );
}
