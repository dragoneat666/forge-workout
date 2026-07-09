import React, { useState, useEffect, useRef, useCallback } from 'react';

const EFFORT_LABELS = { easy:'Easy', moderate:'Moderate', hard:'Hard', sprint:'Sprint' };
const EFFORT_COLORS = { easy:'#34c759', moderate:'#ffaa00', hard:'#ff6b6b', sprint:'#ff2d55' };

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

export default function ActiveRoutine({ session, routine, days, onComplete, onBack, api, savedProgress={} }) {
  const { routine_session_id, session_number, routine_name, day_sessions } = session;

  // Flatten all exercises with their day context
  const [allExercises, setAllExercises] = useState(() =>
    day_sessions.flatMap(ds =>
      ds.exercises.map(ex => ({ ...ex, day_name: ds.day_name, day_id: ds.day_id, session_id: ds.session_id }))
    )
  );
  const [elapsed,      setElapsed]      = useState(savedProgress.elapsed_seconds || 0);
  const [showComplete, setShowComplete] = useState(false);
  const [cardioTimers, setCardioTimers] = useState({}); // exerciseId -> { stageIdx, elapsed }
  const timerRef        = useRef(null);
  const saveRef         = useRef(null);
  const cardioTimerRefs = useRef({});
  const elapsedRef      = useRef(savedProgress.elapsed_seconds || 0);
  const [keepGoing,  setKeepGoing]  = useState(false);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      if (elapsedRef.current >= 7200) {
        clearInterval(timerRef.current);
        clearInterval(saveRef.current);
        handleComplete(day_sessions.map(ds => ({ session_id:ds.session_id, day_name:ds.day_name, apply_overload:false })), 'Auto-completed after 2 hours');
        return;
      }
      setElapsed(elapsedRef.current);
    }, 1000);
    // Save progress every 30 seconds
    saveRef.current = setInterval(() => {
      const cardioTimers = {};
      Object.entries(cardioTimerRefs.current).forEach(([id, data]) => { if (data) cardioTimers[id] = data; });
      fetch(`/api/routine-sessions/${routine_session_id}/progress`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ elapsed_seconds: elapsedRef.current, cardio_timers: cardioTimers })
      }).catch(()=>{});
    }, 30000);
    return () => { clearInterval(timerRef.current); clearInterval(saveRef.current); };
  }, []);

  const allChecked = allExercises.length > 0 && allExercises.every(e => e.completed);
  useEffect(() => { if (allChecked && !keepGoing) setShowComplete(true); }, [allChecked]);

  const formatTime = secs => {
    const h=Math.floor(secs/3600), m=Math.floor((secs%3600)/60), s=secs%60;
    return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
  };

  const toggleExercise = async (ex) => {
    const newVal = !ex.completed;
    await api.put(`/session-exercises/${ex.id}/complete`, { completed: newVal });
    setAllExercises(prev => prev.map(e => e.id===ex.id ? {...e, completed:newVal} : e));
  };

  const handleNoteChange = async (exId, note) => {
    await api.put(`/session-exercises/${exId}/note`, { note });
    setAllExercises(prev => prev.map(e => e.id===exId ? {...e, note} : e));
  };

  const handleComplete = async (dayOverloads, autoNote='') => {
    clearInterval(timerRef.current);
    clearInterval(saveRef.current);
    await api.put(`/routine-sessions/${routine_session_id}/complete`, {
      duration_seconds: elapsed,
      day_overloads: dayOverloads,
      notes: autoNote,
    });
    onComplete();
  };

  const completedCount = allExercises.filter(e => e.completed).length;
  const progress = allExercises.length > 0 ? (completedCount/allExercises.length)*100 : 0;

  // Group by day for headers
  const byDay = day_sessions.map(ds => ({
    ...ds,
    exercises: allExercises.filter(e => e.session_id === ds.session_id),
  }));

  return (
    <div>
      <div className="flex-between mb-16">
        <div className="flex-center gap-12">
          <button className="btn btn-ghost btn-sm" onClick={() => {
            if (window.confirm('End routine without completing?')) onBack();
          }}>← Back</button>
          <div>
            <h1 className="section-title" style={{ marginBottom:0 }}>{routine_name}</h1>
            <div style={{ fontSize:12, color:'var(--text3)' }}>Session {session_number}</div>
          </div>
        </div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, color:'var(--accent)', letterSpacing:2 }}>
          {formatTime(elapsed)}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background:'var(--bg3)', borderRadius:99, height:6, marginBottom:8, overflow:'hidden' }}>
        <div style={{ background:'var(--accent)', height:'100%', width:`${progress}%`, transition:'width 0.3s', borderRadius:99 }} />
      </div>
      <div style={{ fontSize:12, color:'var(--text3)', marginBottom:20 }}>
        {completedCount} of {allExercises.length} exercises completed
      </div>

      {/* Exercises grouped by workout day */}
      <div style={{ marginBottom:24 }}>
        {byDay.map((ds, dIdx) => (
          <div key={ds.session_id} style={{ marginBottom:20 }}>
            {/* Day header */}
            <div style={{
              display:'flex', alignItems:'center', gap:10, marginBottom:8,
              padding:'6px 12px', background:'var(--bg2)', borderRadius:6,
              borderLeft:'3px solid var(--accent)',
            }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
                fontSize:14, textTransform:'uppercase', letterSpacing:1, color:'var(--accent)' }}>
                {ds.day_name}
              </span>
              <span style={{ fontSize:11, color:'var(--text3)' }}>
                {ds.exercises.filter(e=>e.completed).length}/{ds.exercises.length} done
              </span>
            </div>

            {/* Exercises for this day */}
            <div className="entry-list">
              {ds.exercises.map((ex, exIdx) => {
                const isCardio = ex.exercise_type==='cardio' || ex.ex_type==='cardio';
                const stages   = (() => {
                  const raw = ex.cardio_stages;
                  if (!raw) return [];
                  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch(e) { return []; } }
                  return Array.isArray(raw) ? raw : [];
                })();
                const hasStages = isCardio && stages.length > 0;
                const setBreakdown = !isCardio && (ex.last_set_bump===1||ex.last_set_bump===true) ? (() => {
                  const sets = parseInt(ex.sets)||3, base=parseFloat(ex.weight)||0;
                  const bump = ex.last_set_bump_type==='percent' ? Math.round(base*(1+(ex.last_set_bump_value||10)/100)*4)/4 : base+(ex.last_set_bump_value||10);
                  return Array.from({length:sets},(_,i)=>({num:i+1,weight:i===sets-1?bump:base,isHeavy:i===sets-1}));
                })() : null;

                return (
                  <div key={ex.id} className="entry-row" style={{
                    borderColor: ex.completed ? 'var(--green)' : 'var(--border)',
                    background:  ex.completed ? '#34c75908' : 'var(--bg3)',
                    transition: 'all 0.2s',
                  }}>
                    <div className="flex-between" style={{ gap:10 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <button onClick={() => toggleExercise(ex)} style={{
                            width:30, height:30, borderRadius:8, border:'2px solid', flexShrink:0,
                            borderColor: ex.completed ? 'var(--green)' : 'var(--border)',
                            background:  ex.completed ? 'var(--green)' : 'transparent',
                            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                            transition:'all 0.15s', fontSize:15, color:'#000', fontWeight:700,
                          }}>{ex.completed ? '✓' : ''}</button>
                          <div style={{ flex:1 }}>
                            <div className="entry-name" style={{ textDecoration:ex.completed?'line-through':'none', opacity:ex.completed?0.6:1 }}>
                              {ex.exercise_name}
                            </div>
                            <div className="entry-stats">
                              {isCardio ? (<>
                                {ex.distance>0 && <span className="entry-stat"><strong>{ex.distance}</strong> {ex.distance_unit}</span>}
                                {ex.duration_minutes>0 && <span className="entry-stat"><strong>{ex.duration_minutes}</strong> min</span>}
                                <span className="entry-stat" style={{ fontSize:11, color:'var(--text3)' }}>
                                  {ex.cardio_mode==='outdoor' ? '🏃 Outdoor' : '🏃 Machine'}
                                </span>
                              </>) : (<>
                                <span className="entry-stat"><strong>{ex.weight}</strong> lbs</span>
                                <span className="entry-stat"><strong>{ex.sets}</strong> × <strong>{ex.reps}</strong></span>
                              </>)}
                            </div>
                            {setBreakdown && (
                              <div style={{ display:'flex', gap:5, marginTop:5, flexWrap:'wrap' }}>
                                {setBreakdown.map(s => (
                                  <div key={s.num} style={{ padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:600,
                                    background:s.isHeavy?'#e8ff0018':'var(--bg4)', border:`1px solid ${s.isHeavy?'var(--accent)':'var(--border)'}`,
                                    color:s.isHeavy?'var(--accent)':'var(--text2)' }}>
                                    Set {s.num}: {s.weight}lbs{s.isHeavy?' 🔥':''}
                                  </div>
                                ))}
                              </div>
                            )}
                            {hasStages && !ex.completed && (
                              <CardioStageTimer
                                key={ex.id}
                                stages={stages}
                                mode={ex.cardio_mode||'treadmill'}
                                isActive={!ex.completed}
                                savedState={savedProgress.cardio_timers?.[ex.id]}
                                onStateChange={state => { cardioTimerRefs.current[ex.id] = state; }}
                              />
                            )}
                            {hasStages && !!ex.completed && (
                              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:6 }}>
                                {stages.map((s, i) => {
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
                            <ExerciseNote
                              note={ex.note||''}
                              onChange={note => handleNoteChange(ex.id, note)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'center', marginBottom:32 }}>
        <button className="btn btn-primary" style={{ padding:'12px 32px', fontSize:16 }}
          onClick={() => setShowComplete(true)}>✓ Complete Routine</button>
        {keepGoing && (
          <button className="btn btn-ghost btn-sm" onClick={() => {/* temp add for routines - future */}}>+ Add Exercise</button>
        )}
      </div>

      {showComplete && (
        <OverloadModal
          daySessions={day_sessions}
          elapsed={elapsed}
          completedCount={completedCount}
          totalCount={allExercises.length}
          formatTime={formatTime}
          onComplete={handleComplete}
          allExercises={allExercises}
        />
      )}
    </div>
  );
}

function ExerciseNote({ note, onChange }) {
  const [editing, setEditing] = React.useState(false);
  const [val,     setVal]     = React.useState(note);
  React.useEffect(() => { setVal(note); }, [note]);
  const save = () => { setEditing(false); onChange(val); };

  if (editing) return (
    <div style={{ display:'flex', gap:6, marginTop:6, alignItems:'center' }}>
      <input autoFocus value={val} onChange={e=>setVal(e.target.value)}
        onKeyDown={e=>{ if(e.key==='Enter') save(); if(e.key==='Escape'){setVal(note);setEditing(false);} }}
        placeholder="Add a note..."
        style={{ flex:1, background:'var(--bg2)', border:'1px solid var(--accent)', borderRadius:6,
          padding:'4px 8px', fontSize:12, color:'var(--text)', outline:'none' }} />
      <button onClick={save} style={{ background:'var(--accent)', border:'none', borderRadius:6,
        padding:'4px 10px', fontSize:11, fontWeight:700, cursor:'pointer', color:'#000' }}>Save</button>
      <button onClick={()=>{setVal(note);setEditing(false);}}
        style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:18 }}>✕</button>
    </div>
  );
  return (
    <div style={{ marginTop:5 }}>
      {val ? (
        <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
          <span style={{ fontSize:11, color:'var(--text3)', fontStyle:'italic', flex:1 }}>📝 {val}</span>
          <button onClick={()=>setEditing(true)}
            style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:10, padding:0 }}>edit</button>
        </div>
      ) : (
        <button onClick={()=>setEditing(true)}
          style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer',
            fontSize:11, padding:0, textDecoration:'underline dotted' }}>+ add note</button>
      )}
    </div>
  );
}

function CardioStageTimer({ stages, mode, isActive, savedState=null, onStateChange=null }) {
  const [running,      setRunning]      = useState(false);
  const [elapsed,      setElapsed]      = useState(() => {
    if (!savedState) return 0;
    let total = 0;
    for (let i = 0; i < (savedState.stage_index||0); i++) total += (stages[i]?.duration_seconds||0);
    total += (savedState.stage_elapsed||0);
    return total;
  });
  const [prevStageIdx, setPrevStageIdx] = useState(-1);
  const timerRef = useRef(null);

  const totalDuration = stages.reduce((s, st) => s + (st.duration_seconds||0), 0);
  let currentStageIdx = 0, stageElapsed = elapsed;
  for (let i=0; i<stages.length; i++) {
    const dur = stages[i].duration_seconds||0;
    if (stageElapsed < dur) { currentStageIdx = i; break; }
    stageElapsed -= dur; if (i===stages.length-1) currentStageIdx = i;
  }
  const currentStage = stages[currentStageIdx] || stages[0];

  useEffect(() => {
    if (currentStageIdx !== prevStageIdx && prevStageIdx !== -1) { playChime(); }
    setPrevStageIdx(currentStageIdx);
  }, [currentStageIdx]);

  const toggle = () => {
    if (running) { clearInterval(timerRef.current); setRunning(false); }
    else {
      timerRef.current = setInterval(() => setElapsed(e => Math.min(e+1, totalDuration)), 1000);
      setRunning(true);
    }
  };
  useEffect(() => () => clearInterval(timerRef.current), []);

  const remaining = totalDuration - elapsed;
  const stageRemaining = (() => {
    let s = elapsed;
    for (let i=0; i<stages.length; i++) {
      const dur=stages[i].duration_seconds||0;
      if (s<dur) return dur-s;
      s-=dur;
    } return 0;
  })();

  const formatTime = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  return (
    <div style={{ marginTop:8, background:'var(--bg2)', borderRadius:8, padding:10, fontSize:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, flexWrap:'wrap' }}>
        <button onClick={toggle} style={{ padding:'4px 12px', borderRadius:6, border:'1px solid var(--accent)',
          background: running?'var(--accent)':'transparent', color:running?'#000':'var(--accent)',
          cursor:'pointer', fontSize:11, fontWeight:700 }}>
          {running ? '⏸ Pause' : elapsed===0 ? '▶ Start' : '▶ Resume'}
        </button>
        <span style={{ color:'var(--text3)' }}>Total: {formatTime(remaining)} remaining</span>
        {elapsed>0 && <span style={{ color:'var(--accent)' }}>Stage: {formatTime(stageRemaining)}</span>}
        <button onClick={() => { clearInterval(timerRef.current); setElapsed(0); setRunning(false); }}
          style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:11 }}>Reset</button>
      </div>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
        {stages.map((s, i) => {
          const isCurrent = i===currentStageIdx && elapsed>0 && elapsed<totalDuration;
          const isPast    = elapsed >= stages.slice(0,i+1).reduce((sum,st)=>sum+(st.duration_seconds||0),0);
          return (
            <div key={i} style={{ padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600,
              background: isCurrent?'var(--accent)' : isPast?'#34c75930':'var(--bg4)',
              border:`1px solid ${isCurrent?'var(--accent)':isPast?'#34c75950':'var(--border)'}`,
              color: isCurrent?'#000':isPast?'var(--green)':'var(--text2)', transition:'all 0.2s' }}>
              {formatTime(s.duration_seconds||0)} —{' '}
              {mode==='outdoor' ? (EFFORT_LABELS[s.effort]||s.effort) : `${s.speed||0}mph${s.incline?` / ${s.incline}% incline`:''}` }
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OverloadModal({ daySessions, elapsed, completedCount, totalCount, formatTime, onComplete, allExercises }) {
  // Only show overload prompt for workouts that have at least one strength exercise
  const strengthDays = daySessions.filter(ds => {
    const dayExercises = allExercises.filter(e => e.session_id === ds.session_id);
    return dayExercises.some(e => {
      const type = e.exercise_type || e.ex_type || 'strength';
      return type !== 'cardio';
    });
  });

  const [overloads, setOverloads] = useState(
    strengthDays.map(ds => ({ session_id:ds.session_id, day_name:ds.day_name, apply_overload:false }))
  );

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth:480, textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:8 }}>🎉</div>
        <div className="modal-title" style={{ justifyContent:'center' }}>Routine Complete!</div>
        <div style={{ fontSize:13, color:'var(--text2)', marginBottom:20 }}>
          Duration: <strong>{formatTime(elapsed)}</strong> · {completedCount}/{totalCount} exercises
        </div>
        <div style={{ background:'var(--bg3)', borderRadius:8, padding:14, marginBottom:20, textAlign:'left' }}>
          <div style={{ fontWeight:700, marginBottom:10, fontSize:14 }}>Apply Progressive Overload?</div>
          {overloads.length === 0 ? (
            <div style={{ fontSize:13, color:'var(--text3)', padding:'8px 0' }}>
              No strength exercises to apply overload to.
            </div>
          ) : overloads.map((o, i) => (
            <label key={o.session_id} style={{ display:'flex', alignItems:'center', gap:10,
              padding:'8px 0', borderBottom:i<overloads.length-1?'1px solid var(--border)':'none', cursor:'pointer' }}>
              <input type="checkbox" checked={o.apply_overload}
                onChange={e => setOverloads(prev => prev.map((p,pi) => pi===i ? {...p, apply_overload:e.target.checked} : p))}
                style={{ width:16, height:16, accentColor:'var(--accent)' }} />
              <span style={{ fontSize:13, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700,
                textTransform:'uppercase', letterSpacing:0.5 }}>{o.day_name}</span>
            </label>
          ))}
        </div>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          <button className="btn btn-ghost" onClick={() => {
            const all = daySessions.map(ds => ({ session_id:ds.session_id, day_name:ds.day_name, apply_overload:false }));
            onComplete(all);
          }}>
            Skip All
          </button>
          <button className="btn btn-primary" onClick={() => {
            const all = daySessions.map(ds => {
              const found = overloads.find(o => o.session_id === ds.session_id);
              return { session_id:ds.session_id, day_name:ds.day_name, apply_overload: found?.apply_overload || false };
            });
            onComplete(all);
          }}>
            Complete
          </button>
        </div>
      </div>
    </div>
  );
}
