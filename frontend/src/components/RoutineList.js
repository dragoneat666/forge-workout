import React, { useState, useEffect } from 'react';
import BodyDiagram from './BodyDiagram';

export default function RoutineList({ days, onSelectRoutine, onResume, api }) {
  const [routines,   setRoutines]   = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editRoutine,setEditRoutine]= useState(null);
  const [name,       setName]       = useState('');
  const [description,setDescription]= useState('');

  const load = () => api.get('/routines').then(setRoutines).catch(() => setRoutines([]));
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await api.post('/routines', { name:name.trim(), description:description.trim() });
    setName(''); setDescription(''); setShowCreate(false); load();
  };

  const handleDelete = async (id, routineName) => {
    if (!window.confirm(`Delete "${routineName}"? This will also delete all session history for this routine.`)) return;
    try {
      const res = await api.del(`/routines/${id}`);
      if (res.ok) load();
      else alert('Delete failed: ' + (res.error || 'Unknown error'));
    } catch(e) {
      alert('Delete failed: ' + e.message);
    }
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h1 className="section-title">My <span>Routines</span></h1>
        <button className="btn btn-primary" onClick={() => { setName(''); setDescription(''); setShowCreate(true); }}>
          + New Routine
        </button>
      </div>

      {routines.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3 style={{ marginBottom:8, color:'var(--text2)' }}>No routines yet</h3>
          <p>Combine multiple workouts into one full session.</p>
          <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => setShowCreate(true)}>
            + Create First Routine
          </button>
        </div>
      )}

      <div className="day-grid">
        {routines.map(routine => {
          const allEntries = (routine.days||[]).flatMap(d => d.entries||[]);
          const primaryCounts={}, secondaryCounts={};
          allEntries.forEach(e => {
            const pm = Array.isArray(e.primary_muscles) ? e.primary_muscles :
              (typeof e.primary_muscles === 'string' ? JSON.parse(e.primary_muscles||'[]') : []);
            const sm = Array.isArray(e.secondary_muscles) ? e.secondary_muscles :
              (typeof e.secondary_muscles === 'string' ? JSON.parse(e.secondary_muscles||'[]') : []);
            pm.forEach(m => { primaryCounts[m]=(primaryCounts[m]||0)+1; });
            sm.forEach(m => { secondaryCounts[m]=(secondaryCounts[m]||0)+1; });
          });
          const allPrimary   = Object.keys(primaryCounts);
          const allSecondary = Object.keys(secondaryCounts).filter(k => !primaryCounts[k]);
          const totalExercises = allEntries.length;

          return (
            <div key={routine.id} className="day-card" style={{ position:'relative' }}
              onClick={() => onSelectRoutine(routine)}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div className="day-card-title" style={{ margin:0 }}>{routine.name}</div>
                {routine.in_progress_session && (
                  <span style={{ fontSize:10, background:'#ffaa0020', border:'1px solid #ffaa0040',
                    borderRadius:99, padding:'2px 8px', color:'#ffaa00', fontWeight:700, letterSpacing:0.5 }}>
                    ⚡ IN PROGRESS
                  </span>
                )}
              </div>
              {routine.description && <div className="day-card-meta">{routine.description}</div>}
              <div className="day-card-meta">
                {routine.days?.length || 0} workout{(routine.days?.length||0)!==1?'s':''} · {totalExercises} exercise{totalExercises!==1?'s':''}
              </div>
              {(routine.days||[]).length > 0 && (
                <div style={{ margin:'8px 0', display:'flex', flexDirection:'column', gap:3 }}>
                  {routine.days.map(d => (
                    <div key={d.routine_day_id} style={{ fontSize:11, color:'var(--text3)',
                      display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ color:'var(--accent)' }}>▸</span> {d.name}
                      <span style={{ color:'var(--border)' }}>({d.entries?.length||0})</span>
                    </div>
                  ))}
                </div>
              )}
              {allPrimary.length > 0 && (
                <div style={{ margin:'10px 0' }}>
                  <BodyDiagram primaryMuscles={allPrimary} secondaryMuscles={allSecondary}
                    primaryCounts={primaryCounts} secondaryCounts={secondaryCounts} size="small" />
                </div>
              )}
              <div className="day-card-actions" onClick={e => e.stopPropagation()}>
                <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); onSelectRoutine(routine); }}>Open →</button>
                {routine.in_progress_session && onResume && (
                  <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); onResume(routine.in_progress_session.id, routine); }}>▶ Resume</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setEditRoutine({...routine}); }}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDelete(routine.id, routine.name); }}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">New Routine</div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Full Body Day" autoFocus onKeyDown={e => e.key==='Enter' && handleCreate()} />
            </div>
            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <input className="form-input" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Warmup + Upper + Core" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate}>Create</button>
            </div>
          </div>
        </div>
      )}

      {editRoutine && (
        <div className="modal-backdrop" onClick={() => setEditRoutine(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Edit Routine</div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={editRoutine.name} onChange={e => setEditRoutine({...editRoutine, name:e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={editRoutine.description} onChange={e => setEditRoutine({...editRoutine, description:e.target.value})} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditRoutine(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                await api.put(`/routines/${editRoutine.id}`, { name:editRoutine.name, description:editRoutine.description });
                setEditRoutine(null); load();
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
