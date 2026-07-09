import React, { useState, useEffect, useMemo } from 'react';
import { MUSCLE_GROUPS } from './BodyDiagram';
import BodyDiagram from './BodyDiagram';

const STORAGE_KEY = 'forge_muscle_aliases';

function loadMuscleData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return MUSCLE_GROUPS.map(mg => {
        const s = parsed.find(p => p.key === mg.key);
        return s ? {...mg, ...s} : {...mg};
      });
    }
  } catch(e) {}
  return MUSCLE_GROUPS.map(mg => ({...mg}));
}

function saveMuscleData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
}

export default function MuscleLibrary() {
  const [muscles,    setMuscles]    = useState(loadMuscleData);
  const [search,     setSearch]     = useState('');
  const [editMuscle, setEditMuscle] = useState(null);
  const [selected,   setSelected]   = useState(null);

  useEffect(() => { saveMuscleData(muscles); }, [muscles]);

  const filtered = useMemo(() => {
    if (!search.trim()) return muscles;
    const q = search.toLowerCase();
    return muscles.filter(m =>
      m.label.toLowerCase().includes(q) ||
      m.key.toLowerCase().includes(q) ||
      (m.aliases||[]).some(a => a.toLowerCase().includes(q))
    );
  }, [muscles, search]);

  const handleSave = (updated) => {
    setMuscles(prev => prev.map(m => m.key === updated.key ? updated : m));
    setEditMuscle(null);
  };

  const handleReset = (key) => {
    const original = MUSCLE_GROUPS.find(mg => mg.key === key);
    if (original) setMuscles(prev => prev.map(m => m.key === key ? {...original} : m));
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 className="section-title">Muscle <span>Library</span></h1>
          <p className="text-muted text-sm">Edit muscle names and add searchable aliases</p>
        </div>
      </div>

      <div style={{ marginBottom:20 }}>
        <input className="form-input" style={{ maxWidth:360 }}
          placeholder="Search by name or alias…"
          value={search} onChange={e => setSearch(e.target.value)} />
        {search && <span className="text-muted text-sm" style={{ marginLeft:12 }}>{filtered.length} result{filtered.length!==1?'s':''}</span>}
      </div>

      {/* Table-style list */}
      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
        {filtered.map((m, i) => (
          <div key={m.key}>
            <div
              style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'10px 14px',
                background: selected===m.key ? 'var(--bg3)' : i%2===0 ? 'var(--bg2)' : 'var(--bg)',
                border:'1px solid var(--border)',
                borderTop: i===0 ? '1px solid var(--border)' : 'none',
                cursor:'pointer', transition:'background 0.12s',
              }}
              onClick={() => setSelected(selected===m.key ? null : m.key)}
            >
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:16,
                textTransform:'uppercase', letterSpacing:0.5, minWidth:140 }}>{m.label}</div>
              <div style={{ flex:1, display:'flex', flexWrap:'wrap', gap:4 }}>
                {(m.aliases||[]).slice(0,5).map((a,i) => (
                  <span key={i} style={{ background:'var(--bg4)', border:'1px solid var(--border)',
                    borderRadius:99, padding:'1px 8px', fontSize:11, color:'var(--text3)' }}>{a}</span>
                ))}
                {(m.aliases||[]).length > 5 && (
                  <span style={{ fontSize:11, color:'var(--text3)' }}>+{m.aliases.length-5} more</span>
                )}
              </div>
              <button className="btn btn-ghost btn-sm"
                onClick={e => { e.stopPropagation(); setEditMuscle({...m, aliases:[...(m.aliases||[])]}) }}>
                Edit
              </button>
            </div>

            {/* Expanded row */}
            {selected === m.key && (
              <div style={{ padding:'16px 20px', background:'var(--bg3)', borderLeft:'3px solid var(--accent)',
                border:'1px solid var(--border)', borderTop:'none' }}>
                <BodyDiagram primaryMuscles={[m.key]} secondaryMuscles={[]} size="small" />
                <button className="btn btn-ghost btn-sm" style={{ marginTop:10 }}
                  onClick={() => handleReset(m.key)}>Reset to defaults</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editMuscle && <EditModal muscle={editMuscle} onSave={handleSave} onClose={() => setEditMuscle(null)} />}
    </div>
  );
}

function EditModal({ muscle, onSave, onClose }) {
  const [label,    setLabel]    = useState(muscle.label);
  const [aliases,  setAliases]  = useState([...(muscle.aliases||[])]);
  const [newAlias, setNewAlias] = useState('');

  const addAlias = () => {
    const t = newAlias.trim().toLowerCase();
    if (!t || aliases.includes(t)) return;
    setAliases([...aliases, t]);
    setNewAlias('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Edit: {muscle.key}</div>

        <div className="form-group">
          <label className="form-label">Display Label</label>
          <input className="form-input" value={label} onChange={e => setLabel(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Aliases</label>
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8 }}>
            All names that will find this muscle when searching
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10, minHeight:32 }}>
            {aliases.map((a,i) => (
              <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5,
                background:'var(--bg4)', border:'1px solid var(--border)',
                borderRadius:99, padding:'3px 10px', fontSize:12, color:'var(--text)' }}>
                {a}
                <button onClick={() => setAliases(aliases.filter((_,j) => j!==i))}
                  style={{ background:'none', border:'none', color:'var(--text3)',
                    cursor:'pointer', padding:0, fontSize:14 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input className="form-input" value={newAlias}
              onChange={e => setNewAlias(e.target.value)}
              onKeyDown={e => e.key==='Enter' && addAlias()}
              placeholder="Type alias and press Enter…" style={{ flex:1 }} />
            <button className="btn btn-secondary" onClick={addAlias}>Add</button>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            if (!label.trim()) return alert('Label required');
            onSave({...muscle, label:label.trim(), aliases});
          }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}
