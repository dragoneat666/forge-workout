import React, { useState, useMemo } from 'react';
import { MUSCLE_GROUPS } from './BodyDiagram';

function loadSavedMuscles() {
  try {
    const s = localStorage.getItem('forge_muscle_aliases');
    if (s) {
      const p = JSON.parse(s);
      return MUSCLE_GROUPS.map(mg => { const m = p.find(x => x.key === mg.key); return m ? {...mg,...m} : {...mg}; });
    }
  } catch(e) {}
  return MUSCLE_GROUPS.map(mg => ({...mg}));
}

export default function MuscleExplorer({ exercises }) {
  const [hovered,  setHovered]  = useState(null);
  const [selected, setSelected] = useState(null);
  const muscleData = useMemo(() => loadSavedMuscles(), []);

  // Lazy import BodyDiagram to avoid circular dep issues with large SVG data
  const [BodyDiagram, setBodyDiagram] = useState(null);
  React.useEffect(() => {
    import('./BodyDiagram').then(m => setBodyDiagram(() => m.default));
  }, []);

  const exercisesForMuscle = useMemo(() => {
    if (!selected) return [];
    return exercises.filter(e =>
      (e.primary_muscles||[]).includes(selected) ||
      (e.secondary_muscles||[]).includes(selected)
    );
  }, [selected, exercises]);

  const selectedMuscle = muscleData.find(m => m.key === selected);
  const handleClick = key => setSelected(selected === key ? null : key);

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 className="section-title">Muscle <span>Explorer</span></h1>
          <p className="text-muted text-sm">Hover a muscle to highlight · Click to see exercises</p>
        </div>
      </div>

      <div className="explorer-layout">
        <div className="card" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'20px 12px' }}>
          {BodyDiagram ? (
            <BodyDiagram
              primaryMuscles={selected ? [selected] : []}
              secondaryMuscles={[]}
              hoveredMuscle={hovered}
              onMuscleClick={handleClick}
              size="normal"
            />
          ) : (
            <div style={{ color:'var(--text3)', fontSize:13 }}>Loading diagram...</div>
          )}

          <div style={{ minHeight:24, textAlign:'center' }}>
            {(hovered || selected) && (
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:17, fontWeight:800,
                letterSpacing:1, textTransform:'uppercase',
                color: selected ? 'var(--accent)' : 'var(--text)' }}>
                {muscleData.find(m => m.key === (hovered||selected))?.label || (hovered||selected)}
              </div>
            )}
            {!hovered && !selected && (
              <div style={{ fontSize:12, color:'var(--text3)' }}>Click a muscle on the diagram or a label below</div>
            )}
          </div>

          {/* Muscle label grid */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, justifyContent:'center', maxWidth:500 }}>
            {muscleData.map(m => (
              <button key={m.key}
                onMouseEnter={() => setHovered(m.key)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleClick(m.key)}
                style={{
                  padding:'3px 10px', borderRadius:99, border:'1px solid',
                  borderColor: selected===m.key ? 'var(--accent)' : hovered===m.key ? '#ffffff50' : 'var(--border)',
                  background:  selected===m.key ? 'var(--accent)' : hovered===m.key ? '#ffffff12' : 'transparent',
                  color:       selected===m.key ? '#000' : 'var(--text2)',
                  fontSize:11, fontWeight:600, cursor:'pointer',
                  transition:'all 0.12s', textTransform:'uppercase', letterSpacing:0.5,
                }}>{m.label}</button>
            ))}
          </div>
        </div>

        {/* Exercise panel */}
        <div className="sticky-panel">
          {!selected ? (
            <div className="card" style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:36, marginBottom:12 }}>👆</div>
              <div style={{ color:'var(--text2)', fontSize:14 }}>Click a muscle to see exercises that target it</div>
            </div>
          ) : (
            <div className="card">
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:22,
                textTransform:'uppercase', letterSpacing:1, color:'var(--accent)', marginBottom:4 }}>
                {selectedMuscle?.label || selected}
              </div>
              {selectedMuscle?.aliases?.length > 0 && (
                <div style={{ fontSize:12, color:'var(--text3)', marginBottom:12 }}>
                  Also known as: {selectedMuscle.aliases.slice(0,5).join(', ')}
                </div>
              )}
              <button className="btn btn-ghost btn-sm" style={{ marginBottom:14 }} onClick={() => setSelected(null)}>
                ← Clear
              </button>

              {exercisesForMuscle.length === 0 && (
                <div style={{ color:'var(--text3)', fontSize:13 }}>No exercises found for this muscle.</div>
              )}

              {/* Primary exercises */}
              {exercisesForMuscle.filter(e => (e.primary_muscles||[]).includes(selected)).length > 0 && (<>
                <div style={{ fontSize:10, letterSpacing:1.5, textTransform:'uppercase',
                  color:'#ff8c5a', marginBottom:6, fontWeight:700 }}>
                  Primary ({exercisesForMuscle.filter(e => (e.primary_muscles||[]).includes(selected)).length})
                </div>
                {exercisesForMuscle
                  .filter(e => (e.primary_muscles||[]).includes(selected))
                  .map(ex => <ExRow key={ex.id} ex={ex} primary />)}
              </>)}

              {/* Secondary exercises */}
              {exercisesForMuscle.filter(e =>
                !(e.primary_muscles||[]).includes(selected) &&
                (e.secondary_muscles||[]).includes(selected)
              ).length > 0 && (<>
                <div style={{ fontSize:10, letterSpacing:1.5, textTransform:'uppercase',
                  color:'#c8db00', marginBottom:6, marginTop:14, fontWeight:700 }}>
                  Secondary ({exercisesForMuscle.filter(e => !(e.primary_muscles||[]).includes(selected)).length})
                </div>
                {exercisesForMuscle
                  .filter(e => !(e.primary_muscles||[]).includes(selected) && (e.secondary_muscles||[]).includes(selected))
                  .map(ex => <ExRow key={ex.id} ex={ex} primary={false} />)}
              </>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExRow({ ex, primary }) {
  return (
    <div style={{ padding:'8px 0', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15,
          textTransform:'uppercase', letterSpacing:0.5 }}>{ex.name}</div>
        <div style={{ fontSize:11, color:'var(--text3)' }}>
          {ex.exercise_type === 'cardio' ? 'Cardio' : 'Strength'}
        </div>
      </div>
      <span className={`tag ${primary ? 'tag-primary' : 'tag-secondary'}`}>
        {primary ? 'Primary' : 'Secondary'}
      </span>
    </div>
  );
}
