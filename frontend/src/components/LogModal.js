import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function LogModal({ entry, onSave, onClose, api }) {
  const isCardio = entry.exercise_type === 'cardio' || entry.ex_type === 'cardio';

  const [weight,    setWeight]    = useState(entry.weight ?? 0);
  const [sets,      setSets]      = useState(entry.sets ?? 3);
  const [reps,      setReps]      = useState(entry.reps ?? 10);
  const [distance,  setDistance]  = useState(entry.distance || '');
  const [distUnit,  setDistUnit]  = useState(entry.distance_unit || 'miles');
  const [duration,  setDuration]  = useState(entry.duration_minutes || '');
  const [speed,     setSpeed]     = useState(entry.target_speed || '');
  const [notes,     setNotes]     = useState('');
  const [history,   setHistory]   = useState([]);

  useEffect(() => {
    api.get(`/logs/exercise/${entry.exercise_id}`).then(logs => setHistory([...logs].reverse()));
  }, [entry.exercise_id]);

  const nextWeight = () => {
    if (entry.weight_increase_type === 'percent')
      return parseFloat(weight) * (1 + parseFloat(entry.weight_increase_value)/100);
    return parseFloat(weight) + parseFloat(entry.weight_increase_value||0);
  };

  const handleSave = () => {
    if (isCardio && !distance && !duration) return alert('Enter at least a distance or duration');
    onSave({
      exercise_id: entry.exercise_id,
      exercise_type: entry.exercise_type || 'strength',
      weight: parseFloat(weight)||0, sets: parseInt(sets)||1, reps: parseInt(reps)||1,
      distance: parseFloat(distance)||0, distance_unit: distUnit,
      duration_minutes: parseFloat(duration)||0, target_speed: parseFloat(speed)||0,
      notes,
    });
  };

  const chartData = history.map(l => ({
    date: new Date(l.completed_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}),
    weight: l.weight,
    distance: l.distance,
    duration: l.duration_minutes,
  }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth:540 }} onClick={e=>e.stopPropagation()}>
        <div className="modal-title">✓ Log: {entry.exercise_name}</div>

        {isCardio ? (
          <>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Distance</label>
                <input className="form-input" type="number" min="0" step="0.01"
                  value={distance} onChange={e=>setDistance(e.target.value)} placeholder="0.0" />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={distUnit} onChange={e=>setDistUnit(e.target.value)}>
                  <option value="miles">Miles</option>
                  <option value="km">Km</option>
                  <option value="meters">Meters</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Duration (min)</label>
                <input className="form-input" type="number" min="0" step="1"
                  value={duration} onChange={e=>setDuration(e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Actual Speed <span style={{color:'var(--text3)',fontWeight:400}}>(opt.)</span></label>
                <input className="form-input" type="number" min="0" step="0.1"
                  value={speed} onChange={e=>setSpeed(e.target.value)} placeholder="mph" />
              </div>
            </div>
            {/* Target reminder */}
            {(entry.distance > 0 || entry.duration_minutes > 0) && (
              <div style={{ padding:'8px 12px', background:'var(--bg3)', borderRadius:6, marginBottom:12, fontSize:12, color:'var(--text3)' }}>
                Target: {entry.distance > 0 ? `${entry.distance} ${entry.distance_unit}` : ''}
                {entry.distance > 0 && entry.duration_minutes > 0 ? ' · ' : ''}
                {entry.duration_minutes > 0 ? `${entry.duration_minutes} min` : ''}
                {entry.target_speed > 0 ? ` · ${entry.target_speed} mph` : ''}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Weight (lbs)</label>
                <input className="form-input" type="number" min="0" step="0.25"
                  value={weight} onChange={e=>setWeight(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Sets</label>
                <input className="form-input" type="number" min="1"
                  value={sets} onChange={e=>setSets(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Reps</label>
                <input className="form-input" type="number" min="1"
                  value={reps} onChange={e=>setReps(e.target.value)} />
              </div>
            </div>
            {/* Set breakdown with heavy last set */}
        {(() => {
          const hasHeavyLast = entry.last_set_bump === 1 || entry.last_set_bump === true;
          const numSets = parseInt(sets) || 3;
          const baseW = parseFloat(weight) || 0;
          const bumpW = hasHeavyLast
            ? (entry.last_set_bump_type === 'percent'
                ? Math.round(baseW * (1 + parseFloat(entry.last_set_bump_value||10)/100) * 4)/4
                : baseW + parseFloat(entry.last_set_bump_value||10))
            : null;
          return (
            <div style={{ background:'var(--bg3)', borderRadius:8, padding:'10px 12px', marginBottom:12, fontSize:12 }}>
              <div style={{ fontWeight:600, color:'var(--text3)', marginBottom:6, fontSize:10, letterSpacing:1, textTransform:'uppercase' }}>Set Breakdown</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {Array.from({length: numSets}).map((_, i) => {
                  const isLast = i === numSets - 1;
                  const setW = isLast && hasHeavyLast ? bumpW : baseW;
                  return (
                    <div key={i} style={{
                      padding:'4px 10px', borderRadius:6, border:'1px solid',
                      borderColor: isLast && hasHeavyLast ? 'var(--accent)' : 'var(--border)',
                      background: isLast && hasHeavyLast ? '#e8ff0015' : 'transparent',
                      textAlign:'center',
                    }}>
                      <div style={{ fontSize:10, color:'var(--text3)' }}>Set {i+1}{isLast && hasHeavyLast ? ' 🔥' : ''}</div>
                      <div style={{ fontWeight:700, color: isLast && hasHeavyLast ? 'var(--accent)' : 'var(--text)', fontSize:14 }}>{setW} lbs</div>
                      <div style={{ fontSize:10, color:'var(--text3)' }}>{reps} reps</div>
                    </div>
                  );
                })}
              </div>
              {hasHeavyLast && <div style={{ marginTop:8, fontSize:11, color:'var(--text3)' }}>🔥 Heavy last set: +{entry.last_set_bump_value}{entry.last_set_bump_type==='percent'?'%':' lbs'}</div>}
            </div>
          );
        })()}
        <div style={{ padding:'8px 12px', background:'var(--bg3)', borderRadius:6, marginBottom:12, fontSize:12 }}>
              <span style={{color:'var(--text3)'}}>Next session target: </span>
              <strong style={{color:'var(--green)', fontSize:14}}>{Math.round(nextWeight()*4)/4} lbs</strong>
              <span style={{color:'var(--text3)'}}> (+{entry.weight_increase_value}{entry.weight_increase_type==='percent'?'%':' lbs'})</span>
            </div>
          </>
        )}

        <div className="form-group">
          <label className="form-label">Notes (optional)</label>
          <input className="form-input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="How did it feel?" />
        </div>

        {/* Progress chart */}
        {chartData.length > 1 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text3)', marginBottom:6 }}>
              {isCardio ? 'Distance History' : 'Weight Progress'}
            </div>
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="#2a2a35" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{fontSize:9,fill:'#606070'}} />
                <YAxis tick={{fontSize:9,fill:'#606070'}} />
                <Tooltip contentStyle={{background:'#1a1a1f',border:'1px solid #2a2a35',borderRadius:6,fontSize:11}}
                  labelStyle={{color:'#a0a0b0'}} itemStyle={{color:'#e8ff00'}} />
                <Line type="monotone" dataKey={isCardio?'distance':'weight'} stroke="#e8ff00" strokeWidth={2} dot={{fill:'#e8ff00',r:3}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Log</button>
        </div>
      </div>
    </div>
  );
}
