import React, { useState, useEffect, useRef, useMemo } from 'react';
import { theTracker } from './the-tracker'; 
import { Trash2, Clock, ChevronDown, ChevronUp, CheckSquare, Square, X, ChevronLeft, ChevronRight, Copy, Plus, RotateCcw, AlertTriangle, ArrowUp, ArrowDown, BarChart2, Edit3, Save, TrendingUp } from 'lucide-react';

// --- NumberInput Component ---
const NumberInput = ({ placeholder, value, setter, disabled, step = "1", styles, adjustValue }: any) => (
  <div style={styles.inputWrapper}>
    <input 
      type="number" 
      step={step} 
      min="0" 
      placeholder={placeholder} 
      value={value} 
      onChange={(e) => setter(e.target.value)} 
      style={{...styles.inputMinimal, opacity: disabled ? 0.3 : 1}} 
      disabled={disabled} 
    />
    {!disabled && (
      <div style={styles.inputArrows}>
        <ChevronUp size={12} style={styles.arrowIcon} onClick={() => adjustValue(setter, value, parseFloat(step))} />
        <ChevronDown size={12} style={styles.arrowIcon} onClick={() => adjustValue(setter, value, -parseFloat(step))} />
      </div>
    )}
  </div>
);

export default function App() {
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [exercise, setExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [setsToLog, setSetsToLog] = useState('1');
  const [category, setCategory] = useState('STRETCHING');
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [timer, setTimer] = useState<number | null>(null);
  const [expandedEx, setExpandedEx] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editSetValues, setEditSetValues] = useState({ weight: '', reps: '' });
  
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [allWorkoutDates, setAllWorkoutDates] = useState<string[]>([]);
  
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneViewDate, setCloneViewDate] = useState(new Date());
  const [cloneTargetHighlight, setCloneTargetHighlight] = useState<string | null>(null);
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [masterList, setMasterList] = useState<any[]>([]);

  const [statsPeriod, setStatsPeriod] = useState<'SESSION' | 'MONTH' | 'YEAR'>('SESSION');
  const [selectedStatEx, setSelectedStatEx] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'TRACKER' | 'STATS' | 'NOTES'>('TRACKER');

  const [noteText, setNoteText] = useState('');
  const [notesList, setNotesList] = useState<any[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const audioCtx = useRef<AudioContext | null>(null);
  const wakeLock = useRef<any>(null);

  const initAudio = () => {
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.current.state === 'suspended') audioCtx.current.resume();
  };

  const requestWakeLock = async () => {
    try { if ('wakeLock' in navigator) wakeLock.current = await (navigator as any).wakeLock.request('screen'); } catch (err) {}
  };

  useEffect(() => {
    requestWakeLock();
    const handleVisibilityChange = async () => {
      if (wakeLock.current !== null && document.visibilityState === 'visible') await requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const playAlertSound = () => {
    try {
      initAudio();
      const ctx = audioCtx.current!;
      const osc = ctx.createOscillator();
      const envelope = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime); 
      envelope.gain.setValueAtTime(0, ctx.currentTime);
      envelope.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);
      envelope.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
      osc.connect(envelope); envelope.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 1);
    } catch (e) {}
  };

  useEffect(() => {
    let interval: any;
    if (timer !== null && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => {
          if (prev !== null && prev <= 1) {
            playAlertSound();
            if ('vibrate' in navigator) navigator.vibrate([500, 200, 500]);
            return 0;
          }
          return prev !== null ? prev - 1 : 0;
        });
      }, 1000);
    } else if (timer === 0) {
      const timeout = setTimeout(() => setTimer(null), 3000);
      return () => clearTimeout(timeout);
    }
    return () => clearInterval(interval);
  }, [timer]);

  async function fetchInitialData() {
    try {
      const { data: allSets } = await theTracker.from('workout_sets').select('*').order('created_at', { ascending: false });
      if (allSets) {
        setMasterList(allSets);
        const uniqueDates = [...new Set(allSets.map(i => i.set_date))];
        setAllWorkoutDates(uniqueDates);
      }
    } catch (e) { console.error(e); }
  }

  async function fetchDayHistory() {
    setLoading(true);
    try {
      const { data: workoutData } = await theTracker.from('workout_sets').select('*').eq('set_date', selectedDate).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
      setHistory(workoutData || []);
      const { data: noteData } = await theTracker.from('workout_notes').select('*').order('created_at', { ascending: false });
      setNotesList(noteData || []);
    } catch (e) {}
    setLoading(false);
  }

  useEffect(() => { fetchInitialData(); fetchDayHistory(); }, [selectedDate]);

  const exerciseComparison = useMemo(() => {
    if (!selectedStatEx) return null;
    const completed = masterList.filter(s => s.is_completed && s.exercise_name === selectedStatEx);
    const uniqueDates = [...new Set(completed.map(s => s.set_date))].sort((a, b) => b.localeCompare(a));
    if (uniqueDates.length < 1) return null;
    const getDayMetrics = (date: string) => {
      const daySets = completed.filter(s => s.set_date === date);
      if (daySets.length === 0) return null;
      const unitLabel = daySets[0].category === 'CARDIO' ? 'MIN' : (daySets[0].category === 'STRENGTH' ? 'LB' : 'SEC');
      return { 
        date, 
        maxWeight: Math.max(...daySets.map(s => s.weight_lbs)), 
        totalTime: daySets.reduce((acc, s) => acc + s.reps, 0), 
        category: daySets[0].category, 
        unitLabel 
      };
    };
    const latest = getDayMetrics(uniqueDates[0]);
    const previous = uniqueDates[1] ? getDayMetrics(uniqueDates[1]) : null;
    if (!latest) return null;
    return { latest, previous };
  }, [masterList, selectedStatEx]);

  const statsData = useMemo(() => {
    const completed = masterList.filter(s => s.is_completed);
    if (!selectedStatEx) return null;
    let timeFiltered = completed.filter(s => s.exercise_name === selectedStatEx);
    const now = new Date();
    if (statsPeriod === 'SESSION') timeFiltered = timeFiltered.filter(s => s.set_date === selectedDate);
    else if (statsPeriod === 'MONTH') {
        const monthAgo = new Date(); monthAgo.setMonth(now.getMonth() - 1);
        timeFiltered = timeFiltered.filter(s => new Date(s.set_date) >= monthAgo);
    } else if (statsPeriod === 'YEAR') {
        const yearAgo = new Date(); yearAgo.setFullYear(now.getFullYear() - 1);
        timeFiltered = timeFiltered.filter(s => new Date(s.set_date) >= yearAgo);
    }
    if (timeFiltered.length === 0) return { maxWeight: 0, totalVolume: 0, totalSets: 0, category: 'STRENGTH' };
    return { maxWeight: Math.max(...timeFiltered.map(s => s.weight_lbs)), totalVolume: timeFiltered.reduce((acc, s) => acc + (s.weight_lbs * s.reps), 0), totalSets: timeFiltered.length, category: timeFiltered[0].category };
  }, [masterList, selectedStatEx, statsPeriod, selectedDate]);

  const uniqueExercises = useMemo(() => [...new Set(masterList.filter(s => s.is_completed).map(s => s.exercise_name))].sort(), [masterList]);

  const handleExerciseChange = (val: string) => {
    const search = val.toUpperCase(); setExercise(search);
    if (search.length > 0) {
      setSuggestions([...new Set(masterList.map(i => i.exercise_name))].filter(name => name.includes(search)));
      setShowSuggestions(true);
    } else setShowSuggestions(false);
  };

  const selectSuggestion = (name: string) => {
    setExercise(name); setShowSuggestions(false);
    const lastEntry = masterList.find(i => i.exercise_name === name);
    if (lastEntry) {
      setWeight(lastEntry.category === 'STRENGTH' ? lastEntry.weight_lbs.toString() : '');
      setReps(lastEntry.reps.toString()); setCategory(lastEntry.category);
    }
  };

  async function saveToCloud(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    const count = parseInt(setsToLog) || 1;
    const currentUniqueCount = [...new Set(history.map(s => s.exercise_name))].length;
    const newSets = Array.from({ length: count }).map(() => ({
      exercise_name: exercise.toUpperCase().trim(), 
      weight_lbs: category === 'STRENGTH' ? (parseFloat(weight) || 0) : 0,
      reps: parseInt(reps) || 0, set_date: selectedDate, category: category, is_completed: false, sort_order: currentUniqueCount 
    }));
    await theTracker.from('workout_sets').insert(newSets);
    setWeight(''); setReps(''); setExercise(''); setSetsToLog('1'); 
    fetchDayHistory(); fetchInitialData(); setLoading(false);
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setLoading(true);
    await theTracker.from('workout_notes').insert([{ content: noteText.trim(), note_date: selectedDate }]);
    setNoteText(''); await fetchDayHistory(); setLoading(false);
  }

  async function updateNote(id: string) {
    setLoading(true);
    await theTracker.from('workout_notes').update({ content: editValue }).eq('id', id);
    setEditingNoteId(null); await fetchDayHistory(); setLoading(false);
  }

  async function deleteNote(id: string) {
    setLoading(true);
    await theTracker.from('workout_notes').delete().eq('id', id);
    await fetchDayHistory(); setLoading(false);
  }

  async function executeClone() {
    if (!cloneTargetHighlight || history.length === 0) return;
    setLoading(true);
    const copies = history.map(s => ({ exercise_name: s.exercise_name, weight_lbs: s.weight_lbs, reps: s.reps, set_date: cloneTargetHighlight, category: s.category, is_completed: false, sort_order: s.sort_order }));
    await theTracker.from('workout_sets').insert(copies);
    setIsCloneModalOpen(false); setCloneTargetHighlight(null); fetchDayHistory(); fetchInitialData(); setLoading(false);
  }

  async function moveExercise(exName: string, direction: 'up' | 'down') {
    const uniqueExNames = [...new Set(history.map(s => s.exercise_name))];
    const index = uniqueExNames.indexOf(exName);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === uniqueExNames.length - 1)) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const otherExName = uniqueExNames[swapIndex];
    const updates = history.map(s => {
      if (s.exercise_name === exName) return theTracker.from('workout_sets').update({ sort_order: swapIndex }).eq('id', s.id);
      if (s.exercise_name === otherExName) return theTracker.from('workout_sets').update({ sort_order: index }).eq('id', s.id);
      return null;
    }).filter(Boolean);
    await Promise.all(updates as any); fetchDayHistory();
  }

  const toggleComplete = async (id: string, currentStatus: boolean) => {
    setHistory(prev => prev.map(s => s.id === id ? { ...s, is_completed: !currentStatus } : s));
    await theTracker.from('workout_sets').update({ is_completed: !currentStatus }).eq('id', id);
    fetchInitialData();
  };

  const deleteSet = async (id: string) => {
    await theTracker.from('workout_sets').delete().eq('id', id); fetchDayHistory(); fetchInitialData();
  };

  const adjustValue = (setter: any, currentVal: string, delta: number) => {
    const val = parseFloat(currentVal) || 0; setter(Math.max(0, val + delta).toString());
  };

  const saveSetEdit = async (id: string) => {
    const newWeight = parseFloat(editSetValues.weight) || 0;
    const newReps = parseInt(editSetValues.reps) || 0;
    // Update local state immediately so progress bar and display update without refresh
    setHistory(prev => prev.map(s => s.id === id ? { ...s, weight_lbs: newWeight, reps: newReps } : s));
    setEditingSetId(null);
    await theTracker.from('workout_sets').update({ weight_lbs: newWeight, reps: newReps }).eq('id', id);
    fetchInitialData();
  };

  const CATEGORY_ORDER = ['STRETCHING', 'STRENGTH', 'CORE', 'CARDIO'];
  const groupedByCategory = CATEGORY_ORDER.reduce((acc: any, cat) => {
    const sets = history.filter(s => s.category === cat);
    if (sets.length > 0) {
      acc[cat] = sets.reduce((exAcc: any, curr: any) => {
        if (!exAcc[curr.exercise_name]) exAcc[curr.exercise_name] = [];
        exAcc[curr.exercise_name].push(curr); return exAcc;
      }, {});
    }
    return acc;
  }, {});

  const progress = history.length > 0 ? (history.filter(s => s.is_completed).length / history.length) * 100 : 0;
  const isStrength = category === 'STRENGTH';
  const isCardio = category === 'CARDIO';

  const renderCalendar = (viewing: Date, onSelect: (d: string) => void, highlight: string | null) => {
    const y = viewing.getFullYear(); const m = viewing.getMonth();
    const firstDay = new Date(y, m, 1).getDay(); const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} style={styles.calDayEmpty} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSelected = dStr === highlight;
      cells.push(<div key={dStr} onClick={() => onSelect(dStr)} style={{...styles.calDay, backgroundColor: isSelected ? '#FFF' : 'transparent', color: isSelected ? '#000' : '#FFF'}}>{d} {allWorkoutDates.includes(dStr) && <div style={{...styles.dot, backgroundColor: isSelected ? '#000' : '#444'}} />}</div>);
    }
    return cells;
  };

  const getActiveTitle = () => {
    if (activeTab === 'STATS') return "PROGRESS";
    if (activeTab === 'NOTES') return "NOTES";
    return "THE TRACKER";
  };

  return (
    <div style={styles.container}>
      <style>{`
        html, body { background-color: #0D0D0D; margin: 0; padding: 0; overflow: hidden; overscroll-behavior: none; height: 100vh; width: 100%; -webkit-tap-highlight-color: transparent; }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        select { -webkit-appearance: none; -moz-appearance: none; appearance: none; }
        input::placeholder { color: #444; opacity: 1; }
        textarea::placeholder { color: #222; opacity: 1; }
        @keyframes pulse-red { 0% { color: #444; } 50% { color: #FF4D4D; } 100% { color: #444; } }
        .timer-done { animation: pulse-red 0.5s infinite; font-weight: 800; }
        input, textarea, select { font-size: 16px !important; }
      `}</style>

      <div style={styles.fixedHeader}>
          <div style={{...styles.headerContent, maxWidth: activeTab === 'STATS' ? '100%' : '400px'}}>
              <header style={styles.headerArea}>
                <div style={styles.headerTitleGroup}>
                  <button onClick={() => setActiveTab(activeTab === 'NOTES' ? 'TRACKER' : 'NOTES')} style={{...styles.iconBtn, color: activeTab === 'NOTES' ? '#FFF' : '#444'}}><Edit3 size={18} /></button>
                  <h1 style={styles.mainTitle} onClick={() => setActiveTab('TRACKER')}>{getActiveTitle()}</h1>
                  <button onClick={() => setActiveTab(activeTab === 'STATS' ? 'TRACKER' : 'STATS')} style={{...styles.iconBtn, color: activeTab === 'STATS' ? '#FFF' : '#444'}}><BarChart2 size={18} /></button>
                </div>
                
                <div style={styles.topNavRowCentered}>
                  <div style={styles.dateNavWrapper}>
                      <div style={styles.navTouchArea} onClick={() => { const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split('T')[0]); }}><ChevronLeft size={14} style={styles.navArrow} /></div>
                      <div onClick={() => { setViewDate(new Date(selectedDate + 'T00:00:00')); setIsCalendarOpen(true); }} style={styles.dateDisplay}>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      <div style={styles.navTouchArea} onClick={() => { const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split('T')[0]); }}><ChevronRight size={14} style={styles.navArrow} /></div>
                  </div>
                  <button onClick={() => { initAudio(); setSelectedDate(getTodayStr()); }} style={{...styles.todayBtn, color: selectedDate === getTodayStr() ? '#FFF' : '#444'}}>TODAY</button>
                  
                  <div style={styles.stickyTimerArea}>
                    <span className={timer === 0 ? 'timer-done' : ''} style={{...styles.stickyTimerText, color: timer !== null ? '#FFF' : '#444'}} onClick={() => setTimer(null)}>
                        {timer !== null ? (timer === 0 ? "DONE" : `${timer}S`) : <Clock size={16}/>}
                    </span>
                  </div>
                </div>
                <div style={styles.miniProgressContainer}><div style={{...styles.miniProgressBar, width: `${progress}%`}} /></div>
              </header>
          </div>
      </div>

      <div style={styles.scrollArea}>
        <div style={{...styles.content, maxWidth: activeTab === 'STATS' ? '100%' : '400px', borderLeft: activeTab === 'STATS' ? 'none' : '1px solid #1A1A1A', borderRight: activeTab === 'STATS' ? 'none' : '1px solid #1A1A1A'}}>
          
          {activeTab === 'STATS' && (
            <div style={styles.statsPanel}>
              <div style={styles.statsPeriodToggle}>
                  {['SESSION', 'MONTH', 'YEAR'].map(p => <button key={p} onClick={() => setStatsPeriod(p as any)} style={{...styles.periodBtn, color: statsPeriod === p ? '#FFF' : '#444', borderBottom: statsPeriod === p ? '1px solid #FFF' : '1px solid transparent'}}>{p}</button>)}
              </div>
              <div style={styles.exSelectorWrapper}>
                  <select value={selectedStatEx || ''} onChange={(e) => setSelectedStatEx(e.target.value)} style={styles.statsSelectCustom}>
                      <option value="">SELECT EXERCISE</option>
                      {uniqueExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                  </select>
                  <ChevronDown size={14} style={styles.dropdownIcon} />
              </div>
              {selectedStatEx && exerciseComparison && (
                <div style={styles.comparisonSection}>
                  <div style={styles.comparisonHeader}><TrendingUp size={12} style={{marginRight: 6}} /> LAST SESSION VS CURRENT</div>
                  <div style={styles.compGrid}>
                    <div style={styles.compRow}>
                      <div style={styles.compCell}>
                        <span style={styles.compSubLabel}>PREVIOUS ({exerciseComparison.previous ? new Date(exerciseComparison.previous.date + 'T00:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric'}) : 'N/A'})</span>
                        <span style={styles.compVal}>{exerciseComparison.latest.category === 'STRENGTH' ? `${exerciseComparison.previous?.maxWeight || 0}LB` : `${exerciseComparison.previous?.totalTime || 0}${exerciseComparison.latest.unitLabel}`}</span>
                      </div>
                      <div style={styles.compCell}>
                        <span style={styles.compSubLabel}>LATEST ({new Date(exerciseComparison.latest.date + 'T00:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric'})})</span>
                        <span style={styles.compVal}>
                          {exerciseComparison.latest.category === 'STRENGTH' ? `${exerciseComparison.latest.maxWeight}LB` : `${exerciseComparison.latest.totalTime}${exerciseComparison.latest.unitLabel}`}
                          {exerciseComparison.previous && ((exerciseComparison.latest.category === 'STRENGTH' && exerciseComparison.latest.maxWeight > exerciseComparison.previous.maxWeight) || (exerciseComparison.latest.category !== 'STRENGTH' && exerciseComparison.latest.totalTime > exerciseComparison.previous.totalTime)) && <ChevronUp size={12} color="#00FF00" />}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {statsData && selectedStatEx ? (
                  <div style={styles.statsGrid}>
                      <div style={styles.statCard}><span style={styles.statLabel}>{statsData.category === 'STRENGTH' ? 'OVERALL MAX' : 'MAX DURATION'}</span><span style={styles.statValue}>{statsData.category === 'STRENGTH' ? statsData.maxWeight : Math.max(...masterList.filter(s => s.exercise_name === selectedStatEx && s.is_completed).map(s => s.reps))}<small style={styles.unit}>{statsData.category === 'CARDIO' ? 'MIN' : (statsData.category === 'STRENGTH' ? 'LB' : 'SEC')}</small></span></div>
                      <div style={styles.statCard}><span style={styles.statLabel}>PERIOD VOLUME</span><span style={styles.statValue}>{statsData.totalVolume.toLocaleString()}<small style={styles.unit}>{statsData.category === 'STRENGTH' ? 'LB' : (statsData.category === 'CARDIO' ? 'MIN' : 'SEC')}</small></span></div>
                      <div style={styles.statCard}><span style={styles.statLabel}>COMPLETED SETS</span><span style={styles.statValue}>{statsData.totalSets}</span></div>
                  </div>
              ) : <div style={styles.emptyStats}>SELECT AN EXERCISE TO VIEW PROGRESSION</div>}
            </div>
          )}

          {activeTab === 'NOTES' && (
            <div style={styles.notesPanel}>
              <div style={styles.noteInputArea}>
                <textarea placeholder="ADD A NOTE..." value={noteText} onChange={(e) => setNoteText(e.target.value)} style={styles.textareaMinimal} />
                <button onClick={addNote} disabled={loading || !noteText.trim()} style={{...styles.button, marginTop: '10px'}}>SAVE NOTE</button>
              </div>
              <div style={styles.notesList}>
                {notesList.map(note => (
                  <div key={note.id} style={styles.noteCard}>
                    <div style={styles.noteHeader}>
                      <span style={styles.noteTime}>{new Date(note.created_at).toLocaleDateString()} — {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <div style={styles.noteActions}>
                        {editingNoteId === note.id ? <button onClick={() => updateNote(note.id)} style={styles.noteIconBtn}><Save size={14} /></button> : <button onClick={() => { setEditingNoteId(note.id); setEditValue(note.content); }} style={styles.noteIconBtn}><Edit3 size={14} /></button>}
                        <button onClick={() => deleteNote(note.id)} style={styles.noteIconBtn}><Trash2 size={14} opacity={0.3} /></button>
                      </div>
                    </div>
                    {editingNoteId === note.id ? <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} style={styles.textareaEdit} autoFocus /> : <div style={styles.noteContent}>{note.content}</div>}
                  </div>
                ))}
                {notesList.length === 0 && <div style={styles.emptyStats}>NO NOTES YET</div>}
              </div>
            </div>
          )}

          {activeTab === 'TRACKER' && (
            <>
              <form onSubmit={saveToCloud} style={styles.form}>
                <div style={{position: 'relative'}}>
                    <div style={styles.rowMain}>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.selectMinimal}>
                        <option value="STRETCHING">STRETCH</option>
                        <option value="STRENGTH">STRENGTH</option>
                        <option value="CORE">CORE</option>
                        <option value="CARDIO">CARDIO</option>
                    </select>
                    <input placeholder="EXERCISE" value={exercise} onChange={(e) => handleExerciseChange(e.target.value)} onFocus={() => exercise && setShowSuggestions(true)} style={styles.inputMinimal} autoComplete="off" autoCorrect="off" required />
                    </div>
                    {showSuggestions && suggestions.length > 0 && <div style={styles.suggestBox}>{suggestions.slice(0, 5).map(s => <div key={s} onClick={() => selectSuggestion(s)} style={styles.suggestItem}>{s}</div>)}</div>}
                </div>
                <div style={styles.rowThree}>
                    <NumberInput placeholder={isStrength ? "LBS" : "BW"} value={isStrength ? weight : ""} setter={setWeight} disabled={!isStrength} step="0.5" styles={styles} adjustValue={adjustValue} />
                    <NumberInput placeholder={isCardio ? "MIN" : (isStrength ? "REPS" : "SEC")} value={reps} setter={setReps} styles={styles} adjustValue={adjustValue} />
                    <NumberInput placeholder="SETS" value={setsToLog} setter={setSetsToLog} styles={styles} adjustValue={adjustValue} />
                </div>
                <button type="submit" disabled={loading} style={styles.button}>ADD TO PLAN</button>
              </form>

              <div style={styles.timerRow}>
                <div style={styles.timerCircles}>{[30, 45, 60, 120, 180].map(s => <button key={s} onClick={() => { initAudio(); setTimer(s); }} style={styles.timerCircle}>{s}</button>)}</div>
              </div>

              <div style={styles.logContainer}>
              {Object.entries(groupedByCategory).map(([cat, exs]: [string, any]) => (
                  <div key={cat} style={styles.catGroup}>
                  <div style={styles.catLabelHeader}>{cat}</div>
                  {Object.entries(exs).map(([ex, sets]: [string, any]) => {
                      const remains = sets.filter((s:any) => !s.is_completed).length;
                      return (
                      <div key={ex} style={styles.exGroup}>
                          <div style={styles.exHeader} onClick={() => setExpandedEx(expandedEx === ex ? null : ex)}>
                          <div style={styles.exHeaderText}>
                              <div style={styles.sortArrows}>
                                <ArrowUp size={12} onClick={(e) => { e.stopPropagation(); moveExercise(ex, 'up'); }} style={styles.sortIcon} />
                                <ArrowDown size={12} onClick={(e) => { e.stopPropagation(); moveExercise(ex, 'down'); }} style={styles.sortIcon} />
                              </div>
                              <span style={{color: remains === 0 ? '#444' : '#FFF', fontSize: '13px'}}>{ex}</span>
                              <span style={styles.remainingBadge}>{sets.length - remains}/{sets.length}</span>
                          </div>
                          <div style={styles.headerActions}>
                              <div style={styles.iconTouchArea} onClick={async (e) => {
                                  e.stopPropagation(); const s = sets[sets.length-1];
                                  await theTracker.from('workout_sets').insert([{ exercise_name: ex, weight_lbs: s.weight_lbs, reps: s.reps, set_date: selectedDate, category: cat, is_completed: false, sort_order: s.sort_order }]);
                                  fetchDayHistory();
                              }}><Plus size={18} style={styles.actionIcon} /></div>
                              {expandedEx === ex ? <ChevronUp size={18} opacity={0.3} /> : <ChevronDown size={18} opacity={0.3} />}
                          </div>
                          </div>
                          {expandedEx === ex && (
                          <div style={styles.setList}>
                              {[...sets].sort((a, b) => a.id.localeCompare(b.id)).map((set: any, i: number) => (
                              <div key={set.id} style={styles.setRow}>
                                  {editingSetId === set.id ? (
                                    <div style={styles.setEditMode}>
                                        <input type="number" step="0.5" value={editSetValues.weight} onChange={(e) => setEditSetValues({...editSetValues, weight: e.target.value})} style={styles.editSetInput} />
                                        <span style={{color: '#444'}}>X</span>
                                        <input type="number" value={editSetValues.reps} onChange={(e) => setEditSetValues({...editSetValues, reps: e.target.value})} style={styles.editSetInput} />
                                        <div style={styles.iconTouchArea} onClick={() => saveSetEdit(set.id)}><Save size={14} color="#FFF" /></div>
                                        <div style={styles.iconTouchArea} onClick={() => setEditingSetId(null)}><X size={14} color="#444" /></div>
                                    </div>
                                  ) : (
                                    <>
                                        <div style={styles.setMain} onClick={() => toggleComplete(set.id, set.is_completed)}>
                                            {set.is_completed ? <CheckSquare size={18} /> : <Square size={18} opacity={0.15} />}
                                            <span style={{...styles.setText, textDecoration: set.is_completed ? 'line-through' : 'none', opacity: set.is_completed ? 0.3 : 1}}>
                                                S{i+1} — {set.category === 'STRENGTH' ? `${set.weight_lbs}LB x ` : ''}{set.reps} {set.category === 'CARDIO' ? (set.reps === 1 ? 'MIN' : 'MINS') : (set.category === 'STRENGTH' ? 'REPS' : 'SEC')}
                                            </span>
                                        </div>
                                        <div style={{display: 'flex'}}>
                                            <div style={styles.iconTouchArea} onClick={() => { setEditingSetId(set.id); setEditSetValues({ weight: set.weight_lbs.toString(), reps: set.reps.toString() }); }}><Edit3 size={14} style={styles.trash} /></div>
                                            <div style={styles.iconTouchArea} onClick={() => deleteSet(set.id)}><Trash2 size={14} style={styles.trash} /></div>
                                        </div>
                                    </>
                                  )}
                              </div>
                              ))}
                          </div>
                          )}
                      </div>
                      );
                  })}
                  </div>
              ))}
              </div>
              <div style={styles.bottomActions}>
                <button style={styles.secondaryBtn} onClick={() => setIsCloneModalOpen(true)}><Copy size={14} /> CLONE WORKOUT</button>
                <button style={styles.clearDayBtn} onClick={() => setIsClearModalOpen(true)}><RotateCcw size={14} /> CLEAR DAY</button>
              </div>
            </>
          )}

          {isClearModalOpen && (
            <div style={styles.modalOverlay}>
              <div style={{...styles.modalContent, textAlign: 'center', border: '1px solid #FF4D4D'}}>
                <AlertTriangle color="#FF4D4D" size={32} style={{marginBottom: '15px'}} />
                <div style={{fontSize: '12px', letterSpacing: '2px', marginBottom: '24px'}}>CLEAR DAY?</div>
                <div style={{display: 'flex', gap: '10px'}}>
                  <button onClick={() => setIsClearModalOpen(false)} style={{...styles.secondaryBtn, flex: 1}}>CANCEL</button>
                  <button onClick={async () => { await theTracker.from('workout_sets').delete().eq('set_date', selectedDate); setIsClearModalOpen(false); fetchDayHistory(); fetchInitialData(); }} style={{...styles.button, backgroundColor: '#FF4D4D', flex: 1, color: '#FFF'}}>CLEAR</button>
                </div>
              </div>
            </div>
          )}

          {(isCloneModalOpen || isCalendarOpen) && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalContent}>
                <div style={styles.modalHeader}>
                  <div style={styles.monthNav}>
                    <div style={styles.navTouchArea} onClick={() => { const target = isCloneModalOpen ? cloneViewDate : viewDate; const setter = isCloneModalOpen ? setCloneViewDate : setViewDate; const newD = new Date(target); newD.setMonth(newD.getMonth() - 1); setter(newD); }}><ChevronLeft size={20} /></div>
                    <span style={{fontSize: '11px', letterSpacing: '2px'}}>{(isCloneModalOpen ? cloneViewDate : viewDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                    <div style={styles.navTouchArea} onClick={() => { const target = isCloneModalOpen ? cloneViewDate : viewDate; const setter = isCloneModalOpen ? setCloneViewDate : setViewDate; const newD = new Date(target); newD.setMonth(newD.getMonth() + 1); setter(newD); }}><ChevronRight size={20} /></div>
                  </div>
                  <div style={styles.navTouchArea} onClick={() => { setIsCloneModalOpen(false); setIsCalendarOpen(false); }}><X size={24} opacity={0.3} /></div>
                </div>
                <div style={styles.calGrid}>
                  {['S','M','T','W','T','F','S'].map(d => <div key={d} style={styles.calDayLabel}>{d}</div>)}
                  {renderCalendar(isCloneModalOpen ? cloneViewDate : viewDate, (d) => isCloneModalOpen ? setCloneTargetHighlight(d) : (setSelectedDate(d), setIsCalendarOpen(false)), isCloneModalOpen ? cloneTargetHighlight : selectedDate)}
                </div>
                {isCloneModalOpen && <button onClick={executeClone} disabled={!cloneTargetHighlight || loading} style={{...styles.button, marginTop: '24px', opacity: cloneTargetHighlight ? 1 : 0.3}}> {loading ? 'CLONING...' : `CONFIRM CLONE`}</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { backgroundColor: '#0D0D0D', height: '100vh', color: '#FFF', fontFamily: '-apple-system, sans-serif', textTransform: 'uppercase', display: 'flex', flexDirection: 'column', width: '100%', overflow: 'hidden' },
  fixedHeader: { position: 'fixed', top: 0, width: '100%', zIndex: 100, backgroundColor: 'rgba(13, 13, 13, 0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid #1A1A1A', display: 'flex', justifyContent: 'center' },
  headerContent: { width: '100%', padding: 'env(safe-area-inset-top, 20px) 20px 0 20px', boxSizing: 'border-box' },
  scrollArea: { flex: 1, overflowY: 'auto', paddingTop: '82px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  content: { width: '100%', padding: '0 20px 40px 20px', boxSizing: 'border-box' },
  headerArea: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  headerTitleGroup: { width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' },
  iconBtn: { background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px' },
  mainTitle: { fontSize: '24px', fontWeight: 800, letterSpacing: '8px', margin: 0, flex: 1, textAlign: 'center', cursor: 'pointer' },
  miniProgressContainer: { width: '100%', height: '4px', backgroundColor: '#050505', border: '1px solid #1A1A1A', position: 'relative', overflow: 'hidden' },
  miniProgressBar: { height: '100%', backgroundColor: '#FFF', transition: 'width 0.4s ease' },
  topNavRowCentered: { display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', gap: '15px', paddingBottom: '4px' },
  dateNavWrapper: { display: 'flex', alignItems: 'center', gap: '2px' },
  navTouchArea: { padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  navArrow: { color: '#444' },
  dateDisplay: { fontSize: '11px', borderBottom: '1px solid #1A1A1A', cursor: 'pointer', padding: '0 5px', minWidth: '70px', textAlign: 'center' },
  todayBtn: { background: 'none', border: '1px solid #1A1A1A', fontSize: '9px', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' },
  stickyTimerArea: { display: 'flex', alignItems: 'center', minWidth: '40px' },
  stickyTimerText: { fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', marginBottom: '0' },
  rowMain: { display: 'grid', gridTemplateColumns: '90px 1fr', gap: '12px' },
  rowThree: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' },
  inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center', width: '100%' },
  inputArrows: { position: 'absolute', right: '5px', display: 'flex', flexDirection: 'column', gap: '2px' },
  arrowIcon: { color: '#444', cursor: 'pointer', opacity: 0.8 },
  inputMinimal: { backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #1A1A1A', color: '#FFF', padding: '12px 20px 12px 2px', fontSize: '16px', outline: 'none', width: '125%', boxSizing: 'border-box', transform: 'scale(0.8)', transformOrigin: 'left center' },
  selectMinimal: { backgroundColor: '#0D0D0D', border: 'none', borderBottom: '1px solid #1A1A1A', color: '#444', fontSize: '16px', outline: 'none', width: '125%', padding: '12px 0', cursor: 'pointer', transform: 'scale(0.8)', transformOrigin: 'left center' },
  suggestBox: { position: 'absolute', width: '100%', top: '45px', backgroundColor: '#0D0D0D', border: '1px solid #1A1A1A', zIndex: 10, left: 0, right: 0 },
  suggestItem: { padding: '12px', fontSize: '12px', color: '#888', borderBottom: '1px solid #111', cursor: 'pointer' },
  button: { backgroundColor: '#FFF', color: '#000', border: 'none', padding: '16px', fontWeight: 600, fontSize: '11px', letterSpacing: '2px', cursor: 'pointer', marginBottom: '0', width: '100%' },
  timerRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0', borderBottom: '1px solid #1A1A1A', marginBottom: '15px' },
  timerCircles: { display: 'flex', gap: '8px' },
  timerCircle: { background: 'none', border: '1px solid #1A1A1A', color: '#FFF', width: '36px', height: '36px', borderRadius: '50%', fontSize: '10px', cursor: 'pointer' },
  logContainer: { display: 'flex', flexDirection: 'column', gap: '2px' },
  catGroup: { marginBottom: '25px' },
  catLabelHeader: { fontSize: '10px', color: '#444', letterSpacing: '3px', marginBottom: '12px', borderBottom: '1px solid #111', paddingBottom: '6px' },
  exGroup: { borderBottom: '1px solid #111' },
  exHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', cursor: 'pointer' },
  exHeaderText: { display: 'flex', alignItems: 'center', gap: '12px', flex: 1 },
  sortArrows: { display: 'flex', flexDirection: 'column', gap: '6px', opacity: 0.3 },
  sortIcon: { cursor: 'pointer' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '12px' },
  iconTouchArea: { padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  actionIcon: { opacity: 0.5 },
  remainingBadge: { fontSize: '9px', color: '#444', fontWeight: 600 },
  setList: { paddingBottom: '15px', display: 'flex', flexDirection: 'column', gap: '12px' },
  setRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '12px', minHeight: '40px' },
  setEditMode: { display: 'flex', gap: '10px', alignItems: 'center', flex: 1 },
  editSetInput: { backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #444', color: '#FFF', fontSize: '14px', width: '50px', textAlign: 'center', outline: 'none' },
  setMain: { display: 'flex', gap: '14px', alignItems: 'center', cursor: 'pointer', flex: 1 },
  setText: { fontSize: '13px', color: '#888' },
  trash: { opacity: 0.2 },
  bottomActions: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '30px' },
  secondaryBtn: { width: '100%', background: 'none', border: '1px solid #1A1A1A', color: '#444', padding: '16px', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  clearDayBtn: { width: '100%', background: 'none', border: '1px solid #1A1A1A', color: '#FF4D4D', padding: '16px', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: 0.6 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { width: '90%', maxWidth: '340px', padding: '24px', border: '1px solid #1A1A1A', backgroundColor: '#0D0D0D' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  monthNav: { display: 'flex', alignItems: 'center', gap: '16px', flex: 1, justifyContent: 'center' },
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' },
  calDayLabel: { fontSize: '10px', color: '#444', paddingBottom: '10px' },
  calDay: { aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', position: 'relative' },
  calDayEmpty: { aspectRatio: '1' },
  dot: { width: '3px', height: '3px', borderRadius: '50%', marginTop: '2px' },
  statsPanel: { display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px', width: '100%' },
  statsPeriodToggle: { display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '10px' },
  periodBtn: { background: 'none', border: 'none', fontSize: '10px', letterSpacing: '2px', padding: '8px 0', cursor: 'pointer' },
  exSelectorWrapper: { width: '100%', borderBottom: '1px solid #1A1A1A', position: 'relative', display: 'flex', alignItems: 'center' },
  statsSelectCustom: { width: '100%', backgroundColor: 'transparent', border: 'none', color: '#FFF', fontSize: '14px', letterSpacing: '1px', padding: '16px 0', outline: 'none', cursor: 'pointer', WebkitAppearance: 'none' },
  dropdownIcon: { position: 'absolute', right: 0, color: '#444', pointerEvents: 'none' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '12px', width: '100%' },
  statCard: { backgroundColor: '#050505', border: '1px solid #1A1A1A', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  statLabel: { fontSize: '9px', color: '#444', letterSpacing: '2px' },
  statValue: { fontSize: '28px', fontWeight: 700, letterSpacing: '1px' },
  unit: { fontSize: '10px', color: '#444', marginLeft: '4px' },
  emptyStats: { textAlign: 'center', color: '#444', fontSize: '11px', letterSpacing: '1px', marginTop: '40px' },
  comparisonSection: { border: '1px solid #1A1A1A', padding: '15px', backgroundColor: '#050505', width: '100%', boxSizing: 'border-box' },
  comparisonHeader: { fontSize: '10px', color: '#FFF', letterSpacing: '2px', marginBottom: '15px', display: 'flex', alignItems: 'center' },
  compGrid: { display: 'flex', flexDirection: 'column', gap: '15px' },
  compRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  compCell: { display: 'flex', flexDirection: 'column', gap: '4px' },
  compSubLabel: { fontSize: '8px', color: '#444', letterSpacing: '1px' },
  compVal: { fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' },
  notesPanel: { display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' },
  noteInputArea: { display: 'flex', flexDirection: 'column' },
  textareaMinimal: { backgroundColor: '#050505', border: '1px solid #1A1A1A', color: '#FFF', padding: '15px', fontSize: '16px', outline: 'none', borderRadius: '4px', minHeight: '100px', resize: 'none', textTransform: 'uppercase' },
  notesList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  noteCard: { border: '1px solid #111', padding: '15px', position: 'relative' },
  noteHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  noteTime: { fontSize: '9px', color: '#444', letterSpacing: '1px' },
  noteActions: { display: 'flex', gap: '10px' },
  noteIconBtn: { background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '2px' },
  noteContent: { fontSize: '14px', color: '#888', lineHeight: '1.4', whiteSpace: 'pre-wrap' },
  textareaEdit: { backgroundColor: 'transparent', border: 'none', color: '#FFF', fontSize: '16px', outline: 'none', width: '100%', resize: 'none', minHeight: '60px', textTransform: 'uppercase' }
};