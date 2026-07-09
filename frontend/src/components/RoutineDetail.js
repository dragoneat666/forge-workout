import React, { useState, useEffect } from 'react';
import ActiveRoutine from './ActiveRoutine';

export default function RoutineDetail({ routine: initialRoutine, days, onBack, onReload, api, initialSession=null }) {
  const [routine,       setRoutine]       = useState(initialRoutine);
  const [showAddDay,    setShowAddDay]    = useState(false);
  const [activeSession, setActiveSession] = useState(initialSession);
  const [sessions,      setSessions]      = useState([]);
  const [editMode,      setEditMode]      = useState(false);
  const [editSession,   setEditSession]   = useState(null);
  const [dragIdx,       setDragIdx]       = useState(null);
  const [dragOverIdx,   setDragOverIdx]   = useState(null);

  const load = () => {
    api.get('/routines').then(rs => {
      const updated = rs.find(r => r.id === routine.id);
      if (updated) setRoutine(updated);
    });
    api.get(`/routines/${routine.id}/sessions`).then(setSessions);
  };
  useEffect(() => { load(); }, [routine.id]);

  const handleAddDay = async (dayId) => {
    await api.post(`/routines/${routine.id}/days`, { day_id: dayId });
    setShowAddDay(false); load();
  };

  const handleRemoveDay = async (routineDayId) => {
    if (!window.confirm('Remove this workout from the routine?')) return;
    await api.del(`/routines/${routine.id}/days/${routineDayId}`);
    load();
  };

  const handleBeginRoutine = async () => {
    const session = await api.post(`/routines/${routine.id}/sessions`, {});
    setActiveSession(session);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${routine.name}" and all its session history? This cannot be undone.`)) return;
    try {
      await api.del(`/routines/${routine.id}`);
      onBack();
    } catch(e) { alert('Delete failed: ' + e.message); }
  };

  const handleDeleteSession = async (sessionId, sessionNum) => {
    if (!window.confirm(`Delete Session ${sessionNum}? This cannot be undone.`)) return;
    try {
      await api.del(`/routine-sessions/${sessionId}`);
      load();
    } catch(e) { alert('Delete failed: ' + e.message); }
  };

  const handleResume = async (sessionId) => {
    try {
      const session = await api.get(`/routine-sessions/${sessionId}/resume`);
      setActiveSession(session);
    } catch(e) { alert('Could not resume session: ' + e.message); }
  };

  const handleSessionComplete = () => {
    setActiveSession(null); load();
  };

  const handleDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed='move'; };
  const handleDragOver  = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = async (e, dropIdx) => {
    e.preventDefault();
    if (dragIdx===null || dragIdx===dropIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    const reordered = [...(routine.days||[])];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setDragIdx(null); setDragOverIdx(null);
    await api.put(`/routines/${routine.id}/days/reorder`, { ids: reordered.map(d => d.routine_day_id) });
    load();
  };

  const formatDate = dt => {
    const d = new Date(dt);
    return `${d.getMonth()+1}-${d.getDate()}-${d.getFullYear()}`;
  };

  const formatDuration = secs => {
    if (!secs) return '';
    return `${Math.floor(secs/60)}m ${secs%60}s`;
  };

  const availableDays = days.filter(d => !(routine.days||[]).some(rd => rd.id === d.id));

  if (activeSession) {
    return (
      <ActiveRoutine
        session={activeSession}
        routine={routine}
        days={days}
        savedProgress={activeSession.saved_progress || {}}
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
            <h1 className="section-title" style={{ marginBottom:0 }}>{routine.name}</h1>
            {routine.description && <div className="text-muted text-sm">{routine.description}</div>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAddDay(true)}>+ Add Workout</button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>
          <button className="btn btn-primary" onClick={handleBeginRoutine}
            disabled={!(routine.days?.length > 0)}>▶ Begin Routine</button>
        </div>
      </div>

      {/* Workout days in routine */}
      {(routine.days||[]).length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>Add workouts to this routine to get started.</p>
          <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => setShowAddDay(true)}>
            + Add Workout
          </button>
        </div>
      ) : (
        <div className="entry-list" style={{ marginBottom:24 }}>
          {(routine.days||[]).map((d, i) => (
            <div key={d.routine_day_id}
              className={`entry-row ${dragIdx===i?'dragging':''} ${dragOverIdx===i&&dragIdx!==i?'drag-over':''}`}
              draggable onDragStart={e=>handleDragStart(e,i)} onDragOver={e=>handleDragOver(e,i)}
              onDrop={e=>handleDrop(e,i)} onDragEnd={()=>{setDragIdx(null);setDragOverIdx(null);}}>
              <div className="flex-between">
                <div className="drag-handle" style={{ marginRight:8 }}>⠿</div>
                <div style={{ flex:1 }}>
                  <div className="entry-name">{d.name}</div>
                  <div className="entry-stats">
                    <span className="entry-stat">{d.entries?.length||0} exercise{(d.entries?.length||0)!==1?'s':''}</span>
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleRemoveDay(d.routine_day_id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Session history */}
      <div style={{ marginTop:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div className="section-title" style={{ fontSize:16, margin:0 }}>Session <span>History</span></div>
          {sessions.length > 0 && (
            <button className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setEditMode(e => !e)}>
              {editMode ? '✓ Done' : '✏️ Edit'}
            </button>
          )}
        </div>
        {sessions.length === 0 ? (
          <div style={{ color:'var(--text3)', fontSize:13, padding:'12px 0' }}>No sessions yet.</div>
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
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {!s.completed_at && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleResume(s.id)}>
                        ▶ Resume
                      </button>
                    )}
                    {s.completed_at && (
                      <span style={{ fontSize:11, color:'var(--green)', background:'#34c75920',
                        border:'1px solid #34c75940', borderRadius:99, padding:'2px 8px' }}>✓ Done</span>
                    )}
                    {editMode && <>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditSession(s)}>Edit</button>
                      <button className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteSession(s.id, s.session_number)}>Delete</button>
                    </>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session edit modal */}
      {editSession && (
        <SessionEditModal
          session={editSession}
          onSave={async (updates) => {
            await fetch(`/api/routine-sessions/${editSession.id}/edit`, {
              method:'PUT', headers:{'Content-Type':'application/json'},
              body: JSON.stringify(updates),
            });
            setEditSession(null); load();
          }}
          onClose={() => setEditSession(null)}
        />
      )}

      {/* Add workout modal */}
      {showAddDay && (
        <div className="modal-backdrop" onClick={() => setShowAddDay(false)}>
          <div className="modal" style={{ maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Workout to Routine</div>
            {availableDays.length === 0 ? (
              <div style={{ color:'var(--text3)', fontSize:13, padding:'8px 0' }}>
                All your workouts are already in this routine.
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:320, overflowY:'auto' }}>
                {availableDays.map(d => (
                  <button key={d.id} className="btn btn-ghost" style={{ textAlign:'left', justifyContent:'flex-start' }}
                    onClick={() => handleAddDay(d.id)}>
                    <div>
                      <div style={{ fontWeight:700 }}>{d.name}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>{d.entries?.length||0} exercises</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAddDay(false)}>Close</button>
            </div>
          </div>
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
  const [date,     setDate]     = React.useState(toLocalDate(session.started_at));
  const [duration, setDuration] = React.useState(Math.round((session.duration_seconds||0)/60));

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
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave({
            date: date ? new Date(date+'T12:00:00').toISOString() : null,
            duration_seconds: parseInt(duration||0)*60,
          })}>Save</button>
        </div>
      </div>
    </div>
  );
}
