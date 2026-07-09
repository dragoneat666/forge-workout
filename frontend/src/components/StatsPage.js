import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function StatsPage({ api }) {
  const [exercises, setExercises] = useState([]);
  const [search,    setSearch]    = useState('');
  const [expanded,  setExpanded]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [editMax,   setEditMax]   = useState({});  // exerciseId -> value being edited

  const load = () => {
    setLoading(true);
    api.get('/stats/exercises').then(d => { setExercises(d); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return exercises;
    return exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
  }, [exercises, search]);

  const handleMaxSave = async (exId) => {
    const val = parseFloat(editMax[exId]);
    if (isNaN(val)) return;
    await api.put(`/stats/exercises/${exId}/max`, { max_weight: val });
    setEditMax(prev => { const n={...prev}; delete n[exId]; return n; });
    load();
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h1 className="section-title">My <span>Stats</span></h1>
      </div>

      <div style={{ marginBottom:20 }}>
        <input className="form-input" style={{ maxWidth:360 }}
          placeholder="Search exercises…" value={search} onChange={e => setSearch(e.target.value)} />
        {search && <span className="text-muted text-sm" style={{ marginLeft:12 }}>{filtered.length} results</span>}
      </div>

      {loading && <div className="text-muted text-sm">Loading…</div>}

      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
        {filtered.map((ex, i) => {
          const isExpanded = expanded === ex.id;
          const hasData    = ex.current_weight > 0;
          const isEditingMax = editMax[ex.id] !== undefined;

          return (
            <div key={ex.id}>
              {/* Row */}
              <div style={{
                display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                background: isExpanded ? 'var(--bg3)' : i%2===0 ? 'var(--bg2)' : 'var(--bg)',
                border:'1px solid var(--border)',
                borderTop: i===0 ? '1px solid var(--border)' : 'none',
                cursor:'pointer', transition:'background 0.12s',
              }} onClick={() => setExpanded(isExpanded ? null : ex.id)}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:16,
                    textTransform:'uppercase', letterSpacing:0.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {ex.name}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                    {ex.exercise_type === 'cardio' ? 'Cardio' : 'Strength'}
                    {hasData ? ` · Current: ${ex.current_weight} lbs` : ' · No data yet'}
                  </div>
                </div>
                {hasData && (
                  <div style={{ display:'flex', gap:16, alignItems:'center', flexShrink:0 }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'var(--text3)', letterSpacing:1, textTransform:'uppercase' }}>Current</div>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, color:'var(--accent)' }}>
                        {ex.current_weight}<span style={{ fontSize:11, fontWeight:400 }}> lbs</span>
                      </div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'var(--text3)', letterSpacing:1, textTransform:'uppercase' }}>Max</div>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, color:'var(--text)' }}>
                        {ex.max_weight || '—'}{ex.max_weight ? <span style={{ fontSize:11, fontWeight:400 }}> lbs</span> : ''}
                      </div>
                    </div>
                  </div>
                )}
                <span style={{ color:'var(--text3)', fontSize:14, flexShrink:0 }}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding:'16px 20px', background:'var(--bg3)', border:'1px solid var(--border)',
                  borderTop:'none', borderLeft:'3px solid var(--accent)' }}>

                  <div style={{ display:'flex', gap:24, flexWrap:'wrap', marginBottom:16 }}>
                    {/* Current Weight */}
                    <div className="card-sm" style={{ minWidth:140 }}>
                      <div style={{ fontSize:10, color:'var(--text3)', letterSpacing:1.5, textTransform:'uppercase', marginBottom:4 }}>Current Weight</div>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:28, color:'var(--accent)' }}>
                        {ex.current_weight > 0 ? `${ex.current_weight} lbs` : '—'}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Next scheduled weight</div>
                    </div>

                    {/* Max Weight — editable */}
                    <div className="card-sm" style={{ minWidth:200 }}>
                      <div style={{ fontSize:10, color:'var(--text3)', letterSpacing:1.5, textTransform:'uppercase', marginBottom:4 }}>Personal Max</div>
                      {isEditingMax ? (
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                          <input
                            className="form-input"
                            type="number" min="0" step="0.5"
                            value={editMax[ex.id]}
                            onChange={e => setEditMax(prev => ({...prev, [ex.id]: e.target.value}))}
                            style={{ width:100 }}
                            autoFocus
                            onKeyDown={e => { if(e.key==='Enter') handleMaxSave(ex.id); if(e.key==='Escape') setEditMax(prev => {const n={...prev}; delete n[ex.id]; return n;}); }}
                          />
                          <button className="btn btn-primary btn-sm" onClick={() => handleMaxSave(ex.id)}>Save</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditMax(prev => {const n={...prev}; delete n[ex.id]; return n;})}>✕</button>
                        </div>
                      ) : (
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:28, color:'var(--text)' }}>
                            {ex.max_weight > 0 ? `${ex.max_weight} lbs` : '—'}
                          </div>
                          <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setEditMax(prev => ({...prev, [ex.id]: ex.max_weight || ''})); }}>
                            Edit
                          </button>
                        </div>
                      )}
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Auto-bumps if current exceeds it</div>
                    </div>
                  </div>

                  {/* Progress graph */}
                  <ExerciseGraph exId={ex.id} api={api} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExerciseGraph({ exId, api }) {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api.get(`/stats/exercises/${exId}/history`).then(setHistory);
  }, [exId]);

  if (history === null) return <div style={{ color:'var(--text3)', fontSize:12 }}>Loading history…</div>;
  if (history.length === 0) return <div style={{ color:'var(--text3)', fontSize:12 }}>No workout history yet for this exercise.</div>;
  if (history.length === 1) return (
    <div style={{ fontSize:12, color:'var(--text3)' }}>
      1 session logged — {history[0].weight} lbs. Complete more sessions to see a graph.
    </div>
  );

  const data = history.map((h, i) => ({
    session: `S${i+1}`,
    weight: h.weight,
    date: new Date(h.completed_at).toLocaleDateString('en-US', { month:'short', day:'numeric' }),
  }));

  return (
    <div>
      <div style={{ fontSize:10, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>
        Weight Progress ({history.length} sessions)
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top:5, right:10, left:0, bottom:5 }}>
          <CartesianGrid stroke="#222230" strokeDasharray="4 4" />
          <XAxis dataKey="session" tick={{ fontSize:10, fill:'#606070' }} />
          <YAxis tick={{ fontSize:10, fill:'#606070' }} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background:'#1a1a1f', border:'1px solid #2a2a35', borderRadius:6, fontSize:11 }}
            labelStyle={{ color:'#a0a0b0' }}
            formatter={(val, name, props) => [`${val} lbs`, 'Weight']}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) return `${label} — ${payload[0].payload.date}`;
              return label;
            }}
          />
          <Line type="monotone" dataKey="weight" stroke="#e8ff00" strokeWidth={2.5}
            dot={{ fill:'#e8ff00', r:4, strokeWidth:0 }}
            activeDot={{ r:6, fill:'#fff', stroke:'#e8ff00', strokeWidth:2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
