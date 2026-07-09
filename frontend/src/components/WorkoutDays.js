import React, { useState } from 'react';
import BodyDiagram from './BodyDiagram';
import { MUSCLE_GROUPS } from './BodyDiagram';

function getMuscleIntensity(entries, muscleKey) {
  let primary = 0, secondary = 0;
  (entries||[]).forEach(e => {
    if ((e.primary_muscles||[]).includes(muscleKey)) primary++;
    if ((e.secondary_muscles||[]).includes(muscleKey)) secondary++;
  });
  return { primary, secondary };
}

function intensityColor(count, type) {
  if (count === 0) return null;
  if (type === 'primary') {
    if (count === 1) return 'rgba(255,107,53,0.45)';
    if (count === 2) return 'rgba(255,107,53,0.72)';
    return 'rgba(255,107,53,0.95)';
  } else {
    if (count === 1) return 'rgba(232,255,0,0.3)';
    if (count === 2) return 'rgba(232,255,0,0.55)';
    return 'rgba(232,255,0,0.80)';
  }
}

export default function WorkoutDays({ days, onSelectDay, onReload, api }) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editDay, setEditDay] = useState(null);

  const [dragIdx,    setDragIdx]    = useState(null);
  const [dragOverIdx,setDragOverIdx] = useState(null);

  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  };
  const handleDrop = async (e, dropIdx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    const reordered = [...days];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setDragIdx(null); setDragOverIdx(null);
    await api.put('/days/reorder', { ids: reordered.map(d => d.id) });
    onReload();
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  const handleCreate = async () => {
    if (!name.trim()) return;
    await api.post('/days', { name: name.trim(), description: description.trim() });
    setName(''); setDescription(''); setShowCreate(false);
    onReload();
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this workout day and all its data?')) return;
    await api.del(`/days/${id}`);
    onReload();
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h1 className="section-title">My <span>Workouts</span></h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Workout</button>
      </div>

      {days.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🏋️</div>
          <h3 style={{ marginBottom:8, color:'var(--text2)' }}>No workouts yet</h3>
          <p>Create your first workout to get started.</p>
        </div>
      )}

      <div className="day-grid">
        {days.map((day, i) => {
          const entries = day.entries || [];
          return (
            <div key={day.id}
            className={`day-card ${dragIdx===i?'dragging':''} ${dragOverIdx===i&&dragIdx!==i?'drag-over':''}`}
            draggable
            onDragStart={e => handleDragStart(e, i)}
            onDragOver={e => handleDragOver(e, i)}
            onDrop={e => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelectDay(day)}>
            <div className="drag-handle" style={{ position:'absolute', top:8, right:8 }} onClick={e=>e.stopPropagation()}>⠿</div>
              <div className="day-card-title">{day.name}</div>
              {day.description && <div className="day-card-meta">{day.description}</div>}
              <div className="day-card-meta">{entries.length} exercise{entries.length!==1?'s':''}</div>

              {entries.length > 0 && (
                <div style={{ margin:'12px 0' }}>
                  <IntensityDiagram entries={entries} />
                  <MuscleCountList entries={entries} />
                </div>
              )}

              <div className="day-card-actions" onClick={e => e.stopPropagation()}>
                <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); onSelectDay(day); }}>Open →</button>
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setEditDay({...day}); }}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={e => handleDelete(e, day.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">New Workout</div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Upper Body Dumbbells" autoFocus
                onKeyDown={e => e.key==='Enter' && handleCreate()} />
            </div>
            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <input className="form-input" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Monday push day" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate}>Create</button>
            </div>
          </div>
        </div>
      )}

      {editDay && (
        <div className="modal-backdrop" onClick={() => setEditDay(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Edit Workout</div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={editDay.name} onChange={e => setEditDay({...editDay, name:e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={editDay.description} onChange={e => setEditDay({...editDay, description:e.target.value})} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditDay(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                await api.put(`/days/${editDay.id}`, { name:editDay.name, description:editDay.description });
                setEditDay(null); onReload();
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IntensityDiagram({ entries }) {
  const primaryCounts   = {};
  const secondaryCounts = {};
  MUSCLE_GROUPS.forEach(mg => {
    const { primary, secondary } = getMuscleIntensity(entries, mg.key);
    if (primary > 0)   primaryCounts[mg.key]   = primary;
    if (secondary > 0) secondaryCounts[mg.key] = secondary;
  });
  const allPrimary   = Object.keys(primaryCounts);
  const allSecondary = Object.keys(secondaryCounts).filter(k => !primaryCounts[k]);
  return (
    <BodyDiagram
      primaryMuscles={allPrimary}
      secondaryMuscles={allSecondary}
      primaryCounts={primaryCounts}
      secondaryCounts={secondaryCounts}
      size="small"
    />
  );
}

function MuscleCountList({ entries }) {
  const primaryMap   = {};
  const secondaryMap = {};

  (entries||[]).forEach(e => {
    (e.primary_muscles||[]).forEach(m => { primaryMap[m]   = (primaryMap[m]   || 0) + 1; });
    (e.secondary_muscles||[]).forEach(m => { secondaryMap[m] = (secondaryMap[m] || 0) + 1; });
  });

  const getLabel = key => MUSCLE_GROUPS.find(mg => mg.key === key)?.label || key.replace(/_/g,' ');

  const primEntries = Object.entries(primaryMap).sort((a,b) => b[1]-a[1]);
  const secEntries  = Object.entries(secondaryMap)
    .filter(([k]) => !primaryMap[k])
    .sort((a,b) => b[1]-a[1]);

  if (primEntries.length === 0 && secEntries.length === 0) return null;

  return (
    <div style={{ marginTop:10, fontSize:11 }}>
      {primEntries.length > 0 && (
        <div style={{ marginBottom:4 }}>
          <span style={{ color:'var(--text3)', fontWeight:600, letterSpacing:1, textTransform:'uppercase', fontSize:9 }}>Primary</span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:3 }}>
            {primEntries.map(([k,count]) => (
              <span key={k} style={{
                background: count >= 3 ? 'rgba(255,107,53,0.35)' : count === 2 ? 'rgba(255,107,53,0.22)' : 'rgba(255,107,53,0.12)',
                border: '1px solid rgba(255,107,53,0.4)',
                borderRadius:99, padding:'1px 7px', color:'#ff8c5a', fontSize:10,
              }}>{getLabel(k)} ({count})</span>
            ))}
          </div>
        </div>
      )}
      {secEntries.length > 0 && (
        <div>
          <span style={{ color:'var(--text3)', fontWeight:600, letterSpacing:1, textTransform:'uppercase', fontSize:9 }}>Secondary</span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:3 }}>
            {secEntries.map(([k,count]) => (
              <span key={k} style={{
                background: count >= 3 ? 'rgba(232,255,0,0.25)' : count === 2 ? 'rgba(232,255,0,0.15)' : 'rgba(232,255,0,0.08)',
                border: '1px solid rgba(232,255,0,0.3)',
                borderRadius:99, padding:'1px 7px', color:'#c8db00', fontSize:10,
              }}>{getLabel(k)} ({count})</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
