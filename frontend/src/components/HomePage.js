import React, { useState, useEffect } from 'react';

export default function HomePage({ onNavigate, api }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/stats/summary').then(s => setStats(s)).catch(() => {});
  }, []);

  const sections = [
    {
      id:    'days',
      icon:  '🏋️',
      title: 'Workouts',
      desc:  'Create and manage individual workout routines. Add exercises, set weights, reps and progressive overload.',
      color: 'var(--accent)',
    },
    {
      id:    'routines',
      icon:  '📋',
      title: 'Routines',
      desc:  'Combine multiple workouts into a full session. Build a warmup, main workout and cooldown into one routine.',
      color: '#4af',
    },
    {
      id:    'explorer',
      icon:  '🫁',
      title: 'Explore',
      desc:  'Interactive muscle diagram. Click any muscle to find exercises that target it.',
      color: '#a78bfa',
    },
    {
      id:    'stats',
      icon:  '📊',
      title: 'My Stats',
      desc:  'Track your progress. See current weights, personal maxes and weight history graphs per exercise.',
      color: '#34c759',
    },
    {
      id:    'weight',
      icon:  '⚖️',
      title: 'Weight Tracker',
      desc:  'Log your body weight over time and visualize your progress.',
      color: '#ff9f0a',
    },
    {
      id:    'exercises',
      icon:  '📚',
      title: 'Exercise Library',
      desc:  'Browse all exercises, filter by muscle group or equipment. Add custom exercises with images and GIFs.',
      color: '#ff6b6b',
    },
    {
      id:    'muscles',
      icon:  '💪',
      title: 'Muscle Library',
      desc:  'View and edit muscle group names and aliases used throughout the app.',
      color: '#ff8c5a',
    },
    {
      id:    'equipment',
      icon:  '🔧',
      title: 'Equipment',
      desc:  'Manage your equipment list. Assign equipment to exercises for filtering when building workouts.',
      color: '#8af',
    },
    {
      id:    'settings',
      icon:  '⚙️',
      title: 'Settings',
      desc:  'Backup and restore your data, sync exercises to your repo, configure auto-backup schedule.',
      color: 'var(--text2)',
    },
  ];

  return (
    <div>
      {/* Hero */}
      <div style={{ textAlign:'center', padding:'32px 0 24px' }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900,
          fontSize:56, letterSpacing:4, color:'var(--accent)', lineHeight:1, marginBottom:8 }}>
          ⚡ FORGE
        </div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600,
          fontSize:18, letterSpacing:3, color:'var(--text3)', textTransform:'uppercase', marginBottom:16 }}>
          Workout Tracker
        </div>
        <div style={{ fontSize:13, color:'var(--text3)', maxWidth:480, margin:'0 auto', lineHeight:1.7 }}>
          A self-hosted personal workout tracking application.
          Built to be simple, fast, and entirely yours.
        </div>
      </div>

      {/* Stats widgets */}
      {stats && (
        <div style={{ display:'flex', gap:12, justifyContent:'center', marginBottom:32, flexWrap:'wrap' }}>
          {[
            { label:'Workouts Built',  val: stats.workouts,  icon:'🏋️' },
            { label:'Routines Built',  val: stats.routines || 0, icon:'📋' },
            { label:'Sessions Logged', val: stats.sessions,  icon:'✅' },
            { label:'Exercises',       val: stats.exercises, icon:'📚' },
          ].map(s => (
            <div key={s.label} className="card-sm" style={{ textAlign:'center', minWidth:120, flex:1, maxWidth:160 }}>
              <div style={{ fontSize:24, marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
                fontSize:32, color:'var(--accent)', lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:11, color:'var(--text3)', letterSpacing:1,
                textTransform:'uppercase', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Section cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => onNavigate(s.id)}
            style={{
              background:'var(--bg2)', border:'1px solid var(--border)',
              borderRadius:10, padding:'18px 20px', textAlign:'left',
              cursor:'pointer', transition:'all 0.15s',
              display:'flex', flexDirection:'column', gap:8,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.background = 'var(--bg3)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg2)'; }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:24 }}>{s.icon}</span>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
                fontSize:18, textTransform:'uppercase', letterSpacing:1, color:s.color }}>
                {s.title}
              </span>
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', lineHeight:1.6 }}>{s.desc}</div>
          </button>
        ))}
      </div>

      {/* AI disclosure footer */}
      <div style={{ marginTop:32, padding:'14px 16px', background:'var(--bg2)',
        border:'1px solid var(--border)', borderRadius:8, fontSize:11, color:'var(--text3)',
        display:'flex', alignItems:'center', gap:8 }}>
        <span>🤖</span>
        <span>Built with the assistance of <strong style={{ color:'var(--text2)' }}>Claude</strong> by Anthropic.
        All feature decisions were made by the developer.</span>
      </div>
    </div>
  );
}
