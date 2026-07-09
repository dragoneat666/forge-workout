import React, { useState } from 'react';

export function ExerciseConflictModal({ data, onComplete, onClose }) {
  const { exercises, conflicts, new_count } = data;
  const [applyAll,    setApplyAll]    = useState(null);
  const [perConflict, setPerConflict] = useState({});
  const [currentIdx,  setCurrentIdx]  = useState(0);

  const current     = conflicts[currentIdx];
  const allResolved = conflicts.length === 0 || applyAll !== null ||
    conflicts.every(c => perConflict[c.name]);

  const handleResolve = (name, resolution) => {
    setPerConflict(prev => ({ ...prev, [name]: resolution }));
    if (currentIdx < conflicts.length - 1) setCurrentIdx(i => i + 1);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth:600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Import Exercises</div>

        <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
          {[
            { label:'New',       val: new_count,       color:'var(--green)' },
            { label:'Conflicts', val: conflicts.length, color: conflicts.length ? '#ffaa00' : 'var(--text3)' },
            { label:'Total',     val: exercises.length, color:'var(--text2)' },
          ].map(s => (
            <div key={s.label} className="card-sm" style={{ flex:1, textAlign:'center', minWidth:90 }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:24, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:10, color:'var(--text3)', letterSpacing:1, textTransform:'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {conflicts.length === 0 ? (
          <div style={{ textAlign:'center', padding:'16px 0', color:'var(--green)', fontSize:14 }}>
            ✓ No conflicts — {new_count} new exercises will be added cleanly!
          </div>
        ) : (<>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>
              Apply to ALL {conflicts.length} conflicts:
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {[
                { val:'overwrite', label:'Overwrite Mine',    color:'#ff6b6b' },
                { val:'keep',      label:'Keep Mine',          color:'var(--green)' },
                { val:'duplicate', label:'Add as Duplicate',   color:'var(--accent)' },
              ].map(opt => (
                <button key={opt.val} onClick={() => setApplyAll(applyAll===opt.val ? null : opt.val)}
                  style={{
                    padding:'6px 14px', borderRadius:6, border:'1px solid', cursor:'pointer', fontSize:12, fontWeight:600,
                    borderColor: applyAll===opt.val ? opt.color : 'var(--border)',
                    background:  applyAll===opt.val ? opt.color+'22' : 'transparent',
                    color:       applyAll===opt.val ? opt.color : 'var(--text2)',
                  }}>{opt.label}</button>
              ))}
            </div>
          </div>

          {!applyAll && current && (
            <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:14, marginBottom:14 }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:16,
                textTransform:'uppercase', marginBottom:10, color:'#ffaa00' }}>
                ⚠ Conflict {currentIdx+1}/{conflicts.length}: {current.name}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                {[
                  { label:'YOUR VERSION', data:current.yours,    border:'var(--green)' },
                  { label:'IMPORTED',     data:current.imported, border:'#ffaa00' },
                ].map(side => (
                  <div key={side.label} style={{ padding:10, background:'var(--bg2)', borderRadius:6, border:`1px solid ${side.border}40` }}>
                    <div style={{ fontSize:9, letterSpacing:1.5, color:'var(--text3)', marginBottom:6, fontWeight:700 }}>{side.label}</div>
                    <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.7 }}>
                      <div><strong>Type:</strong> {side.data.exercise_type}</div>
                      <div><strong>Primary:</strong> {side.data.primary_muscles?.join(', ')||'—'}</div>
                      <div><strong>Secondary:</strong> {side.data.secondary_muscles?.join(', ')||'—'}</div>
                      <div><strong>Desc:</strong> {side.data.description||'—'}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[
                  { val:'overwrite', label:'Overwrite Mine',  color:'#ff6b6b' },
                  { val:'keep',      label:'Keep Mine',        color:'var(--green)' },
                  { val:'duplicate', label:'Add as Duplicate', color:'var(--accent)', sub:`"${current.name} (Imported)"` },
                ].map(opt => (
                  <button key={opt.val} onClick={() => handleResolve(current.name, opt.val)}
                    style={{
                      padding:'8px 14px', borderRadius:6, border:`1px solid ${opt.color}60`,
                      background: perConflict[current.name]===opt.val ? opt.color+'22' : 'transparent',
                      color: opt.color, cursor:'pointer', fontSize:12, fontWeight:600,
                    }}>
                    {opt.label}
                    {opt.sub && <div style={{ fontSize:10, opacity:0.7 }}>→ {opt.sub}</div>}
                  </button>
                ))}
              </div>
              <div style={{ marginTop:8, fontSize:11, color:'var(--text3)' }}>
                {currentIdx+1} of {conflicts.length} · {conflicts.filter(c=>perConflict[c.name]).length} resolved
              </div>
            </div>
          )}
        </>)}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onComplete({ applyAll: applyAll||'keep', perConflict })}
            disabled={!allResolved && conflicts.length > 0}>
            Import {new_count} New + Apply Resolutions
          </button>
        </div>
      </div>
    </div>
  );
}

export function EquipmentConflictModal({ data, onComplete, onClose }) {
  const { equipment, conflicts, new_count } = data;
  const [applyAll,    setApplyAll]    = useState(null);
  const [currentIdx,  setCurrentIdx]  = useState(0);

  const current     = conflicts[currentIdx];
  const allResolved = conflicts.length === 0 || applyAll !== null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth:500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Import Equipment</div>

        <div style={{ display:'flex', gap:12, marginBottom:16 }}>
          {[
            { label:'New',       val: new_count,        color:'var(--green)' },
            { label:'Conflicts', val: conflicts.length,  color: conflicts.length ? '#ffaa00' : 'var(--text3)' },
            { label:'Total',     val: equipment.length,  color:'var(--text2)' },
          ].map(s => (
            <div key={s.label} className="card-sm" style={{ flex:1, textAlign:'center' }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:24, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:10, color:'var(--text3)', letterSpacing:1, textTransform:'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {conflicts.length === 0 ? (
          <div style={{ textAlign:'center', padding:'16px 0', color:'var(--green)', fontSize:14 }}>
            ✓ No conflicts — {new_count} new items will be added!
          </div>
        ) : (<>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>
              Apply to ALL {conflicts.length} conflicts:
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {[
                { val:'keep',      label:'Keep Mine',         color:'var(--green)' },
                { val:'overwrite', label:'Use Repo Version',  color:'#ffaa00' },
              ].map(opt => (
                <button key={opt.val} onClick={() => setApplyAll(applyAll===opt.val ? null : opt.val)}
                  style={{
                    padding:'6px 14px', borderRadius:6, border:'1px solid', cursor:'pointer', fontSize:12, fontWeight:600,
                    borderColor: applyAll===opt.val ? opt.color : 'var(--border)',
                    background:  applyAll===opt.val ? opt.color+'22' : 'transparent',
                    color:       applyAll===opt.val ? opt.color : 'var(--text2)',
                  }}>{opt.label}</button>
              ))}
            </div>
          </div>

          {!applyAll && current && (
            <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:14, marginBottom:14 }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:16,
                textTransform:'uppercase', marginBottom:10, color:'#ffaa00' }}>
                ⚠ Conflict {currentIdx+1}/{conflicts.length}: {current.name}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                {[
                  { label:'YOUR VERSION', desc:current.yours,    border:'var(--green)' },
                  { label:'REPO VERSION', desc:current.imported, border:'#ffaa00' },
                ].map(side => (
                  <div key={side.label} style={{ padding:10, background:'var(--bg2)', borderRadius:6, border:`1px solid ${side.border}40` }}>
                    <div style={{ fontSize:9, letterSpacing:1.5, color:'var(--text3)', marginBottom:4, fontWeight:700 }}>{side.label}</div>
                    <div style={{ fontSize:12, color:'var(--text2)' }}>{side.desc}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {[
                  { val:'keep',      label:'Keep Mine',        color:'var(--green)' },
                  { val:'overwrite', label:'Use Repo Version', color:'#ffaa00' },
                ].map(opt => (
                  <button key={opt.val} onClick={() => {
                    setApplyAll(opt.val);
                  }}
                    style={{
                      padding:'8px 14px', borderRadius:6, border:`1px solid ${opt.color}60`,
                      background:'transparent', color:opt.color, cursor:'pointer', fontSize:12, fontWeight:600,
                    }}>{opt.label}</button>
                ))}
              </div>
            </div>
          )}
        </>)}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onComplete({ applyAll: applyAll||'keep' })}
            disabled={!allResolved && conflicts.length > 0}>
            Import {new_count} New + Apply Resolutions
          </button>
        </div>
      </div>
    </div>
  );
}
