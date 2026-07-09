import React, { useState, useEffect, useRef } from 'react';

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  } catch(e) {}
}

export default function ActiveWorkout({ session, day, exercises, onComplete, onBack, api, savedProgress={} }) {
  const [sessionData,  setSessionData]  = useState(session);
  // Per-exercise overload: { [entryId]: bool } — tracks which exercises apply overload this session
  const [overloadMap,  setOverloadMap]  = useState(() => {
    const map = {};
    session.exercises.forEach(e => {
      if (e.entry_id && (e.exercise_type||e.ex_type||'strength') !== 'cardio') {
        map[e.entry_id] = (e.weight_increase_value > 0) || false;
      }
    });
    return map;
  });
  const [elapsed,      setElapsed]      = useState(0);
  const [showOverload, setShowOverload] = useState(false);
  const [keepGoing,    setKeepGoing]    = useState(false);
  const [expandedExs,  setExpandedExs]  = useState(new Set()); // expanded exercise ids
  const [showAddTemp,  setShowAddTemp]  = useState(false);
  const [showAddEx,    setShowAddEx]    = useState(false);
  const [completing,   setCompleting]   = useState(false);
  // Weight editing: { exId, value, updateRoutine }
  const [editingWeight, setEditingWeight] = useState(null);
  const timerRef        = useRef(null);
  const saveRef         = useRef(null);
  const cardioTimerRefs = useRef({});
  const elapsedRef      = useRef(savedProgress.elapsed_seconds || 0);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      if (elapsedRef.current >= 7200) {
        clearInterval(timerRef.current);
        clearInterval(saveRef.current);
        handleComplete('Auto-completed after 2 hours');
        return;
      }
      setElapsed(elapsedRef.current);
    }, 1000);
    // Save progress every 30 seconds
    saveRef.current = setInterval(() => {
      const cardioTimers = {};
      Object.entries(cardioTimerRefs.current).forEach(([id, data]) => {
        if (data) cardioTimers[id] = data;
      });
      fetch(`/api/sessions/${session.id}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elapsed_seconds: elapsedRef.current, cardio_timers: cardioTimers }),
      }).catch(() => {});
    }, 30000);
    return () => { clearInterval(timerRef.current); clearInterval(saveRef.current); };
  }, []);

  const allChecked = sessionData.exercises.length > 0 &&
    sessionData.exercises.every(e => e.completed);

  const hasStrengthExercises = sessionData.exercises.some(e => {
    const type = e.exercise_type || e.ex_type || 'strength';
    return type !== 'cardio';
  });

  useEffect(() => {
    if (allChecked && !completing && !keepGoing) {
      setShowOverload(true);
    }
  }, [allChecked]); // eslint-disable-line

  const formatTime = secs => {
    const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
  };

  // Update weight locally for an exercise
  const updateWeight = (exId, newWeight) => {
    setSessionData(prev => ({
      ...prev,
      exercises: prev.exercises.map(e =>
        e.id === exId ? { ...e, weight: parseFloat(newWeight) || 0, weightChanged: true } : e
      )
    }));
  };

  // Save weight change to backend, optionally update routine
  const saveWeightChange = async (ex, updateRoutine) => {
    // Update session exercise weight
    await api.put(`/session-exercises/${ex.id}/weight`, { weight: ex.weight, update_routine: updateRoutine });
    setEditingWeight(null);
  };

  const toggleExercise = async (ex) => {
    // If weight was changed, ask if they want to update routine
    if (ex.weightChanged && !editingWeight) {
      const update = window.confirm(
        `You changed the weight to ${ex.weight} lbs.\n\nUpdate weight for future sessions too?`
      );
      await saveWeightChange(ex, update);
    }
    const newVal = !ex.completed;
    await api.put(`/session-exercises/${ex.id}/complete`, { completed: newVal });
    setSessionData(prev => ({
      ...prev,
      exercises: prev.exercises.map(e =>
        e.id === ex.id ? { ...e, completed: newVal, weightChanged: false } : e
      )
    }));
  };

  const handleNoteChange = async (exId, note) => {
    await api.put(`/session-exercises/${exId}/note`, { note });
    setSessionData(prev => ({
      ...prev,
      exercises: prev.exercises.map(e => e.id===exId ? {...e, note} : e)
    }));
  };

  const handleComplete = async (autoNote='') => {
    setCompleting(true);
    clearInterval(timerRef.current);
    clearInterval(saveRef.current);
    const entryOverloads = {};
    Object.entries(overloadMap).forEach(([entryId, apply]) => {
      entryOverloads[entryId] = apply;
    });
    await api.put(`/sessions/${sessionData.id}/complete`, {
      duration_seconds: elapsedRef.current,
      apply_overload: true,
      entry_overloads: entryOverloads,
      notes: autoNote,
    });
    onComplete();
  };

  const handleAddExercise = async ({ exercise_id, weight, sets, reps, distance, distance_unit, duration_minutes, target_speed, add_to_routine }) => {
    const newEx = await api.post(`/sessions/${sessionData.id}/exercises`, {
      exercise_id, weight, sets, reps, distance, distance_unit, duration_minutes, target_speed,
      temporary: !add_to_routine, add_to_routine,
    });
    setSessionData(prev => ({ ...prev, exercises: [...prev.exercises, newEx] }));
    setShowAddEx(false);
  };

  const completedCount = sessionData.exercises.filter(e => e.completed).length;
  const totalCount     = sessionData.exercises.length;
  const progress       = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Compute set breakdown for an exercise
  const getSetBreakdown = (ex) => {
    const hasHeavyLast = ex.last_set_bump === 1 || ex.last_set_bump === true;
    const sets = parseInt(ex.sets) || 3;
    const base = parseFloat(ex.weight) || 0;
    if (!hasHeavyLast) return null;
    const bumpVal = parseFloat(ex.last_set_bump_value) || 10;
    const lastWeight = ex.last_set_bump_type === 'percent'
      ? Math.round(base * (1 + bumpVal/100) * 4) / 4
      : base + bumpVal;
    return Array.from({ length: sets }, (_, i) => ({
      num: i + 1,
      weight: i === sets - 1 ? lastWeight : base,
      isHeavy: i === sets - 1,
    }));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-16">
        <div className="flex-center gap-12">
          <button className="btn btn-ghost btn-sm" onClick={() => {
            if (window.confirm('End workout without completing?')) onBack();
          }}>← Back</button>
          <div>
            <h1 className="section-title" style={{ marginBottom:0 }}>{day.name}</h1>
            <div style={{ fontSize:12, color:'var(--text3)' }}>Session {sessionData.session_number}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, color:'var(--accent)', letterSpacing:2 }}>
            {formatTime(elapsed)}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAddEx(true)}>+ Exercise</button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background:'var(--bg3)', borderRadius:99, height:6, marginBottom:8, overflow:'hidden' }}>
        <div style={{ background:'var(--accent)', height:'100%', width:`${progress}%`, transition:'width 0.3s', borderRadius:99 }} />
      </div>
      <div style={{ fontSize:12, color:'var(--text3)', marginBottom:20 }}>
        {completedCount} of {totalCount} exercises completed
      </div>

      {/* Exercise checklist */}
      <div className="entry-list" style={{ marginBottom:24 }}>
        {sessionData.exercises.map((ex, idx) => {
          const isNext       = !ex.completed && sessionData.exercises.slice(0, idx).every(e => e.completed);
          const isCardio     = (ex.exercise_type || ex.ex_type || '') === 'cardio';
          const setBreakdown = getSetBreakdown(ex);
          const isEditingThis = editingWeight?.exId === ex.id;

          return (
            <div key={ex.id} className="entry-row" style={{
              borderColor: ex.completed ? 'var(--green)' : isNext ? 'var(--accent)' : 'var(--border)',
              background:  ex.completed ? '#34c75908' : isNext ? '#e8ff0006' : 'var(--bg3)',
              opacity: !ex.completed && !isNext && completedCount > 0 ? 0.65 : 1,
              transition: 'all 0.2s',
            }}>
              <div className="flex-between" style={{ gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleExercise(ex)}
                      style={{
                        width:30, height:30, borderRadius:8, border:'2px solid', flexShrink:0,
                        borderColor: ex.completed ? 'var(--green)' : isNext ? 'var(--accent)' : 'var(--border)',
                        background:  ex.completed ? 'var(--green)' : 'transparent',
                        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                        transition:'all 0.15s', fontSize:15, color:'#000', fontWeight:700,
                      }}>
                      {ex.completed ? '✓' : ''}
                    </button>
                    <div style={{ flex:1 }}>
                      <div className="entry-name" style={{
                        textDecoration: ex.completed ? 'line-through' : 'none',
                        opacity: ex.completed ? 0.6 : 1,
                      }}>
                        {ex.exercise_name}
                        {!!ex.temporary && <span style={{ fontSize:10, color:'var(--text3)', marginLeft:6 }}>(temp)</span>}
                      </div>

                      {/* Stats + editable weight */}
                      {!isCardio && (
                        <div className="entry-stats" style={{ marginTop:4, alignItems:'center' }}>
                          {isEditingThis ? (
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <input
                                type="number" min="0" step="0.25"
                                value={editingWeight.value}
                                onChange={e => setEditingWeight(prev => ({...prev, value: e.target.value}))}
                                style={{ width:80, background:'var(--bg2)', border:'1px solid var(--accent)',
                                  borderRadius:6, color:'var(--text)', padding:'4px 8px', fontSize:14, fontWeight:700 }}
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key==='Enter') {
                                    updateWeight(ex.id, editingWeight.value);
                                    setEditingWeight(null);
                                  }
                                  if (e.key==='Escape') setEditingWeight(null);
                                }}
                              />
                              <span style={{ fontSize:12, color:'var(--text3)' }}>lbs</span>
                              <button className="btn btn-primary btn-sm" onClick={() => {
                                updateWeight(ex.id, editingWeight.value);
                                setEditingWeight(null);
                              }}>✓</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditingWeight(null)}>✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingWeight({ exId: ex.id, value: ex.weight })}
                              style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:4 }}
                              title="Tap to edit weight">
                              <strong style={{ color: ex.weightChanged ? 'var(--accent)' : 'inherit', fontSize:15 }}>
                                {ex.weight}
                              </strong>
                              <span style={{ color:'var(--text3)', fontSize:13 }}>lbs</span>
                              <span style={{ fontSize:11, color:'var(--text3)', marginLeft:2 }}>✏️</span>
                            </button>
                          )}
                          {!isCardio && <span className="entry-stat">
                            <strong>{ex.sets}</strong> sets × <strong>{ex.reps}</strong> reps
                          </span>}
                        </div>
                      )}

                      {isCardio && (
                        <div className="entry-stats">
                          {ex.distance > 0 && <span className="entry-stat"><strong>{ex.distance}</strong> {ex.distance_unit}</span>}
                          {ex.duration_minutes > 0 && <span className="entry-stat"><strong>{ex.duration_minutes}</strong> min</span>}
                          <span className="entry-stat" style={{ fontSize:11, color:'var(--text3)' }}>
                            {ex.cardio_mode === 'outdoor' ? '🏃 Outdoor' : '🏃 Machine'}
                          </span>
                        </div>
                      )}

                      {/* Cardio stage timer */}
                      {isCardio && Array.isArray(ex.cardio_stages) && ex.cardio_stages.length > 0 && !ex.completed && (
                        <CardioStageTimer
                          key={ex.id}
                          stages={ex.cardio_stages}
                          mode={ex.cardio_mode || 'treadmill'}
                          savedState={savedProgress.cardio_timers?.[String(ex.id)]}
                          onStateChange={state => { cardioTimerRefs.current[String(ex.id)] = state; }}
                        />
                      )}
                      {isCardio && !!ex.completed && ex.cardio_stages?.length > 0 && (
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:6 }}>
                          {ex.cardio_stages.map((s, i) => {
                            const fmt = secs => `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
                            const label = ex.cardio_mode==='outdoor'
                              ? `${fmt(s.duration_seconds||0)} — ${s.effort||'moderate'}`
                              : `${fmt(s.duration_seconds||0)} — ${s.speed||0}mph${s.incline?` / ${s.incline}% incline`:''}`;
                            return (
                              <div key={i} style={{ padding:'3px 10px', borderRadius:6, fontSize:11,
                                fontWeight:600, background:'#34c75930', border:'1px solid #34c75950',
                                color:'var(--green)' }}>✓ {label}</div>
                            );
                          })}
                        </div>
                      )}

                      {/* Per-exercise note */}
                      <ExerciseNote
                        note={String(ex.note||'')}
                        onChange={note => handleNoteChange(ex.id, note)}
                      />

                      {/* Overload toggle (strength only, non-temporary) */}
                      {!isCardio && !ex.temporary && ex.entry_id && (
                        <label style={{ display:'flex', alignItems:'center', gap:6, marginTop:6, cursor:'pointer' }}>
                          <input type="checkbox"
                            checked={!!overloadMap[ex.entry_id]}
                            onChange={e => setOverloadMap(prev => ({...prev, [ex.entry_id]: e.target.checked}))}
                            style={{ accentColor:'var(--accent)', width:13, height:13 }} />
                          <span style={{ fontSize:11, color:'var(--text3)' }}>Apply overload next session</span>
                        </label>
                      )}

                      {/* Expand for description/image/muscles */}
                      {(ex.exercise_description || ex.image_path || (ex.primary_muscles||[]).length > 0) && (
                        <button
                          onClick={() => setExpandedExs(prev => {
                            const s = new Set(prev);
                            s.has(ex.id) ? s.delete(ex.id) : s.add(ex.id);
                            return new Set(s);
                          })}
                          style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer',
                            fontSize:11, padding:'4px 0', display:'flex', alignItems:'center', gap:4, marginTop:4 }}>
                          {expandedExs.has(ex.id) ? '▲ Less' : '▼ More info'}
                        </button>
                      )}
                      {expandedExs.has(ex.id) && (
                        <ExerciseExpand ex={ex} />
                      )}

                      {/* Heavy last set breakdown */}
                      {setBreakdown && !isCardio && (
                        <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                          {setBreakdown.map(s => (
                            <div key={s.num} style={{
                              padding:'3px 10px', borderRadius:6, fontSize:12, fontWeight:600,
                              background: s.isHeavy ? '#e8ff0018' : 'var(--bg4)',
                              border: `1px solid ${s.isHeavy ? 'var(--accent)' : 'var(--border)'}`,
                              color: s.isHeavy ? 'var(--accent)' : 'var(--text2)',
                            }}>
                              Set {s.num}: {s.weight} lbs{s.isHeavy ? ' 🔥' : ''}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Image/description expand */}
                      {(ex.image_path || ex.exercise_description) && (
                        <ExercisePreview ex={ex} />
                      )}
                    </div>
                  </div>
                </div>
                {isNext && !ex.completed && (
                  <span style={{ fontSize:10, color:'var(--accent)', fontWeight:700,
                    letterSpacing:1, textTransform:'uppercase', flexShrink:0 }}>UP NEXT</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Complete button */}
      <div style={{ display:'flex', justifyContent:'center', marginBottom:32 }}>
        <button className="btn btn-primary" style={{ padding:'12px 32px', fontSize:16 }}
          onClick={() => setShowOverload(true)}>
          ✓ Complete
        </button>
      </div>

      {/* Progressive overload prompt */}
      {showOverload && (
        <CompletionModal
          exercises={sessionData.exercises}
          elapsed={elapsed}
          formatTime={formatTime}
          onComplete={handleComplete}
          onKeepGoing={() => { setShowOverload(false); setKeepGoing(true); }}
          overloadMap={overloadMap}
        />
      )}

      {showAddTemp && (
        <AddTempExercise
          allExercises={exercises}
          sessionExercises={sessionData.exercises}
          onAdd={async (exerciseId) => {
            const newEx = await api.post(`/sessions/${session.id}/temp-exercise`, { exercise_id: exerciseId });
            setSessionData(prev => ({ ...prev, exercises: [...prev.exercises, newEx] }));
            setShowAddTemp(false);
          }}
          onClose={() => setShowAddTemp(false)}
        />
      )}

      {showAddEx && (
        <AddExerciseModal exercises={exercises} onSave={handleAddExercise} onClose={() => setShowAddEx(false)} />
      )}
    </div>
  );
}

function ExerciseNote({ note, onChange }) {
  const [editing, setEditing] = React.useState(false);
  const [val,     setVal]     = React.useState(note);
  const ref = React.useRef();

  React.useEffect(() => { setVal(note); }, [note]);

  const save = () => { setEditing(false); onChange(val); };

  if (editing) return (
    <div style={{ display:'flex', gap:6, marginTop:6, alignItems:'center' }}>
      <input
        ref={ref}
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key==='Enter') save(); if (e.key==='Escape') { setVal(note); setEditing(false); } }}
        placeholder="Add a note..."
        style={{ flex:1, background:'var(--bg2)', border:'1px solid var(--accent)', borderRadius:6,
          padding:'4px 8px', fontSize:12, color:'var(--text)', outline:'none' }}
      />
      <button onClick={save} style={{ background:'var(--accent)', border:'none', borderRadius:6,
        padding:'4px 10px', fontSize:11, fontWeight:700, cursor:'pointer', color:'#000' }}>Save</button>
      <button onClick={() => { setVal(note); setEditing(false); }}
        style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:18 }}>✕</button>
    </div>
  );

  return (
    <div style={{ marginTop:5 }}>
      {val ? (
        <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
          <span style={{ fontSize:11, color:'var(--text3)', fontStyle:'italic', flex:1 }}>📝 {val}</span>
          <button onClick={() => setEditing(true)}
            style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:10, padding:0 }}>edit</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer',
            fontSize:11, padding:0, textDecoration:'underline dotted' }}>+ add note</button>
      )}
    </div>
  );
}

function CardioStageTimer({ stages, mode, savedState=null, onStateChange=null }) {
  const [running,      setRunning]      = React.useState(false);
  const [elapsed,      setElapsed]      = React.useState(() => {
    if (!savedState) return 0;
    // Restore from saved state: calculate total elapsed from stage index + stage elapsed
    let total = 0;
    for (let i = 0; i < (savedState.stage_index||0); i++) total += (stages[i]?.duration_seconds||0);
    total += (savedState.stage_elapsed||0);
    const totalDur = stages.reduce((s, st) => s + (st.duration_seconds||0), 0);
    return Math.min(total, Math.max(0, totalDur - 1)); // never restore as "done"
    
  });
  const [prevStageIdx, setPrevStageIdx] = React.useState(-1);
  const timerRef = React.useRef(null);

  const totalDuration = stages.reduce((s, st) => s + (st.duration_seconds||0), 0);

  // Figure out current stage
  let currentStageIdx = stages.length - 1;
  let stageElapsed = elapsed;
  for (let i = 0; i < stages.length; i++) {
    const dur = stages[i].duration_seconds || 0;
    if (stageElapsed < dur) { currentStageIdx = i; break; }
    stageElapsed -= dur;
  }

  // Chime on stage change
  React.useEffect(() => {
    if (currentStageIdx !== prevStageIdx && prevStageIdx !== -1 && elapsed > 0) playChime();
    setPrevStageIdx(currentStageIdx);
  }, [currentStageIdx]);

  // Report state to parent for persistence
  React.useEffect(() => {
    if (onStateChange && running) {
      onStateChange({ stage_index: currentStageIdx, stage_elapsed: stageRemaining > 0 ? (stages[currentStageIdx]?.duration_seconds||0) - stageRemaining : 0 });
    }
  }, [elapsed]);

  const toggle = () => {
    if (running) { clearInterval(timerRef.current); setRunning(false); }
    else {
      timerRef.current = setInterval(() => setElapsed(e => Math.min(e+1, totalDuration)), 1000);
      setRunning(true);
    }
  };
  React.useEffect(() => () => clearInterval(timerRef.current), []);

  const stageRemaining = (() => {
    let s = elapsed;
    for (let i = 0; i < stages.length; i++) {
      const dur = stages[i].duration_seconds || 0;
      if (s < dur) return dur - s;
      s -= dur;
    }
    return 0;
  })();

  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const done = elapsed >= totalDuration;
  const EFFORT_LABELS = { easy:'Easy', moderate:'Moderate', hard:'Hard', sprint:'Sprint' };

  return (
    <div style={{ marginTop:8, background:'var(--bg2)', borderRadius:8, padding:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
        <button onClick={toggle}
          style={{ padding:'4px 12px', borderRadius:6, border:'1px solid var(--accent)',
            background: running ? 'var(--accent)' : 'transparent',
            color: running ? '#000' : 'var(--accent)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
          {done ? '✓ Done' : running ? '⏸ Pause' : elapsed===0 ? '▶ Start' : '▶ Resume'}
        </button>
        {!done && <span style={{ fontSize:11, color:'var(--text3)' }}>
          Total: {fmt(totalDuration - elapsed)} left
        </span>}
        {running && !done && <span style={{ fontSize:11, color:'var(--accent)', fontWeight:700 }}>
          Stage: {fmt(stageRemaining)}
        </span>}
        {elapsed > 0 && !done && (
          <button onClick={() => { clearInterval(timerRef.current); setElapsed(0); setRunning(false); }}
            style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:11 }}>Reset</button>
        )}
      </div>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
        {stages.map((s, i) => {
          const pastEnd = elapsed >= stages.slice(0, i+1).reduce((sum,st) => sum+(st.duration_seconds||0), 0);
          const isCurrent = i === currentStageIdx && elapsed > 0 && !done;
          const isPast = pastEnd && !isCurrent;
          return (
            <div key={i} style={{
              padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600, transition:'all 0.2s',
              background: isCurrent ? 'var(--accent)' : isPast ? '#34c75930' : 'var(--bg4)',
              border: `1px solid ${isCurrent ? 'var(--accent)' : isPast ? '#34c75950' : 'var(--border)'}`,
              color: isCurrent ? '#000' : isPast ? 'var(--green)' : 'var(--text2)',
            }}>
              {fmt(s.duration_seconds||0)} —{' '}
              {mode === 'outdoor'
                ? (EFFORT_LABELS[s.effort] || s.effort)
                : `${s.speed||0}mph${s.incline ? ` / ${s.incline}% incline` : ''}`}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompletionModal({ exercises, elapsed, formatTime, onComplete, onKeepGoing, overloadMap }) {
  const isCardioOnly = exercises.every(e => (e.exercise_type||e.ex_type||'strength') === 'cardio' || e.temporary);
  // Show which exercises will get overload applied
  const overloadList = exercises.filter(e =>
    !e.temporary && (e.exercise_type||e.ex_type||'strength') !== 'cardio' && overloadMap[e.entry_id]
  );

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth:480, textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:8 }}>🎉</div>
        <div className="modal-title" style={{ justifyContent:'center' }}>Workout Complete!</div>
        <div style={{ fontSize:13, color:'var(--text2)', marginBottom:16 }}>
          Duration: <strong>{formatTime(elapsed)}</strong> · {exercises.filter(e=>!!e.completed).length}/{exercises.length} done
        </div>

        {!isCardioOnly && overloadList.length > 0 && (
          <div style={{ background:'var(--bg3)', borderRadius:8, padding:12, marginBottom:16, textAlign:'left' }}>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:6 }}>Progressive overload will be applied to:</div>
            {overloadList.map(e => (
              <div key={e.id} style={{ fontSize:13, fontFamily:"'Barlow Condensed',sans-serif",
                fontWeight:700, textTransform:'uppercase', color:'var(--green)', padding:'2px 0' }}>
                ↑ {e.exercise_name}
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <button className="btn btn-ghost" onClick={onKeepGoing} style={{ fontSize:12 }}>
            I'm not done — keep going
          </button>
          <button className="btn btn-primary" onClick={() => onComplete()}>Complete</button>
        </div>
      </div>
    </div>
  );
}

function AddTempExercise({ allExercises, sessionExercises, onAdd, onClose }) {
  const [search, setSearch] = React.useState('');
  const sessionExIds = new Set(sessionExercises.map(e => e.exercise_id));
  const filtered = allExercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth:440 }} onClick={e=>e.stopPropagation()}>
        <div className="modal-title">Add Exercise to Session</div>
        <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10 }}>
          Added exercises are temporary — they won't be saved to the workout permanently.
          They'll appear in session history tagged "(Added during session)".
        </div>
        <input className="form-input" placeholder="Search exercises..."
          value={search} onChange={e=>setSearch(e.target.value)} autoFocus
          style={{ marginBottom:10 }} />
        <div style={{ maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
          {filtered.map(ex => (
            <button key={ex.id} className="btn btn-ghost" style={{ textAlign:'left', justifyContent:'flex-start' }}
              onClick={() => onAdd(ex.id)}>
              <div>
                <div style={{ fontWeight:700, fontSize:13 }}>{ex.name}
                  {sessionExIds.has(ex.id) && <span style={{ fontSize:10, color:'var(--text3)', marginLeft:6 }}>(already in session)</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>
                  {ex.exercise_type} · {(ex.primary_muscles||[]).slice(0,2).join(', ')}
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ExerciseExpand({ ex }) {
  const MUSCLE_LABEL = { chest:'Chest', serratus:'Serratus', front_delts:'Front Delts',
    side_delts:'Side Delts', rear_delts:'Rear Delts', traps:'Traps', mid_back:'Mid Back',
    lats:'Lats', lower_back:'Lower Back', biceps:'Biceps', triceps:'Triceps', forearms:'Forearms',
    glutes:'Glutes', quads:'Quads', hamstrings:'Hamstrings', adductors:'Adductors',
    abductors:'Abductors', calves:'Calves', shins:'Shins', hip_flexors:'Hip Flexors',
    abs:'Abs', obliques:'Obliques' };

  return (
    <div style={{ marginTop:10, padding:12, background:'var(--bg2)', borderRadius:8,
      border:'1px solid var(--border)', fontSize:12 }}>
      {ex.exercise_description && (
        <p style={{ color:'var(--text2)', marginBottom:10, lineHeight:1.6, margin:'0 0 10px' }}>
          {ex.exercise_description}
        </p>
      )}
      {ex.image_path && (
        <img src={`/uploads/${ex.image_path.split('/').pop()}`} alt={ex.exercise_name}
          style={{ maxWidth:'100%', maxHeight:200, borderRadius:6, marginBottom:10, display:'block' }} />
      )}
      {((ex.primary_muscles||[]).length > 0 || (ex.secondary_muscles||[]).length > 0) && (
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {(ex.primary_muscles||[]).map(m => (
            <span key={m} style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:700,
              background:'rgba(255,107,53,0.2)', border:'1px solid rgba(255,107,53,0.4)', color:'var(--text2)' }}>
              {MUSCLE_LABEL[m]||m}
            </span>
          ))}
          {(ex.secondary_muscles||[]).map(m => (
            <span key={m} style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:700,
              background:'rgba(232,255,0,0.15)', border:'1px solid rgba(232,255,0,0.3)', color:'var(--text2)' }}>
              {MUSCLE_LABEL[m]||m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ExercisePreview({ ex }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop:6 }}>
      <button onClick={() => setOpen(!open)}
        style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer',
          fontSize:11, padding:0, display:'flex', alignItems:'center', gap:4 }}>
        {open ? '▲ Hide' : '▼ Show'} details
      </button>
      {open && (
        <div style={{ marginTop:8 }}>
          {ex.exercise_description && <p style={{ fontSize:12, color:'var(--text2)', marginBottom:8, lineHeight:1.6 }}>{ex.exercise_description}</p>}
          {ex.image_path && <img src={ex.image_path} alt={ex.exercise_name}
            style={{ maxWidth:'100%', maxHeight:250, borderRadius:8, objectFit:'contain', background:'var(--bg2)', display:'block' }} />}
        </div>
      )}
    </div>
  );
}

function AddExerciseModal({ exercises, onSave, onClose }) {
  const [exerciseId,   setExerciseId]   = useState('');
  const [weight,       setWeight]       = useState(0);
  const [sets,         setSets]         = useState(3);
  const [reps,         setReps]         = useState(10);
  const [addToRoutine, setAddToRoutine] = useState(false);
  const [search,       setSearch]       = useState('');

  const filtered = exercises.filter(e => !search.trim() || e.name.toLowerCase().includes(search.toLowerCase()));
  const selectedEx = exercises.find(e => e.id === parseInt(exerciseId));
  const isCardio = selectedEx?.exercise_type === 'cardio';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Add Exercise to Session</div>
        <div className="form-group">
          <label className="form-label">Exercise</label>
          <input className="form-input" placeholder="Search…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ marginBottom:6 }} />
          <select className="form-select" size="5" value={exerciseId}
            onChange={e => setExerciseId(e.target.value)}>
            <option value="">— select —</option>
            {filtered.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
        {selectedEx && !isCardio && (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Weight (lbs)</label>
              <input className="form-input" type="number" min="0" step="0.25"
                value={weight} onChange={e => setWeight(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Sets</label>
              <input className="form-input" type="number" min="1" value={sets} onChange={e => setSets(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Reps</label>
              <input className="form-input" type="number" min="1" value={reps} onChange={e => setReps(e.target.value)} />
            </div>
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0',
          borderTop:'1px solid var(--border)', marginTop:4 }}>
          <input type="checkbox" id="addToRoutine" checked={addToRoutine}
            onChange={e => setAddToRoutine(e.target.checked)}
            style={{ width:16, height:16, accentColor:'var(--accent)' }} />
          <label htmlFor="addToRoutine" style={{ cursor:'pointer', fontSize:13, color:'var(--text)' }}>
            Include in all future sessions
          </label>
        </div>
        {!addToRoutine && <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8 }}>This session only.</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            if (!exerciseId) return alert('Select an exercise');
            onSave({ exercise_id:parseInt(exerciseId), weight:parseFloat(weight)||0,
              sets:parseInt(sets)||3, reps:parseInt(reps)||10, add_to_routine:addToRoutine });
          }}>Add</button>
        </div>
      </div>
    </div>
  );
}
