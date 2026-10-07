import React, { useState, useEffect, useRef } from 'react';
import { ExerciseConflictModal, EquipmentConflictModal } from './ImportConflictModal';

// Percentages of Max used for Endurance and Strength training weights
function TrainingWeightSettings({ api }) {
  const [pcts,   setPcts]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState(null);

  useEffect(() => {
    api.get('/training-weights').then(t => setPcts({ endurance_pct: t.endurance_pct, strength_pct: t.strength_pct })).catch(()=>{});
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    const r = await api.put('/settings', { endurance_pct: pcts.endurance_pct, strength_pct: pcts.strength_pct });
    setSaving(false);
    setMsg(r.error ? { ok:false, text: r.error } : { ok:true, text:'✓ Saved. Linked workout weights were recalculated.' });
  };

  if (!pcts) return null;
  return (
    <div className="card" style={{ marginBottom:20 }}>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:18,
        textTransform:'uppercase', letterSpacing:1, color:'var(--accent)', marginBottom:6 }}>
        Training Weights
      </div>
      <div style={{ fontSize:13, color:'var(--text3)', marginBottom:14 }}>
        Endurance and Strength weights are a percentage of each lift's Max (100%).
      </div>
      <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end' }}>
        {[['endurance_pct','Endurance % of Max'], ['strength_pct','Strength % of Max']].map(([key, label]) => (
          <div key={key} className="form-group" style={{ flex:1, minWidth:150, margin:0 }}>
            <label className="form-label">{label}</label>
            <input type="number" className="form-input" min="1" max="100" step="1" value={pcts[key]}
              onChange={e => setPcts(p => ({ ...p, [key]: e.target.value }))} />
          </div>
        ))}
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
      {msg && <div style={{ fontSize:12, marginTop:10, color: msg.ok ? 'var(--green)' : '#ff6b6b' }}>{msg.text}</div>}
    </div>
  );
}

export default function SettingsPage({ api }) {
  const [status,     setStatus]     = useState(null);
  const [settings,   setSettings]   = useState(null);
  const [restoreMsg, setRestoreMsg] = useState(null);
  const [downloading,setDownloading]= useState(null);
  const [backingUp,  setBackingUp]  = useState(false);
  const [backupMsg,  setBackupMsg]  = useState(null);
  const [saving,     setSaving]     = useState(false);
  const jsonRef = useRef();
  const dbRef   = useRef();

  const load = () => {
    api.get('/backup/status').then(s => { setStatus(s); setSettings({ schedule: s.schedule, backup_time: s.backup_time, retain_weeks: s.retain_weeks }); }).catch(()=>{});
  };
  useEffect(() => { load(); }, []);

  const formatDate = dt => dt
    ? new Date(dt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : 'Never';

  const handleDownload = async (type) => {
    setDownloading(type);
    try {
      const url = type === 'data' ? '/api/backup/download-data' : '/api/backup/download-images';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const cd   = res.headers.get('content-disposition') || '';
      const filename = cd.split('filename=')[1]?.replace(/"/g,'') || `forge_backup.zip`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      load();
    } catch(e) { alert('Backup failed: ' + e.message); }
    setDownloading(null);
  };

  const handleBackupNow = async () => {
    setBackingUp(true); setBackupMsg(null);
    try {
      const r = await fetch('/api/backup/now', { method:'POST' });
      const d = await r.json();
      if (r.ok) { setBackupMsg({ type:'success', text:`✓ Backup saved: ${d.data}` }); load(); }
      else setBackupMsg({ type:'error', text:'Backup failed: ' + d.error });
    } catch(e) { setBackupMsg({ type:'error', text: e.message }); }
    setBackingUp(false);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    await api.put('/settings', { backup_schedule: settings.schedule, backup_time: settings.backup_time, backup_retain_weeks: settings.retain_weeks });
    setSaving(false);
    setBackupMsg({ type:'success', text:'✓ Settings saved. New schedule takes effect on next restart.' });
  };

  const handleRestoreJson = async (file) => {
    if (!file) return;
    if (!window.confirm('Restore from JSON backup?\n\nThis will merge backup data with your current data. Existing records with matching IDs will be overwritten.\n\nContinue?')) return;
    setRestoreMsg({ type:'info', text:'Restoring...' });
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res  = await fetch('/api/backup/restore-json', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
      const result = await res.json();
      if (res.ok) setRestoreMsg({ type:'success', text:'✓ Data restored! Refresh the page to see your data.' });
      else setRestoreMsg({ type:'error', text:'Restore failed: ' + result.error });
    } catch(e) { setRestoreMsg({ type:'error', text:'Failed: ' + e.message }); }
    jsonRef.current.value = '';
  };

  const handleRestoreDb = async (file) => {
    if (!file) return;
    if (!window.confirm('Restore from .db backup?\n\nThis will REPLACE your entire database. You will need to run "docker compose restart" after.\n\nThis cannot be undone. Continue?')) return;
    setRestoreMsg({ type:'info', text:'Uploading database...' });
    try {
      const fd = new FormData();
      fd.append('database', file);
      const res = await fetch('/api/backup/restore-db', { method:'POST', body:fd });
      const result = await res.json();
      if (res.ok) setRestoreMsg({ type:'success', text:'✓ Database swapped. Run "docker compose restart" on your server to complete the restore.' });
      else setRestoreMsg({ type:'error', text:'Restore failed: ' + result.error });
    } catch(e) { setRestoreMsg({ type:'error', text:'Failed: ' + e.message }); }
    dbRef.current.value = '';
  };

  const msgStyle = (type) => ({
    padding:'10px 14px', borderRadius:8, marginBottom:12, fontSize:13,
    background: type==='success' ? '#34c75920' : type==='error' ? '#ff3b3020' : '#4af2',
    border: `1px solid ${type==='success' ? '#34c75940' : type==='error' ? '#ff3b3040' : '#4af4'}`,
    color: type==='success' ? 'var(--green)' : type==='error' ? '#ff6b6b' : '#8af',
  });

  return (
    <div>
      <h1 className="section-title">⚙️ <span>Settings</span></h1>

      {/* About */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:18,
          textTransform:'uppercase', letterSpacing:1, color:'var(--accent)', marginBottom:12 }}>About FORGE</div>
        <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:4 }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:26, fontWeight:800, letterSpacing:2 }}>
            ⚡ FORGE Workout Tracker
          </span>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13,
            background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:99,
            padding:'2px 10px', color:'var(--accent)', letterSpacing:1 }}>v0.6</span>
        </div>
        <div style={{ fontSize:13, color:'var(--text3)', marginBottom:12 }}>A self-hosted personal workout tracking application</div>
        <div style={{ background:'#e8ff0010', border:'1px solid #e8ff0030', borderRadius:8, padding:14, marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'var(--accent)', marginBottom:6 }}>
            🤖 AI Disclosure
          </div>
          <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.7, margin:0 }}>
            This application was built with the assistance of <strong style={{ color:'var(--text)' }}>Claude</strong>, an AI assistant by Anthropic.
            All feature decisions, UX choices, and data design were made by the developer through a collaborative process with AI.
          </p>
        </div>
        <div style={{ fontSize:12, color:'var(--text3)', lineHeight:1.8 }}>
          <strong style={{ color:'var(--text2)' }}>Source:</strong>{' '}
          <a href="https://github.com/dragoneat666/forge-workout" target="_blank" rel="noopener noreferrer"
            style={{ color:'var(--accent)', textDecoration:'none' }}>github.com/dragoneat666/forge-workout</a>
        </div>
      </div>

      <TrainingWeightSettings api={api} />

      {/* Exercise & Equipment Sync */}
      <ExerciseSyncSection api={api} />

      {/* Backup Settings */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:18,
          textTransform:'uppercase', letterSpacing:1, color:'var(--accent)', marginBottom:12 }}>
          Backup Settings
        </div>

        {settings && (
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:16 }}>
            <div className="form-group" style={{ flex:1, minWidth:160 }}>
              <label className="form-label">Schedule</label>
              <select className="form-select" value={settings.schedule}
                onChange={e => setSettings(s => ({...s, schedule:e.target.value}))}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly (Sunday)</option>
                <option value="monthly">Monthly (1st)</option>
              </select>
            </div>
            <div className="form-group" style={{ flex:1, minWidth:140 }}>
              <label className="form-label">Time</label>
              <input type="time" className="form-input" value={settings.backup_time}
                onChange={e => setSettings(s => ({...s, backup_time:e.target.value}))} />
            </div>
            <div className="form-group" style={{ flex:1, minWidth:160 }}>
              <label className="form-label">Keep Backups For</label>
              <select className="form-select" value={settings.retain_weeks}
                onChange={e => setSettings(s => ({...s, retain_weeks:e.target.value}))}>
                <option value="2">2 weeks</option>
                <option value="4">4 weeks</option>
                <option value="8">8 weeks</option>
                <option value="12">12 weeks</option>
              </select>
            </div>
            <div className="form-group" style={{ display:'flex', alignItems:'flex-end' }}>
              <button className="btn btn-primary" onClick={handleSaveSettings} disabled={saving}>
                {saving ? 'Saving…' : 'Save Schedule'}
              </button>
            </div>
          </div>
        )}

        {backupMsg && <div style={msgStyle(backupMsg.type)}>{backupMsg.text}</div>}

        {/* Status row */}
        {status && (
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
            {[
              { label:'Last Data Backup',   val: formatDate(status.last_data_backup),   icon:'💾' },
              { label:'Last Images Backup', val: formatDate(status.last_images_backup), icon:'🖼️' },
            ].map(s => (
              <div key={s.label} className="card-sm" style={{ flex:1, minWidth:160, textAlign:'center' }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
                <div style={{ fontSize:10, color:'var(--text3)', letterSpacing:1, textTransform:'uppercase', marginBottom:2 }}>{s.label}</div>
                <div style={{ fontSize:12, color:'var(--text2)', fontWeight:600 }}>{s.val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Backup buttons — all aligned in a grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:8 }}>
          <div>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>
              <strong style={{ color:'var(--text2)' }}>Backup Now</strong> — saves to server only
            </div>
            <button className="btn btn-ghost" style={{ width:'100%' }}
              onClick={handleBackupNow} disabled={backingUp}>
              {backingUp ? '⏳ Backing up…' : '💾 Backup Now'}
            </button>
          </div>
          <div>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>
              <strong style={{ color:'var(--text2)' }}>Backup + Download</strong> — saves and downloads
            </div>
            <button className="btn btn-primary" style={{ width:'100%' }}
              onClick={() => handleDownload('data')} disabled={downloading==='data'}>
              {downloading==='data' ? '⏳ Creating…' : '📥 Download Data Backup'}
            </button>
          </div>
          <div>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>
              <strong style={{ color:'var(--text2)' }}>Images Backup</strong> — all exercise images/GIFs
            </div>
            <button className="btn btn-secondary" style={{ width:'100%' }}
              onClick={() => handleDownload('images')} disabled={downloading==='images'}>
              {downloading==='images' ? '⏳ Creating…' : '🖼️ Download Images Backup'}
            </button>
          </div>
        </div>
      </div>

      {/* Restore */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:18,
          textTransform:'uppercase', letterSpacing:1, color:'var(--accent)', marginBottom:12 }}>
          Restore from Backup
        </div>

        {restoreMsg && <div style={msgStyle(restoreMsg.type)}>{restoreMsg.text}</div>}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:14,
              textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>
              Restore from JSON
            </div>
            <p style={{ fontSize:12, color:'var(--text3)', marginBottom:10, lineHeight:1.6 }}>
              Upload a <code style={{ background:'var(--bg3)', padding:'1px 4px', borderRadius:3 }}>forge_data.json</code> file.
              Merges with existing data — records with matching IDs are overwritten.
            </p>
            <label style={{ cursor:'pointer' }}>
              <input ref={jsonRef} type="file" accept=".json" style={{ display:'none' }}
                onChange={e => { if(e.target.files[0]) handleRestoreJson(e.target.files[0]); }} />
              <span className="btn btn-ghost">📂 Upload JSON Backup</span>
            </label>
          </div>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:14,
              textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>
              Restore from Database
            </div>
            <p style={{ fontSize:12, color:'var(--text3)', marginBottom:10, lineHeight:1.6 }}>
              Upload a <code style={{ background:'var(--bg3)', padding:'1px 4px', borderRadius:3 }}>forge_database.db</code> file.
              <strong style={{ color:'#ff6b6b' }}> Replaces entire database.</strong> Run{' '}
              <code style={{ background:'var(--bg3)', padding:'1px 4px', borderRadius:3 }}>docker compose restart</code> after.
            </p>
            <label style={{ cursor:'pointer' }}>
              <input ref={dbRef} type="file" accept=".db" style={{ display:'none' }}
                onChange={e => { if(e.target.files[0]) handleRestoreDb(e.target.files[0]); }} />
              <span className="btn btn-ghost" style={{ borderColor:'#ff6b6b40', color:'#ff6b6b' }}>
                ⚠️ Upload DB Backup
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Storage info */}
      <div className="card">
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:18,
          textTransform:'uppercase', letterSpacing:1, color:'var(--accent)', marginBottom:12 }}>Storage</div>
        <div style={{ fontSize:13, color:'var(--text3)', lineHeight:1.8 }}>
          All data is stored locally on your Docker server:
          <ul style={{ marginTop:8, marginLeft:20, lineHeight:2 }}>
            <li><code style={{ background:'var(--bg3)', padding:'1px 6px', borderRadius:4, fontSize:12 }}>/data/workout.db</code> — database</li>
            <li><code style={{ background:'var(--bg3)', padding:'1px 6px', borderRadius:4, fontSize:12 }}>/data/uploads/</code> — exercise images & GIFs</li>
            <li><code style={{ background:'var(--bg3)', padding:'1px 6px', borderRadius:4, fontSize:12 }}>/data/backups/</code> — auto & manual backups</li>
          </ul>
          <div style={{ marginTop:10 }}>
            Point your Dropbox sync script at <code style={{ background:'var(--bg3)', padding:'1px 6px', borderRadius:4, fontSize:12 }}>/data/backups/</code> to automatically cloud-sync all backups.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Exercise & Equipment Sync Section ─────────────────────────────────────────
function ExerciseSyncSection({ api }) {
  const [repoInfo,      setRepoInfo]      = useState(null);
  const [syncing,       setSyncing]       = useState(null); // 'ex-push'|'ex-pull'|'eq-push'|'eq-pull'
  const [msg,           setMsg]           = useState(null);
  const [showConflict,  setShowConflict]  = useState(null); // { type:'exercise'|'equipment', data }
  const exImportRef  = useRef();
  const eqImportRef  = useRef();

  useEffect(() => {
    api.get('/settings').then(s => setRepoInfo(s)).catch(()=>{});
  }, []);

  const msgStyle = (type) => ({
    padding:'8px 12px', borderRadius:6, marginBottom:8, fontSize:12,
    background: type==='success' ? '#34c75920' : '#ff3b3020',
    border: `1px solid ${type==='success' ? '#34c75940' : '#ff3b3040'}`,
    color: type==='success' ? 'var(--green)' : '#ff6b6b',
  });

  const downloadBlob = async (url, fallbackName) => {
    const res  = await fetch(url);
    const blob = await res.blob();
    const cd   = res.headers.get('content-disposition') || '';
    const name = cd.split('filename=')[1]?.replace(/"/g,'') || fallbackName;
    const a    = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleExPush = async () => {
    if (!window.confirm('Push all exercises to your GitHub repo? This overwrites exercises.json in the repo.')) return;
    setSyncing('ex-push'); setMsg(null);
    try {
      const res = await fetch('/api/exercises/repo/push', { method:'POST' });
      const d   = await res.json();
      setMsg(res.ok ? { type:'success', text:`✓ Pushed ${d.count} exercises to repo` } : { type:'error', text:'Push failed: '+d.error });
    } catch(e) { setMsg({ type:'error', text:e.message }); }
    setSyncing(null);
  };

  const handleExPull = async () => {
    setSyncing('ex-pull'); setMsg(null);
    try {
      const res  = await fetch('/api/exercises/repo/pull', { method:'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const cr   = await fetch('/api/exercises/check-conflicts', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ exercises:data.exercises }) });
      const check = await cr.json();
      setShowConflict({ type:'exercise', data:{ exercises:data.exercises, conflicts:check.conflicts, new_count:check.new_count } });
    } catch(e) { setMsg({ type:'error', text:e.message }); }
    setSyncing(null);
  };

  const handleExFileImport = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const exercises = parsed.exercises || parsed;
      const cr   = await fetch('/api/exercises/check-conflicts', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ exercises }) });
      const check = await cr.json();
      setShowConflict({ type:'exercise', data:{ exercises, conflicts:check.conflicts, new_count:check.new_count } });
    } catch(e) { setMsg({ type:'error', text:'Failed to read file: '+e.message }); }
    exImportRef.current.value = '';
  };

  const handleEqPush = async () => {
    if (!window.confirm('Push all equipment to your GitHub repo? This overwrites equipment.json in the repo.')) return;
    setSyncing('eq-push'); setMsg(null);
    try {
      const res = await fetch('/api/equipment/repo/push', { method:'POST' });
      const d   = await res.json();
      setMsg(res.ok ? { type:'success', text:`✓ Pushed ${d.count} equipment items to repo` } : { type:'error', text:'Push failed: '+d.error });
    } catch(e) { setMsg({ type:'error', text:e.message }); }
    setSyncing(null);
  };

  const handleEqPull = async () => {
    setSyncing('eq-pull'); setMsg(null);
    try {
      const res  = await fetch('/api/equipment/repo/pull', { method:'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const cr   = await fetch('/api/equipment/check-conflicts', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ equipment:data.equipment }) });
      const check = await cr.json();
      setShowConflict({ type:'equipment', data:{ equipment:data.equipment, conflicts:check.conflicts, new_count:check.new_count } });
    } catch(e) { setMsg({ type:'error', text:e.message }); }
    setSyncing(null);
  };

  const handleEqFileImport = async (file) => {
    if (!file) return;
    try {
      const text   = await file.text();
      const parsed = JSON.parse(text);
      const equipment = parsed.equipment || parsed;
      const cr   = await fetch('/api/equipment/check-conflicts', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ equipment }) });
      const check = await cr.json();
      setShowConflict({ type:'equipment', data:{ equipment, conflicts:check.conflicts, new_count:check.new_count } });
    } catch(e) { setMsg({ type:'error', text:'Failed to read file: '+e.message }); }
    eqImportRef.current.value = '';
  };

  const handleConflictComplete = async (resolutions) => {
    const { type, data } = showConflict;
    const resolution = resolutions.applyAll || 'keep';
    try {
      if (type === 'exercise') {
        const res    = await fetch('/api/exercises/import', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ exercises:data.exercises, conflict_resolution:resolution }) });
        const result = await res.json();
        setMsg({ type:'success', text:`✓ ${result.added} added, ${result.kept} kept, ${result.overwritten} overwritten, ${result.duplicated} duplicated` });
      } else {
        const res    = await fetch('/api/equipment/import', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ equipment:data.equipment, conflict_resolution:resolution }) });
        const result = await res.json();
        setMsg({ type:'success', text:`✓ ${result.added} added, ${result.kept} kept, ${result.overwritten} overwritten` });
      }
    } catch(e) { setMsg({ type:'error', text:e.message }); }
    setShowConflict(null);
  };

  const hasToken = repoInfo?.has_exercises_token;
  const hasRepo  = repoInfo?.exercises_repo;

  return (
    <div className="card" style={{ marginBottom:20 }}>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:18,
        textTransform:'uppercase', letterSpacing:1, color:'var(--accent)', marginBottom:4 }}>
        Exercise & Equipment
      </div>
      {hasRepo && (
        <div style={{ fontSize:12, color:'var(--text3)', marginBottom:14 }}>
          Repo: <code style={{ background:'var(--bg3)', padding:'1px 6px', borderRadius:4 }}>{repoInfo.exercises_repo}</code>
          {!hasToken && <span style={{ color:'#ffaa00', marginLeft:8 }}>⚠ No write token — push disabled</span>}
        </div>
      )}
      {!hasRepo && (
        <div style={{ fontSize:12, color:'var(--text3)', marginBottom:14 }}>
          Add <code style={{ background:'var(--bg3)', padding:'1px 4px', borderRadius:3 }}>GITHUB_EXERCISES_REPO</code> and{' '}
          <code style={{ background:'var(--bg3)', padding:'1px 4px', borderRadius:3 }}>GITHUB_EXERCISES_TOKEN</code> to your docker-compose.yml to enable repo sync.
        </div>
      )}

      {msg && <div style={msgStyle(msg.type)}>{msg.text}</div>}

      {/* Exercises */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase',
          color:'var(--text3)', marginBottom:8 }}>Exercises</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => downloadBlob('/api/exercises/export', 'forge_exercises.json')}>
            📤 Export JSON
          </button>
          <label style={{ cursor:'pointer' }}>
            <input ref={exImportRef} type="file" accept=".json" style={{ display:'none' }}
              onChange={e => { if(e.target.files[0]) handleExFileImport(e.target.files[0]); }} />
            <span className="btn btn-ghost btn-sm">📥 Import JSON</span>
          </label>
          {hasRepo && (<>
            <button className="btn btn-ghost btn-sm" onClick={handleExPull} disabled={!!syncing}>
              {syncing==='ex-pull' ? '⏳' : '⬇️'} Pull from Repo
            </button>
            {hasToken && (
              <button className="btn btn-ghost btn-sm" onClick={handleExPush} disabled={!!syncing}>
                {syncing==='ex-push' ? '⏳' : '⬆️'} Push to Repo
              </button>
            )}
          </>)}
        </div>
      </div>

      {/* Equipment */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase',
          color:'var(--text3)', marginBottom:8 }}>Equipment</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => downloadBlob('/api/equipment/export', 'forge_equipment.json')}>
            📤 Export JSON
          </button>
          <label style={{ cursor:'pointer' }}>
            <input ref={eqImportRef} type="file" accept=".json" style={{ display:'none' }}
              onChange={e => { if(e.target.files[0]) handleEqFileImport(e.target.files[0]); }} />
            <span className="btn btn-ghost btn-sm">📥 Import JSON</span>
          </label>
          {hasRepo && (<>
            <button className="btn btn-ghost btn-sm" onClick={handleEqPull} disabled={!!syncing}>
              {syncing==='eq-pull' ? '⏳' : '⬇️'} Pull from Repo
            </button>
            {hasToken && (
              <button className="btn btn-ghost btn-sm" onClick={handleEqPush} disabled={!!syncing}>
                {syncing==='eq-push' ? '⏳' : '⬆️'} Push to Repo
              </button>
            )}
          </>)}
        </div>
      </div>

      {/* Conflict modals */}
      {showConflict?.type === 'exercise' && (
        <ExerciseConflictModal data={showConflict.data} onComplete={handleConflictComplete} onClose={() => setShowConflict(null)} />
      )}
      {showConflict?.type === 'equipment' && (
        <EquipmentConflictModal data={showConflict.data} onComplete={handleConflictComplete} onClose={() => setShowConflict(null)} />
      )}
    </div>
  );
}
