import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

export default function WeightTracker({ api }) {
  const [logs,       setLogs]       = useState([]);
  const [weight,     setWeight]     = useState('');
  const [unit,       setUnit]       = useState('lbs');
  const [notes,      setNotes]      = useState('');
  const [date,       setDate]       = useState(new Date().toISOString().split('T')[0]);
  const [editLog,    setEditLog]    = useState(null);
  const [loading,    setLoading]    = useState(true);

  const load = () => api.get('/bodyweight').then(d => { setLogs(d); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!weight) return alert('Enter a weight');
    await api.post('/bodyweight', { weight: parseFloat(weight), unit, notes, logged_at: date });
    setWeight(''); setNotes('');
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    await api.del(`/bodyweight/${id}`);
    load();
  };

  const handleUpdate = async () => {
    await api.put(`/bodyweight/${editLog.id}`, { weight: parseFloat(editLog.weight), unit: editLog.unit, notes: editLog.notes, logged_at: editLog.logged_at });
    setEditLog(null);
    load();
  };

  const chartData = useMemo(() => [...logs].reverse().map(l => ({
    date: new Date(l.logged_at+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}),
    weight: l.weight,
    unit: l.unit,
    fullDate: l.logged_at,
  })), [logs]);

  const latest = logs[0];
  const oldest = logs[logs.length-1];
  const delta  = latest && oldest && logs.length > 1 ? (latest.weight - oldest.weight) : null;
  const minW = chartData.length ? Math.min(...chartData.map(d=>d.weight)) : 0;
  const maxW = chartData.length ? Math.max(...chartData.map(d=>d.weight)) : 100;
  const yMin = Math.floor(minW - 5);
  const yMax = Math.ceil(maxW + 5);

  return (
    <div>
      <div className="flex-between mb-16">
        <h1 className="section-title">Weight <span>Tracker</span></h1>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:24, alignItems:'start' }}>
        {/* Left: chart + history */}
        <div>
          {/* Stats row */}
          {logs.length > 0 && (
            <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
              {[
                { label:'Current', val:`${latest.weight} ${latest.unit}` },
                { label:'Starting', val: oldest ? `${oldest.weight} ${oldest.unit}` : '—' },
                { label:'Change', val: delta !== null ? `${delta>0?'+':''}${delta.toFixed(1)} ${latest.unit}` : '—',
                  color: delta < 0 ? 'var(--green)' : delta > 0 ? 'var(--red)' : 'var(--text)' },
                { label:'Entries', val: logs.length },
              ].map(s => (
                <div key={s.label} className="card-sm" style={{ flex:1, minWidth:100, textAlign:'center' }}>
                  <div style={{ fontSize:10, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text3)', marginBottom:4 }}>{s.label}</div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:800, color: s.color||'var(--accent)' }}>{s.val}</div>
                </div>
              ))}
            </div>
          )}

          {/* Chart */}
          {chartData.length > 1 && (
            <div className="card" style={{ marginBottom:20 }}>
              <div style={{ fontSize:10, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text3)', marginBottom:12 }}>Weight Over Time</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{top:5,right:10,left:0,bottom:5}}>
                  <CartesianGrid stroke="#222230" strokeDasharray="4 4" />
                  <XAxis dataKey="date" tick={{fontSize:10,fill:'#606070'}} />
                  <YAxis domain={[yMin, yMax]} tick={{fontSize:10,fill:'#606070'}} />
                  <Tooltip
                    contentStyle={{background:'#1a1a1f',border:'1px solid #2a2a35',borderRadius:6,fontSize:12}}
                    labelStyle={{color:'#a0a0b0'}}
                    formatter={(val, name, props) => [`${val} ${props.payload?.unit||'lbs'}`, 'Weight']}
                  />
                  {chartData.length > 0 && <ReferenceLine y={chartData[0]?.weight} stroke="#ffffff15" strokeDasharray="3 3" />}
                  <Line type="monotone" dataKey="weight" stroke="#e8ff00" strokeWidth={2.5}
                    dot={{ fill:'#e8ff00', r:4, strokeWidth:0 }}
                    activeDot={{ r:6, fill:'#fff', stroke:'#e8ff00', strokeWidth:2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* History table */}
          <div className="card">
            <div style={{ fontSize:10, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text3)', marginBottom:12 }}>History</div>
            {loading && <div className="text-muted text-sm">Loading…</div>}
            {!loading && logs.length === 0 && (
              <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text3)' }}>
                No weight entries yet. Add your first entry →
              </div>
            )}
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'9px 0', color:'var(--text3)', fontSize:13, width:110 }}>
                      {new Date(log.logged_at+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                    </td>
                    <td style={{ padding:'9px 8px' }}>
                      <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, color: i===0?'var(--accent)':'var(--text)' }}>
                        {log.weight}
                      </span>
                      <span style={{ fontSize:12, color:'var(--text3)', marginLeft:4 }}>{log.unit}</span>
                      {i===0 && <span style={{ marginLeft:8, fontSize:10, background:'var(--accent)', color:'#000', borderRadius:99, padding:'1px 7px', fontWeight:700, letterSpacing:1 }}>LATEST</span>}
                    </td>
                    <td style={{ padding:'9px 0', color:'var(--text3)', fontSize:12, flex:1 }}>{log.notes}</td>
                    <td style={{ padding:'9px 0', textAlign:'right' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditLog({...log})} style={{marginRight:4}}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(log.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: add entry */}
        <div className="sticky-panel">
          <div className="card">
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:18, textTransform:'uppercase', letterSpacing:1, color:'var(--accent)', marginBottom:16 }}>
              Log Weight
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Weight *</label>
                <input className="form-input" type="number" min="0" step="0.1"
                  value={weight} onChange={e=>setWeight(e.target.value)}
                  placeholder="e.g. 185.5"
                  onKeyDown={e=>e.key==='Enter'&&handleAdd()} />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={unit} onChange={e=>setUnit(e.target.value)}>
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input className="form-input" value={notes} onChange={e=>setNotes(e.target.value)}
                placeholder="e.g. morning, after workout…" />
            </div>
            <button className="btn btn-primary" style={{width:'100%'}} onClick={handleAdd}>+ Add Entry</button>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editLog && (
        <div className="modal-backdrop" onClick={()=>setEditLog(null)}>
          <div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Edit Entry</div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={editLog.logged_at} onChange={e=>setEditLog({...editLog,logged_at:e.target.value})} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Weight</label>
                <input className="form-input" type="number" step="0.1" value={editLog.weight} onChange={e=>setEditLog({...editLog,weight:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={editLog.unit} onChange={e=>setEditLog({...editLog,unit:e.target.value})}>
                  <option value="lbs">lbs</option><option value="kg">kg</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={editLog.notes||''} onChange={e=>setEditLog({...editLog,notes:e.target.value})} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setEditLog(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdate}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
