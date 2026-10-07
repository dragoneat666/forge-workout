import React, { useState, useEffect } from 'react';
import BodyDiagram, { MUSCLE_GROUPS } from './BodyDiagram';
import EntryModal from './EntryModal';
import ActiveWorkout from './ActiveWorkout';

export default function DayDetail({ day, exercises, onBack, onReload, api }) {
  const [showAdd,       setShowAdd]       = useState(false);
  const [editEntry,     setEditEntry]     = useState(null);
  const [sessions,      setSessions]      = useState([]);
  const [editMode,      setEditMode]      = useState(false);
  const [editSession,   setEditSession]   = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [loadingSess,   setLoadingSess]   = useState(true);

  const entries = day.entries || [];

  const loadSessions = () => {
    api.get(`/days/${day.id}/sessions`).then(s => { setSessions(s); setLoadingSess(false); });
  };

  useEffect(() => { loadSessions(); }, [day.id]);

  const handleDeleteSession = async (sessionId, sessionNum) => {
    if (!window.confirm(`Delete Session ${sessionNum}? This cannot be undone.`)) return;
    await api.del(`/sessions/${sessionId}`);
    loadSessions();
  };

  const allPrimary   = [...new Set(entries.flatMap(e => e.primary_muscles||[]))];
  const allSecondary = [...new Set(entries.flatMap(e => e.secondary_muscles||[]))].filter(m => !allPrimary.includes(m));

  // Build counts for intensity coloring
  const primaryCounts   = {};
  const secondaryCounts = {};
  entries.forEach(e => {
    (e.primary_muscles||[]).forEach(m => { primaryCounts[m]   = (primaryCounts[m]   || 0) + 1; });
    (e.secondary_muscles||[]).forEach(m => { secondaryCounts[m] = (secondaryCounts[m] || 0) + 1; });
  });

  const [dragIdx,     setDragIdx]     = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const handleDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed='move'; };
  const handleDragOver  = (e, idx) => { e.preventDefault(); e.dataTransfer.dropEffect='move'; setDragOverIdx(idx); };
  const handleDrop = async (e, dropIdx) => {
    e.preventDefault();
    if (dragIdx===null||dragIdx===dropIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    const reordered = [...entries];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setDragIdx(null); setDragOverIdx(null);
    await api.put(`/days/${day.id}/entries/reorder`, { ids: reordered.map(e => e.id) });
    onReload();
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  const handleAdd    = async d => { await api.post(`/days/${day.id}/entries`, d); setShowAdd(false); onReload(); };
  const handleEdit   = async d => { await api.put(`/entries/${editEntry.id}`, d); setEditEntry(null); onReload(); };
  const handleDelete = async id => { if (!window.confirm('Remove this exercise?')) return; await api.del(`/entries/${id}`); onReload(); };

  const handleBeginWorkout = async () => {
    // Check for in-progress session first
    const inProgress = sessions.find(s => !s.completed_at);
    if (inProgress) {
      if (window.confirm(`You have Session ${inProgress.session_number} in progress. Resume it?`)) {
        setActiveSession(inProgress);
        return;
      }
    }
    const session = await api.post(`/days/${day.id}/sessions`, {});
    setActiveSession(session);
  };

  const handleSessionComplete = () => {
    setActiveSession(null);
    loadSessions();
    onReload();
  };

  const formatDate = dt => {
    const d = new Date(dt);
    return `${d.getMonth()+1}-${d.getDate()}-${d.getFullYear()}`;
  };

  const formatDuration = secs => {
    if (!secs) return '';
    const m = Math.floor(secs/60), s = secs%60;
    return `${m}m ${s}s`;
  };

  // If there's an active session, show the workout view
  if (activeSession) {
    return (
      <ActiveWorkout
        session={activeSession}
        day={day}
        exercises={exercises}
        savedProgress={activeSession.progress_data || {}}
        onComplete={handleSessionComplete}
        onBack={() => setActiveSession(null)}
        api={api}
      />
    );
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <div className="flex-center gap-12">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
          <div>
            <h1 className="section-title" style={{ marginBottom:0 }}>{day.name}</h1>
            {day.description && <div className="text-muted text-sm">{day.description}</div>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(true)}>+ Exercise</button>
          <button className="btn btn-primary" onClick={handleBeginWorkout}>▶ Begin Workout</button>
        </div>
      </div>

      <div className="detail-layout">
        <div>
          {entries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💪</div>
              <h3 style={{ marginBottom:8, color:'var(--text2)' }}>No exercises yet</h3>
              <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => setShowAdd(true)}>+ Add First Exercise</button>
            </div>
          ) : (
            <div className="entry-list">
              {entries.map((entry, i) => {
                const isCardio   = entry.exercise_type==='cardio' || entry.ex_type==='cardio';
                const isExpanded = expandedEntry === entry.id;
                return (
                  <div key={entry.id}
                    className={`entry-row ${dragIdx===i?'dragging':''} ${dragOverIdx===i&&dragIdx!==i?'drag-over':''}`}
                    draggable
                    onDragStart={e => handleDragStart(e, i)}
                    onDragOver={e => handleDragOver(e, i)}
                    onDrop={e => handleDrop(e, i)}
                    onDragEnd={handleDragEnd}>
                    <div className="flex-between">
                      <div className="drag-handle" onClick={e=>e.stopPropagation()} style={{ marginRight:4 }}>⠿</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div className="entry-name">{entry.exercise_name}</div>
                          <span className={`tag ${isCardio?'tag-secondary':'tag-primary'}`} style={{ fontSize:10 }}>
                            {isCardio?'Cardio':'Strength'}
                          </span>
                        </div>
                        <div className="entry-stats">
                          {isCardio ? (<>
                            {entry.distance>0 && <span className="entry-stat"><strong>{entry.distance}</strong> {entry.distance_unit}</span>}
                            {entry.duration_minutes>0 && <span className="entry-stat"><strong>{entry.duration_minutes}</strong> min</span>}
                          </>) : (<>
                            <span className="entry-stat"><strong>{entry.weight}</strong> lbs</span>
                            <span className="entry-stat"><strong>{entry.sets}</strong> sets × <strong>{entry.reps}</strong> reps</span>
                            {entry.training_type
                              ? <span className={`training-badge ${entry.training_type}`}>{entry.training_type==='endurance'?'Endurance':'Strength'} Training</span>
                              : <span className="training-badge" title="Edit this exercise to pick Strength or Endurance Training">No training type</span>}
                            <span className="increase-badge">+{entry.weight_increase_value}{entry.weight_increase_type==='percent'?'%':' lbs'} next</span>
                            {!!(entry.last_set_bump===1||entry.last_set_bump===true) && (
                              <span className="increase-badge" style={{ color:'var(--accent)', background:'#e8ff0015', borderColor:'#e8ff0040' }}>
                                🔥 +{entry.last_set_bump_value}{entry.last_set_bump_type==='percent'?'%':' lbs'} last set
                              </span>
                            )}
                          </>)}
                        </div>
                        <div className="muscle-chips" style={{ marginTop:6 }}>
                          {(entry.primary_muscles||[]).map(m => <span key={m} className="tag tag-primary">{m.replace(/_/g,' ')}</span>)}
                          {(entry.secondary_muscles||[]).map(m => <span key={m} className="tag tag-secondary">{m.replace(/_/g,' ')}</span>)}
                        </div>
                        {/* Cardio stage pills */}
                        {isCardio && Array.isArray(entry.cardio_stages) && entry.cardio_stages.length > 0 && (
                          <div style={{ display:'flex', gap:4, marginTop:8, flexWrap:'wrap' }}>
                            {entry.cardio_stages.map((s, i) => {
                              const fmt = secs => `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
                              const label = entry.cardio_mode === 'outdoor'
                                ? `${fmt(s.duration_seconds||0)} — ${s.effort||'moderate'}`
                                : `${fmt(s.duration_seconds||0)} — ${s.speed||0}mph${s.incline ? ` / ${s.incline}% incline` : ''}`;
                              return (
                                <div key={i} style={{
                                  padding:'3px 10px', borderRadius:6, fontSize:11, fontWeight:600,
                                  background:'var(--bg4)', border:'1px solid var(--border)', color:'var(--text2)',
                                }}>{label}</div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="entry-actions">
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                          title={isExpanded ? 'Collapse' : 'Expand'}>
                          {isExpanded ? '▲' : '▼'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditEntry(entry)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(entry.id)}>✕</button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ marginTop:14, borderTop:'1px solid var(--border)', paddingTop:14 }}>
                        {entry.exercise_description && (
                          <p style={{ fontSize:13, color:'var(--text2)', marginBottom:10, lineHeight:1.6 }}>
                            {entry.exercise_description}
                          </p>
                        )}
                        {entry.image_path && (
                          <img src={entry.image_path} alt={entry.exercise_name}
                            style={{ maxWidth:'100%', maxHeight:300, borderRadius:8, objectFit:'contain', background:'var(--bg3)' }} />
                        )}
                        {!entry.exercise_description && !entry.image_path && (
                          <div style={{ color:'var(--text3)', fontSize:13 }}>No description or image yet. Edit the exercise in the library to add one.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Session History */}
          <div style={{ marginTop:32 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div className="section-title" style={{ fontSize:16, margin:0 }}>Session <span>History</span></div>
              {sessions.length > 0 && (
                <button className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setEditMode(e => !e)}>
                  {editMode ? '✓ Done' : '✏️ Edit'}
                </button>
              )}
            </div>
            {loadingSess ? (
              <div className="text-muted text-sm">Loading...</div>
            ) : sessions.length === 0 ? (
              <div style={{ color:'var(--text3)', fontSize:13, padding:'16px 0' }}>No sessions yet — hit Begin Workout to log your first session.</div>
            ) : (
              <div className="entry-list">
                {[...sessions].reverse().map(s => (
                  <div key={s.id} className="card-sm" style={{ marginBottom:8 }}>
                    <div className="flex-between">
                      <div>
                        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:16, textTransform:'uppercase' }}>
                          Session {s.session_number} ({formatDate(s.started_at)})
                        </div>
                        <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
                          {s.completed_at ? `Completed · ${formatDuration(s.duration_seconds)}` : '⚡ In progress'}
                          {s.notes ? <span style={{ marginLeft:6, color:'var(--accent)', fontStyle:'italic' }}>· {s.notes}</span> : null}
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {s.completed_at
                          ? <span style={{ fontSize:11, color:'var(--green)', background:'#34c75920', border:'1px solid #34c75940', borderRadius:99, padding:'2px 8px' }}>✓ Done</span>
                          : <button className="btn btn-primary btn-sm" onClick={() => setActiveSession(s)}>▶ Resume</button>
                        }
                        {editMode && <>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditSession(s)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSession(s.id, s.session_number)}>Delete</button>
                        </>}
                      </div>
                    </div>
                    {s.exercises && s.exercises.length > 0 && (
                      <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:5 }}>
                        {s.exercises.map(e => <SessionExerciseChip key={e.id} ex={e} />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Muscle diagram panel */}
        <div className="sticky-panel">
          <div className="card" style={{ textAlign:'center' }}>
            <div style={{ fontSize:10, letterSpacing:2, textTransform:'uppercase', color:'var(--text3)', marginBottom:12 }}>Muscles Worked</div>
            <BodyDiagram
              primaryMuscles={allPrimary}
              secondaryMuscles={allSecondary}
              primaryCounts={primaryCounts}
              secondaryCounts={secondaryCounts}
              size="normal"
            />
            {entries.length === 0 && <div style={{ marginTop:10, fontSize:12, color:'var(--text3)' }}>Add exercises to see muscles</div>}
          </div>
        </div>
      </div>

      {showAdd   && <EntryModal title="Add Exercise"  exercises={exercises} onSave={handleAdd}  onClose={() => setShowAdd(false)} />}
      {editEntry && <EntryModal title="Edit Exercise" exercises={exercises} initial={editEntry} onSave={handleEdit} onClose={() => setEditEntry(null)} />}

      {/* Session edit modal */}
      {editSession && (
        <SessionEditModal
          session={editSession}
          onSave={async (updates) => {
            await fetch(`/api/sessions/${editSession.id}/edit`, {
              method:'PUT', headers:{'Content-Type':'application/json'},
              body: JSON.stringify(updates),
            });
            setEditSession(null); loadSessions();
          }}
          onClose={() => setEditSession(null)}
        />
      )}
    </div>
  );
}

function SessionExerciseChip({ ex }) {
  const [showNote, setShowNote] = useState(false);
  const isCardio   = (ex.exercise_type || ex.ex_type || 'strength') === 'cardio';
  const isTemp     = !!ex.temporary;
  const hasNote    = !!(ex.note && String(ex.note).trim());
  const hasHeavy   = ex.last_set_bump === 1 || ex.last_set_bump === true;
  const completed  = !!ex.completed;

  // Build set breakdown label
  const getWeightLabel = () => {
    if (isCardio) {
      const parts = [];
      if (ex.duration_minutes > 0) parts.push(`${ex.duration_minutes}min`);
      if (ex.distance > 0) parts.push(`${ex.distance}${ex.distance_unit||'mi'}`);
      return parts.join(' · ') || '';
    }
    if (!ex.weight) return '';
    if (hasHeavy && ex.entry_id) {
      // Calculate set breakdown
      const sets    = parseInt(ex.sets) || 3;
      const base    = parseFloat(ex.weight) || 0;
      const bumpVal = parseFloat(ex.last_set_bump_value) || 10;
      const lastW   = ex.last_set_bump_type === 'percent'
        ? Math.round(base * (1 + bumpVal/100) * 4) / 4
        : base + bumpVal;
      const normalSets = sets - 1;
      if (normalSets > 0 && lastW !== base) {
        return `${base}lbs ×${normalSets}, ${lastW}lbs 🔥`;
      }
    }
    return `${ex.weight}lbs`;
  };

  const weightLabel = getWeightLabel();

  return (
    <div style={{ position:'relative' }}>
      <span style={{
        display:'inline-flex', alignItems:'center', gap:5,
        fontSize:11, padding:'3px 10px', borderRadius:99,
        background: completed ? '#34c75920' : isTemp ? '#4af2' : 'var(--bg4)',
        border: `1px solid ${completed ? '#34c75940' : isTemp ? '#4af4' : 'var(--border)'}`,
        color: completed ? 'var(--green)' : isTemp ? '#8af' : 'var(--text3)',
      }}>
        {ex.exercise_name}
        {weightLabel ? ` · ${weightLabel}` : ''}
        {isTemp && <span style={{ fontSize:9, opacity:0.7 }}> (added)</span>}
        {hasNote && (
          <button onClick={() => setShowNote(s => !s)}
            style={{ background:'none', border:'none', cursor:'pointer', padding:0,
              fontSize:12, lineHeight:1, color: completed ? 'var(--green)' : 'var(--accent)' }}
            title="View note">📝</button>
        )}
      </span>
      {showNote && hasNote && (
        <div
          onClick={() => setShowNote(false)}
          style={{
            position:'absolute', bottom:'calc(100% + 4px)', left:0, zIndex:100,
            background:'var(--bg2)', border:'1px solid var(--accent)', borderRadius:8,
            padding:'8px 12px', fontSize:12, color:'var(--text2)', lineHeight:1.5,
            maxWidth:260, minWidth:160, boxShadow:'0 4px 16px rgba(0,0,0,0.4)',
            cursor:'pointer', whiteSpace:'pre-wrap',
          }}>
          <div style={{ fontSize:10, color:'var(--accent)', marginBottom:4, fontWeight:700 }}>NOTE</div>
          {String(ex.note)}
        </div>
      )}
    </div>
  );
}

function SessionEditModal({ session, onSave, onClose }) {
  const toLocalDate = dt => {
    if (!dt) return '';
    const d = new Date(dt);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const [date,     setDate]     = useState(toLocalDate(session.started_at));
  const [duration, setDuration] = useState(Math.round((session.duration_seconds||0)/60));
  const [notes,    setNotes]    = useState(session.notes||'');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth:400 }} onClick={e=>e.stopPropagation()}>
        <div className="modal-title">Edit Session {session.session_number}</div>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input type="date" className="form-input" value={date} onChange={e=>setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Duration (minutes)</label>
          <input type="number" className="form-input" min="0" value={duration}
            onChange={e=>setDuration(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <input type="text" className="form-input" value={notes}
            placeholder="e.g. felt strong today"
            onChange={e=>setNotes(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave({
            date: date ? new Date(date).toISOString() : null,
            duration_seconds: parseInt(duration||0)*60,
            notes,
          })}>Save</button>
        </div>
      </div>
    </div>
  );
}
