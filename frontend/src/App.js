import React, { useState, useEffect, useCallback } from 'react';
import WorkoutDays     from './components/WorkoutDays';
import HomePage        from './components/HomePage';
import RoutineList     from './components/RoutineList';
import RoutineDetail   from './components/RoutineDetail';
import DayDetail       from './components/DayDetail';
import ExerciseLibrary from './components/ExerciseLibrary';
import MuscleLibrary   from './components/MuscleLibrary';
import MuscleExplorer  from './components/MuscleExplorer';
import WeightTracker   from './components/WeightTracker';
import StatsPage       from './components/StatsPage';
import EquipmentLibrary from './components/EquipmentLibrary';
import SettingsPage     from './components/SettingsPage';
import './App.css';

export function useApi() {
  const get  = useCallback(p => fetch(`/api${p}`).then(r => r.json()), []);
  const post = useCallback((p,b) => fetch(`/api${p}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json()), []);
  const put  = useCallback((p,b) => fetch(`/api${p}`,{method:'PUT', headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json()), []);
  const del  = useCallback(p => fetch(`/api${p}`,{method:'DELETE'}).then(r=>r.json()), []);
  return { get, post, put, del };
}

export default function App() {
  const [view,        setView]        = useState('home');
  const [selectedDay,     setSelectedDay]     = useState(null);
  const [selectedRoutine,  setSelectedRoutine]  = useState(null);
  const [routineListKey,   setRoutineListKey]   = useState(0);
  const [days,        setDays]        = useState([]);
  const [exercises,   setExercises]   = useState([]);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const api = useApi();

  const loadDays      = useCallback(() => api.get('/days').then(setDays), [api]);
  const loadExercises = useCallback(() => api.get('/exercises').then(setExercises), [api]);

  useEffect(() => { loadDays(); loadExercises(); }, []);

  // Close drawer on resize to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth > 768) setDrawerOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const navItems = [
    { id:'home',      label:'🏠  Home' },
    { id:'days',      label:'🏋️  Workouts' },
    { id:'routines',  label:'📋  Routines' },
    { id:'explorer',  label:'🫁  Explore' },
    { id:'stats',     label:'📊  My Stats' },
    { id:'weight',    label:'⚖️  Weight' },
    { id:'exercises', label:'📋  Exercises' },
    { id:'muscles',   label:'💪  Muscles' },
    { id:'equipment', label:'🔧  Equipment' },
    { id:'settings',   label:'⚙️  Settings' },
  ];

  const navigate = (id) => {
    // Clear section-specific state when navigating away
    if (id === 'routines') {
      setSelectedRoutine(null);
      setRoutineListKey(k => k + 1);
    }
    if (id === 'days') {
      setSelectedDay(null);
    }
    setView(id);
    setDrawerOpen(false);
  };

  const isActive = (id) => view === id || (id === 'days' && view === 'day') || (id === 'routines' && view === 'routine');

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <span className="logo">⚡ FORGE</span>
          <span className="logo-sub">Workout Tracker</span>
        </div>

        {/* Desktop nav */}
        <nav className="header-nav desktop-nav">
          {navItems.map(n => (
            <button key={n.id} className={`nav-btn ${isActive(n.id)?'active':''}`}
              onClick={() => navigate(n.id)}>{n.label}</button>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button className="hamburger-btn" onClick={() => setDrawerOpen(true)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-logo">
                <span className="logo">⚡ FORGE</span>
              </div>
              <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
            </div>
            <nav className="drawer-nav">
              {navItems.map(n => (
                <button key={n.id}
                  className={`drawer-nav-btn ${isActive(n.id) ? 'active' : ''}`}
                  onClick={() => navigate(n.id)}>
                  {n.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      <main className="app-main">
        {view==='home' && <HomePage onNavigate={setView} api={api} />}
        {view==='days' && (
          <WorkoutDays days={days} onSelectDay={d=>{setSelectedDay(d);setView('day');}} onReload={loadDays} api={api} />
        )}
        {view==='day' && selectedDay && (
          <DayDetail
            day={days.find(d=>d.id===selectedDay.id)||selectedDay}
            exercises={exercises}
            onBack={()=>setView('days')}
            onReload={loadDays}
            api={api}
          />
        )}
        {view==='routines' && !selectedRoutine && (
          <RoutineList key={routineListKey} days={days}
            onSelectRoutine={r=>{setSelectedRoutine(r);setView('routine');}}
            onResume={async (sessionId, routine) => {
              const res = await fetch(`/api/routine-sessions/${sessionId}/resume`).then(r=>r.json());
              setSelectedRoutine({...routine, resumeSession: res});
              setView('routine');
            }}
            api={api} />
        )}
        {view==='routine' && selectedRoutine && (
          <RoutineDetail
            routine={selectedRoutine}
            days={days}
            initialSession={selectedRoutine.resumeSession || null}
            onBack={()=>{setSelectedRoutine(null);setView('routines');setRoutineListKey(k=>k+1);}}
            onReload={loadDays}
            api={api}
          />
        )}
        {view==='explorer'  && <MuscleExplorer exercises={exercises} />}
        {view==='stats'     && <StatsPage api={api} />}
        {view==='weight'    && <WeightTracker api={api} />}
        {view==='exercises' && <ExerciseLibrary exercises={exercises} onReload={loadExercises} api={api} />}
        {view==='muscles'   && <MuscleLibrary />}
        {view==='equipment' && <EquipmentLibrary api={api} />}
        {view==='settings'  && <SettingsPage api={api} />}
      </main>
    </div>
  );
}
