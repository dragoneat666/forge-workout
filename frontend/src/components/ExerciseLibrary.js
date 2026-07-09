import React, { useState, useMemo, useEffect } from 'react';
import ModelViewer from './ModelViewer';
import BodyDiagram, { MUSCLE_GROUPS } from './BodyDiagram';

function loadSavedMuscles() {
  try {
    const s = localStorage.getItem('forge_muscle_aliases');
    if (s) { const p=JSON.parse(s); return MUSCLE_GROUPS.map(mg=>{const m=p.find(x=>x.key===mg.key);return m?{...mg,...m}:{...mg};}); }
  } catch(e) {}
  return MUSCLE_GROUPS.map(mg=>({...mg}));
}

export default function ExerciseLibrary({ exercises, onReload, api }) {
  const [search,         setSearch]         = useState('');
  const [filterMuscles,  setFilterMuscles]  = useState([]);  // multi-select
  const [openGroup,     setOpenGroup]     = useState(null); // accordion
  const [filterType,     setFilterType]     = useState('');
  const [filterEquipment,setFilterEquipment] = useState([]);  // selected equipment ids
  const [selected,       setSelected]       = useState(null);
  const [showCreate,     setShowCreate]     = useState(false);
  const [editEx,         setEditEx]         = useState(null);
  const [allEquipment,   setAllEquipment]   = useState([]);

  const muscleData = useMemo(() => loadSavedMuscles(), []);
  const [availableModels, setAvailableModels] = useState([]);

  useEffect(() => {
    fetch('/api/models').then(r => r.json()).then(setAvailableModels).catch(() => {});
  }, []);

  useEffect(() => { api.get('/equipment').then(setAllEquipment); }, []);

  const toggleEquipmentFilter = (id) => {
    setFilterEquipment(prev => prev.includes(id) ? prev.filter(x => x!==id) : [...prev, id]);
  };

  const filtered = useMemo(() => {
    let list = exercises;
    if (search.trim()) list = list.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
    if (filterMuscles.length > 0) {
      list = list.filter(e => {
        const allMuscles = [...(e.primary_muscles||[]), ...(e.secondary_muscles||[])];
        return filterMuscles.every(m => allMuscles.includes(m));
      });
    }
    if (filterType)   list = list.filter(e => e.exercise_type === filterType);
    if (filterEquipment.length > 0) {
      list = list.filter(e => {
        const exEquipIds = (e.equipment||[]).map(eq => eq.id);
        // Subset match: exercise requirements must be within selected equipment
        return exEquipIds.length === 0 || exEquipIds.every(id => filterEquipment.includes(id));
      });
    }
    return list;
  }, [exercises, search, filterMuscles, filterType, filterEquipment]);

  const handleDelete = async (id, name) => {
    // First check if used in routines
    const res = await fetch(`/api/exercises/${id}`, { method:'DELETE' });
    if (res.status === 409) {
      const data = await res.json();
      if (!window.confirm(`"${name}" is used in ${data.usedCount} workout routine${data.usedCount!==1?'s':''}. Delete anyway? It will be removed from those routines.`)) return;
      await fetch(`/api/exercises/${id}?force=1`, { method:'DELETE' });
    }
    onReload();
  };

  const handleImageUpload = async (exId, file) => {
    const formData = new FormData();
    formData.append('image', file);
    await fetch(`/api/exercises/${exId}/image`, { method:'POST', body:formData });
    onReload();
    if (selected?.id === exId) {
      const updated = await api.get(`/exercises`);
      setSelected(updated.find(e => e.id === exId) || null);
    }
  };

  const handleDeleteImage = async exId => {
    await api.del(`/exercises/${exId}/image`);
    onReload();
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h1 className="section-title">Exercise <span>Library</span></h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Custom Exercise</button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:10, flexWrap:'wrap' }}>
        <input className="form-input" style={{ maxWidth:260 }} placeholder="Search exercises…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <button className={`btn btn-sm ${filterMuscles.length > 0 ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setOpenGroup(openGroup ? null : 'upper')}>
          💪 Muscles {filterMuscles.length > 0 ? `(${filterMuscles.length})` : ''}
        </button>
        {filterMuscles.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilterMuscles([])}>Clear Muscles</button>
        )}
        <select className="form-select" style={{ maxWidth:140 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All types</option>
          <option value="strength">Strength</option>
          <option value="cardio">Cardio</option>
        </select>
        <span className="text-muted text-sm" style={{ alignSelf:'center' }}>{filtered.length} exercises</span>
      </div>

      {/* Muscle accordion */}
      {openGroup && (
        <MuscleAccordion
          selected={filterMuscles}
          openGroup={openGroup}
          setOpenGroup={setOpenGroup}
          onChange={setFilterMuscles}
          muscleData={muscleData}
        />
      )}

      {/* Active muscle chips */}
      {filterMuscles.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
          {filterMuscles.map(key => {
            const m = muscleData.find(mg => mg.key === key);
            return (
              <span key={key} style={{
                display:'inline-flex', alignItems:'center', gap:5,
                background:'var(--accent)', color:'#000',
                borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:700,
              }}>
                {m?.label || key}
                <button onClick={() => setFilterMuscles(prev => prev.filter(k => k !== key))}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'#000', fontSize:14, lineHeight:1, padding:0 }}>×</button>
              </span>
            );
          })}
        </div>
      )}

      {/* Equipment filter */}
      {allEquipment.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text3)', marginBottom:6 }}>
            Filter by Equipment
            {filterEquipment.length > 0 && (
              <button onClick={() => setFilterEquipment([])}
                style={{ marginLeft:10, background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:10, fontWeight:700 }}>
                Clear
              </button>
            )}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
            {allEquipment.map(eq => (
              <button key={eq.id}
                onClick={() => toggleEquipmentFilter(eq.id)}
                style={{
                  padding:'4px 12px', borderRadius:99, border:'1px solid', cursor:'pointer', fontSize:12,
                  fontWeight:600, transition:'all 0.12s',
                  borderColor: filterEquipment.includes(eq.id) ? 'var(--accent)' : 'var(--border)',
                  background:  filterEquipment.includes(eq.id) ? 'var(--accent)' : 'transparent',
                  color:       filterEquipment.includes(eq.id) ? '#000' : 'var(--text2)',
                }}>{eq.name}</button>
            ))}
          </div>

        </div>
      )}

      {/* Table-style list */}
      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
        {filtered.map((ex, i) => {
          const isExpanded = selected?.id === ex.id;
          const getLabel = key => muscleData.find(g=>g.key===key)?.label || key.replace(/_/g,' ');
          return (
            <div key={ex.id}>
              <div style={{
                display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                background: isExpanded ? 'var(--bg3)' : i%2===0 ? 'var(--bg2)' : 'var(--bg)',
                border:'1px solid var(--border)', borderTop: i===0 ? '1px solid var(--border)' : 'none',
                cursor:'pointer', transition:'background 0.12s',
              }} onClick={() => setSelected(isExpanded ? null : ex)}>
                {/* Name */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:16,
                    textTransform:'uppercase', letterSpacing:0.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {ex.name}
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                    <span style={{ fontSize:10, color: ex.exercise_type==='cardio' ? '#4af' : '#ff8c5a',
                      background: ex.exercise_type==='cardio' ? '#1a4a6a' : '#2a1510', borderRadius:99, padding:'1px 7px',
                      border:'1px solid', borderColor: ex.exercise_type==='cardio' ? '#4af4' : '#ff6b3540' }}>
                      {ex.exercise_type==='cardio' ? 'Cardio' : 'Strength'}
                    </span>
                    {(ex.primary_muscles||[]).map(m => <span key={m} className="tag tag-primary" style={{ fontSize:10 }}>{getLabel(m)}</span>)}
                    {(ex.secondary_muscles||[]).map(m => <span key={m} className="tag tag-secondary" style={{ fontSize:10 }}>{getLabel(m)}</span>)}
                    {ex.image_path && <span style={{ fontSize:10, color:'var(--text3)' }}>📷</span>}
                    {(ex.equipment||[]).map(eq => (
                      <span key={eq.id} style={{ fontSize:10, color:'#8af', background:'#8af2', border:'1px solid #8af4',
                        borderRadius:99, padding:'1px 7px' }}>{eq.name}</span>
                    ))}
                  </div>
                </div>
                <span style={{ color:'var(--text3)', fontSize:14, flexShrink:0 }}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {/* Expanded */}
              {isExpanded && (
                <div style={{ padding:'16px 20px', background:'var(--bg3)', border:'1px solid var(--border)',
                  borderTop:'none', borderLeft:'3px solid var(--accent)' }}>

                  <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-start', marginBottom:14 }}>
                    <div style={{ flex:1 }}>
                      <BodyDiagram primaryMuscles={ex.primary_muscles||[]} secondaryMuscles={ex.secondary_muscles||[]} size="small" />
                    </div>
                    <div style={{ flex:2, minWidth:200 }}>
                      {ex.description && (
                        <p style={{ fontSize:13, color:'var(--text2)', marginBottom:12, lineHeight:1.6 }}>{ex.description}</p>
                      )}
                      {ex.image_path && (
                        <div style={{ marginBottom:10 }}>
                          <img src={ex.image_path} alt={ex.name}
                            style={{ maxWidth:'100%', maxHeight:240, borderRadius:8, objectFit:'contain', background:'var(--bg2)', display:'block' }} />
                          <button className="btn btn-danger btn-sm" style={{ marginTop:6 }}
                            onClick={e => { e.stopPropagation(); handleDeleteImage(ex.id); }}>Remove Image</button>
                        </div>
                      )}
                      {!ex.image_path && (
                        <label style={{ cursor:'pointer' }}>
                          <input type="file" accept="image/*,.gif" style={{ display:'none' }}
                            onChange={e => { if(e.target.files[0]) handleImageUpload(ex.id, e.target.files[0]); }} />
                          <span className="btn btn-ghost btn-sm">📷 Upload Image/GIF</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* 3D Model Viewer */}
                  <div style={{ marginTop:12, marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase',
                      color:'var(--text3)', marginBottom:6 }}>3D Demo</div>
                    {ex.model_url ? (
                      <div>
                        <ModelViewer modelUrl={ex.model_url} height={280} />
                        <button className="btn btn-danger btn-sm" style={{ marginTop:6 }}
                          onClick={async e => {
                            e.stopPropagation();
                            await fetch(`/api/exercises/${ex.id}/model`, {
                              method:'PUT', headers:{'Content-Type':'application/json'},
                              body:JSON.stringify({ model_url:'' })
                            });
                            onReload();
                          }}>Remove 3D Model</button>
                      </div>
                    ) : availableModels.length > 0 ? (
                      <select className="form-select" style={{ maxWidth:260, fontSize:12 }}
                        onClick={e => e.stopPropagation()}
                        onChange={async e => {
                          if (!e.target.value) return;
                          await fetch(`/api/exercises/${ex.id}/model`, {
                            method:'PUT', headers:{'Content-Type':'application/json'},
                            body:JSON.stringify({ model_url: e.target.value })
                          });
                          onReload();
                        }}>
                        <option value="">— Assign 3D model —</option>
                        {availableModels.map(m => (
                          <option key={m.url} value={m.url}>{m.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontSize:12, color:'var(--text3)' }}>
                        Drop a <code style={{ background:'var(--bg3)', padding:'1px 4px', borderRadius:3 }}>.glb</code> file
                        into <code style={{ background:'var(--bg3)', padding:'1px 4px', borderRadius:3 }}>/data/uploads/</code> to enable 3D demos
                      </div>
                    )}
                  </div>

                  <EquipmentAssign ex={ex} allEquipment={allEquipment} api={api} onReload={onReload} />

                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:10 }}>
                    <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setEditEx({...ex}); }}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDelete(ex.id, ex.name); }}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>


      {showCreate && (
        <ExerciseFormModal title="New Custom Exercise"
          onSave={async data => {
            const { pendingImage, ...rest } = data;
            const created = await api.post('/exercises', rest);
            if (pendingImage && created.id) {
              const fd = new FormData(); fd.append('image', pendingImage);
              await fetch(`/api/exercises/${created.id}/image`, { method:'POST', body:fd });
            }
            setShowCreate(false); onReload();
          }}
          onClose={() => setShowCreate(false)} />
      )}
      {editEx && (
        <ExerciseFormModal title="Edit Exercise" initial={editEx}
          onSave={async data => {
            const { pendingImage, ...rest } = data;
            await api.put(`/exercises/${editEx.id}`, rest);
            if (pendingImage) {
              const fd = new FormData(); fd.append('image', pendingImage);
              await fetch(`/api/exercises/${editEx.id}/image`, { method:'POST', body:fd });
            }
            setEditEx(null); onReload();
          }}
          onClose={() => setEditEx(null)} />
      )}
    </div>
  );
}

function EquipmentAssign({ ex, allEquipment, api, onReload }) {
  const [selected, setSelected] = React.useState((ex.equipment||[]).map(e => e.id));
  const [saving,   setSaving]   = React.useState(false);
  const [dirty,    setDirty]    = React.useState(false);

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
    setDirty(true);
  };

  const save = async (e) => {
    e.stopPropagation();
    setSaving(true);
    await api.put(`/exercises/${ex.id}/equipment`, { equipment_ids: selected });
    setSaving(false); setDirty(false); onReload();
  };

  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ fontSize:10, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text3)', marginBottom:6 }}>Equipment</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:dirty?8:0 }}>
        {allEquipment.map(eq => (
          <button key={eq.id} onClick={e => { e.stopPropagation(); toggle(eq.id); }}
            style={{
              padding:'3px 10px', borderRadius:99, border:'1px solid', cursor:'pointer', fontSize:11,
              fontWeight:600, transition:'all 0.12s',
              borderColor: selected.includes(eq.id) ? '#8af' : 'var(--border)',
              background:  selected.includes(eq.id) ? '#1a3a5a' : 'transparent',
              color:       selected.includes(eq.id) ? '#8af' : 'var(--text3)',
            }}>{eq.name}</button>
        ))}
      </div>
      {dirty && (
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Equipment'}
        </button>
      )}
    </div>
  );
}

function ExerciseFormModal({ title, initial, onSave, onClose }) {
  const [name,           setName]           = useState(initial?.name || '');
  const [primaryMuscles, setPrimaryMuscles] = useState(initial?.primary_muscles || []);
  const [secondaryMuscles,setSecondaryMuscles] = useState(initial?.secondary_muscles || []);
  const [exerciseType,   setExerciseType]   = useState(initial?.exercise_type || 'strength');
  const [description,    setDescription]    = useState(initial?.description || '');
  const [muscleSearch,   setMuscleSearch]   = useState('');
  const [pendingImage,   setPendingImage]   = useState(null);   // File object waiting to upload
  const [imagePreview,   setImagePreview]   = useState(initial?.image_path || null);
  const [formEquipment,  setFormEquipment]  = useState((initial?.equipment||[]).map(e=>e.id));
  const [allEquipment,   setAllEquipment]   = useState([]);
  const muscleData = useMemo(() => loadSavedMuscles(), []);
  const [availableModels, setAvailableModels] = useState([]);

  useEffect(() => {
    fetch('/api/models').then(r => r.json()).then(setAvailableModels).catch(() => {});
  }, []);

  const handleImageSelect = (file) => {
    setPendingImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const filteredMuscles = useMemo(() => {
    if (!muscleSearch.trim()) return muscleData;
    const q = muscleSearch.toLowerCase();
    return muscleData.filter(m => m.label.toLowerCase().includes(q) || (m.aliases||[]).some(a => a.toLowerCase().includes(q)));
  }, [muscleData, muscleSearch]);

  const toggleMuscle = key => {
    if (primaryMuscles.includes(key)) { setPrimaryMuscles(primaryMuscles.filter(m=>m!==key)); setSecondaryMuscles([...secondaryMuscles,key]); }
    else if (secondaryMuscles.includes(key)) { setSecondaryMuscles(secondaryMuscles.filter(m=>m!==key)); }
    else { setPrimaryMuscles([...primaryMuscles,key]); }
  };

  const muscleState = key => {
    if (primaryMuscles.includes(key)) return 'active-primary';
    if (secondaryMuscles.includes(key)) return 'active-secondary';
    return '';
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth:620 }} onClick={e=>e.stopPropagation()}>
        <div className="modal-title">{title}</div>

        <div className="form-row">
          <div className="form-group" style={{ flex:2 }}>
            <label className="form-label">Exercise Name *</label>
            <input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Bulgarian Split Squat" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={exerciseType} onChange={e=>setExerciseType(e.target.value)}>
              <option value="strength">Strength</option>
              <option value="cardio">Cardio</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Description (optional)</label>
          <textarea className="form-input" value={description} onChange={e=>setDescription(e.target.value)}
            placeholder="How to perform this exercise, tips, notes…"
            rows={3} style={{ resize:'vertical' }} />
        </div>

        <div className="form-group">
          <label className="form-label">Image / GIF (optional)</label>
          <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
            {imagePreview ? (
              <div style={{ position:'relative' }}>
                <img src={imagePreview} alt="preview"
                  style={{ maxHeight:120, maxWidth:200, borderRadius:8, objectFit:'contain', background:'var(--bg3)', display:'block' }} />
                <button onClick={() => { setPendingImage(null); setImagePreview(null); }}
                  style={{ position:'absolute', top:4, right:4, background:'rgba(0,0,0,0.7)', border:'none',
                    color:'#fff', borderRadius:99, width:20, height:20, cursor:'pointer', fontSize:12, lineHeight:1 }}>×</button>
              </div>
            ) : null}
            <label style={{ cursor:'pointer' }}>
              <input type="file" accept="image/*,.gif" style={{ display:'none' }}
                onChange={e => { if(e.target.files[0]) handleImageSelect(e.target.files[0]); }} />
              <span className="btn btn-ghost btn-sm">{imagePreview ? '🔄 Change Image' : '📷 Upload Image/GIF'}</span>
            </label>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Muscles</label>
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>
            Click once = <span style={{ color:'#ff8c5a' }}>Primary</span> · Again = <span style={{ color:'#c8db00' }}>Secondary</span> · Again = Remove
          </div>
          <input className="form-input" value={muscleSearch} onChange={e=>setMuscleSearch(e.target.value)}
            placeholder="Search muscles by name or alias…" style={{ marginBottom:8, fontSize:13 }} />
          <div className="muscle-selector">
            {filteredMuscles.map(m => (
              <button key={m.key} className={`muscle-btn ${muscleState(m.key)}`} onClick={()=>toggleMuscle(m.key)} title={(m.aliases||[]).join(', ')}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop:12 }}>
          <BodyDiagram primaryMuscles={primaryMuscles} secondaryMuscles={secondaryMuscles} size="small" />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>{ if(!name.trim()) return alert('Name required'); onSave({name:name.trim(),primary_muscles:primaryMuscles,secondary_muscles:secondaryMuscles,exercise_type:exerciseType,description,pendingImage}); }}>
            Save Exercise
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Muscle Accordion Filter ───────────────────────────────────────────────────
const MUSCLE_GROUPS_ACCORDION = {
  'Upper Body': ['chest','serratus','front_delts','side_delts','rear_delts','traps','mid_back','lats','lower_back','biceps','triceps','forearms'],
  'Lower Body': ['glutes','quads','hamstrings','adductors','abductors','calves','shins','hip_flexors'],
  'Core':       ['abs','obliques'],
};

function MuscleAccordion({ selected, openGroup, setOpenGroup, onChange, muscleData }) {
  const getLabel = key => muscleData.find(m => m.key === key)?.label || key.replace(/_/g,' ');

  const toggleMuscle = key => {
    onChange(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8,
      marginBottom:12, overflow:'hidden' }}>
      {/* Group tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)' }}>
        {Object.keys(MUSCLE_GROUPS_ACCORDION).map(group => {
          const groupKeys    = MUSCLE_GROUPS_ACCORDION[group];
          const selectedInGroup = groupKeys.filter(k => selected.includes(k)).length;
          const isOpen = openGroup === group;
          return (
            <button key={group}
              onClick={() => setOpenGroup(isOpen ? null : group)}
              style={{
                flex:1, padding:'8px 4px', border:'none', cursor:'pointer',
                background: isOpen ? 'var(--bg3)' : 'transparent',
                borderBottom: isOpen ? '2px solid var(--accent)' : '2px solid transparent',
                color: isOpen ? 'var(--accent)' : 'var(--text2)',
                fontSize:12, fontWeight:700, letterSpacing:0.5,
                fontFamily:"'Barlow Condensed',sans-serif", textTransform:'uppercase',
                transition:'all 0.12s',
              }}>
              {group}
              {selectedInGroup > 0 && (
                <span style={{ marginLeft:4, background:'var(--accent)', color:'#000',
                  borderRadius:99, padding:'0 5px', fontSize:10 }}>{selectedInGroup}</span>
              )}
            </button>
          );
        })}
        <button onClick={() => setOpenGroup(null)}
          style={{ padding:'8px 10px', border:'none', background:'transparent',
            color:'var(--text3)', cursor:'pointer', fontSize:14 }}>✕</button>
      </div>

      {/* Muscle chips for open group */}
      {openGroup && MUSCLE_GROUPS_ACCORDION[openGroup] && (
        <div style={{ padding:'10px 12px', display:'flex', flexWrap:'wrap', gap:6 }}>
          {MUSCLE_GROUPS_ACCORDION[openGroup].map(key => {
            const isSelected = selected.includes(key);
            return (
              <button key={key} onClick={() => toggleMuscle(key)}
                style={{
                  padding:'4px 12px', borderRadius:99, border:'1px solid', cursor:'pointer',
                  fontSize:12, fontWeight:600, transition:'all 0.12s',
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  background:  isSelected ? 'var(--accent)' : 'transparent',
                  color:       isSelected ? '#000' : 'var(--text2)',
                }}>{getLabel(key)}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
