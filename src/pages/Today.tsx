import { useState, useEffect } from "react";
import { routineData } from "../data/routine";
import { extraExercises } from "../data/extraExercises";
import { PlateCalculator } from "../components/PlateCalculator";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../components/AppShell"; // reusing the cn utility
import { Check, X, Search, Plus } from "lucide-react";
import { auth, db } from "../services/firebase";
import { collection, doc, setDoc, addDoc, onSnapshot, getDocs, query, orderBy, limit } from "firebase/firestore";
import { LoggedWorkout, LoggedExercise, LoggedSet } from "../types";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

export function Today() {
  const date = new Date();
  const rawDay = date.getDay(); // 0 is Sunday
  const todayDefaultDayNumber = rawDay === 0 ? 7 : rawDay;

  const [loggedWorkout, setLoggedWorkout] = useState<LoggedWorkout | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedDayNumber, setSelectedDayNumber] = useState(todayDefaultDayNumber);
  const [previousStats, setPreviousStats] = useState<Record<string, { weight: number, reps: number }>>({});
  const [swappingExIndex, setSwappingExIndex] = useState<number | null>(null);
  const [swapSearch, setSwapSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<'all' | 'custom'>('all');
  const [customExercises, setCustomExercises] = useState<{name: string, id: string}[]>([]);
  const [newCustomName, setNewCustomName] = useState("");

  const staticExercises = Array.from(new Map(
    [...routineData.routine.flatMap(day => day.exercises), ...extraExercises].map(ex => [ex.name, ex])
  ).values());
  const allExercises = Array.from(new Map(
    [...staticExercises, ...customExercises].map(ex => [ex.name, ex])
  ).values()).sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (!auth.currentUser) return;
    const todayStr = date.toISOString().split('T')[0];
    const path = `users/${auth.currentUser.uid}/workouts`;
    
    // Auto-create or resume today's workout
    const workoutRef = doc(db, path, todayStr);
    
    const unsubscribe = onSnapshot(workoutRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as LoggedWorkout;
        setLoggedWorkout({ id: snap.id, ...data });
        if (data.day_number) {
          setSelectedDayNumber(data.day_number);
        }
      } else {
        const defaultRoutine = routineData.routine.find(r => r.day_number === todayDefaultDayNumber)!;
        const newWorkout: LoggedWorkout = {
          day_number: defaultRoutine.day_number,
          workout_type: defaultRoutine.workout_type,
          focus: defaultRoutine.focus,
          date: Date.now(),
          exercises: defaultRoutine.exercises.map(ex => ({
            name: ex.name,
            sets: Array(ex.sets).fill({ reps: 0, weight: 0, completed: false })
          }))
        };
        setDoc(workoutRef, newWorkout).catch(err => {
          setErrorMsg('Failed to save workout. Check your connection.');
          handleFirestoreError(err, OperationType.WRITE, path);
        });
      }
    }, (error) => {
      setErrorMsg('Failed to load workout. Check your connection.');
      handleFirestoreError(error, OperationType.GET, path);
    });

    const customExPath = `users/${auth.currentUser.uid}/custom_exercises`;
    const unsubCustoms = onSnapshot(collection(db, customExPath), (snap) => {
      const customs = snap.docs.map(d => ({ name: d.data().name, id: d.id }));
      setCustomExercises(customs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, customExPath);
    });

    const fetchPrevious = async () => {
      const q = query(
        collection(db, path),
        orderBy("date", "desc"),
        limit(20)
      );
      try {
        const snaps = await getDocs(q);
        const stats: Record<string, { weight: number, reps: number }> = {};
        snaps.forEach(docSnap => {
          if (docSnap.id === todayStr) return; // skip today
          const data = docSnap.data() as LoggedWorkout;
          data.exercises?.forEach(ex => {
            if (!stats[ex.name] && ex.sets?.some(s => s.completed)) {
              const completedSets = ex.sets.filter(s => s.completed);
              if (completedSets.length > 0) {
                 const bestSet = completedSets.reduce((prev, curr) => (curr.weight > prev.weight ? curr : prev));
                 stats[ex.name] = { weight: bestSet.weight, reps: bestSet.reps };
              }
            }
          });
        });
        setPreviousStats(stats);
      } catch (e) {
        console.error(e);
      }
    };
    fetchPrevious();

    return () => {
      unsubscribe();
      unsubCustoms();
    };
  }, [auth.currentUser?.uid, todayDefaultDayNumber]);

  const changeSession = async (newDayNum: number) => {
    if (!auth.currentUser) return;
    
    // We confirm if the user wants to overwrite? Or just do it. Let's confirm if they have started.
    // Actually, just overwriting is fine for a simple app unless they've checked off sets.
    if (loggedWorkout && loggedWorkout.exercises?.some(ex => ex.sets.some(s => s.completed))) {
      if (!window.confirm("You have completed sets. Changing the session will overwrite today's progress. Continue?")) {
        return;
      }
    }

    const newRoutine = routineData.routine.find(r => r.day_number === newDayNum);
    if (!newRoutine) return;
    
    const todayStr = date.toISOString().split('T')[0];
    const path = `users/${auth.currentUser.uid}/workouts`;
    const workoutRef = doc(db, path, todayStr);
    
    const newWorkout: LoggedWorkout = {
      day_number: newRoutine.day_number,
      workout_type: newRoutine.workout_type,
      focus: newRoutine.focus,
      date: Date.now(),
      exercises: newRoutine.exercises.map(ex => ({
        name: ex.name,
        sets: Array(ex.sets).fill({ reps: 0, weight: 0, completed: false })
      }))
    };
    
    try {
      await setDoc(workoutRef, newWorkout);
      setSelectedDayNumber(newDayNum);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg('Failed to change session. Check your connection.');
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const swapExercise = async (exIndex: number, newName: string) => {
    if (!loggedWorkout || !auth.currentUser) return;
    
    const newExercises = [...loggedWorkout.exercises];
    newExercises[exIndex].name = newName;
    
    const staticEx = staticExercises.find(ex => ex.name === newName);
    const prevStat = previousStats[newName];
    
    let defaultSets = 3;
    let defaultReps = 0;
    
    if (staticEx) {
        if (staticEx.sets) defaultSets = staticEx.sets;
        if (staticEx.reps) defaultReps = staticEx.reps;
    }
    // If we have previous stats, maybe we don't override reps unless it was 0?
    // Actually the prompt asks to base it on routineData or extraExercises.
    
    const newSets: LoggedSet[] = [];
    for (let i = 0; i < defaultSets; i++) {
        newSets.push({ 
           reps: defaultReps, 
           weight: prevStat ? prevStat.weight : 0, 
           completed: false 
        });
    }
    
    newExercises[exIndex].sets = newSets;
    
    const wRef = doc(db, `users/${auth.currentUser.uid}/workouts`, loggedWorkout.id!);
    try {
      await setDoc(wRef, { exercises: newExercises }, { merge: true });
      setSwappingExIndex(null);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg('Failed to save workout. Check your connection.');
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}/workouts`);
    }
  };

  const createCustomExercise = async () => {
    if (!newCustomName.trim() || !auth.currentUser || swappingExIndex === null) return;
    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/custom_exercises`), {
        name: newCustomName.trim()
      });
      // automatically swap the exercise to this newly created one
      swapExercise(swappingExIndex, newCustomName.trim());
      setSwapSearch("");
      setNewCustomName("");
    } catch(err) {
      setErrorMsg('Failed to create custom exercise. Check your connection.');
      handleFirestoreError(err, OperationType.CREATE, `users/${auth.currentUser.uid}/custom_exercises`);
    }
  };

  const updateSet = async (exIndex: number, setIndex: number, field: 'reps' | 'weight' | 'completed', value: number | boolean) => {
    if (!loggedWorkout || !auth.currentUser) return;
    
    // Haptic feedback when completing a set
    if (field === 'completed' && value === true) {
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }

    const newExercises = [...loggedWorkout.exercises];
    newExercises[exIndex].sets[setIndex] = { ...newExercises[exIndex].sets[setIndex], [field]: value };
    
    const wRef = doc(db, `users/${auth.currentUser.uid}/workouts`, loggedWorkout.id!);
    try {
      await setDoc(wRef, { exercises: newExercises }, { merge: true });
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg('Failed to save workout. Check your connection.');
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}/workouts`);
    }
  };

  const addSet = async (exIndex: number) => {
    if (!loggedWorkout || !auth.currentUser) return;
    
    const newExercises = [...loggedWorkout.exercises];
    newExercises[exIndex].sets.push({ reps: 0, weight: 0, completed: false });
    
    const wRef = doc(db, `users/${auth.currentUser.uid}/workouts`, loggedWorkout.id!);
    try {
      await setDoc(wRef, { exercises: newExercises }, { merge: true });
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg('Failed to save workout. Check your connection.');
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}/workouts`);
    }
  };

  const updateWorkoutDetail = async (field: 'workout_type' | 'focus', value: string) => {
    if (!loggedWorkout || !auth.currentUser) return;
    
    // Fallback to today string if id is missing temporarily
    const todayStr = date.toISOString().split('T')[0];
    const wRef = doc(db, `users/${auth.currentUser.uid}/workouts`, loggedWorkout.id || todayStr);
    
    try {
      await setDoc(wRef, { [field]: value }, { merge: true });
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg('Failed to save workout. Check your connection.');
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}/workouts`);
    }
  };

  const completeWorkout = async () => {
    if (!loggedWorkout || !auth.currentUser) return;
    const wRef = doc(db, `users/${auth.currentUser.uid}/workouts`, loggedWorkout.id!);
    try {
      await setDoc(wRef, { isCompleted: true }, { merge: true });
      setErrorMsg(null);
      // Confetti and celebration
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([100, 50, 100, 50, 200]);
      }
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#000000', '#333333', '#666666']
      });
    } catch (err) {
      setErrorMsg('Failed to save workout. Check your connection.');
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}/workouts`);
    }
  };

  const workout = routineData.routine.find(r => r.day_number === selectedDayNumber);
  if (!workout) return null;

  return (
    <div className="p-6 pb-24 space-y-12">
      {errorMsg && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
          <p className="font-bold">Error</p>
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Header */}
      <section className="space-y-2">
        <h2 className="font-sans text-sm font-bold tracking-widest uppercase opacity-70 flex items-center justify-between">
          <span>{date.toLocaleDateString('en-US', { weekday: 'long' })}</span>
          <select 
            value={selectedDayNumber}
            onChange={(e) => changeSession(Number(e.target.value))}
            disabled={loggedWorkout?.isCompleted}
            className="bg-transparent font-bold outline-none cursor-pointer hover:bg-black/5 p-1 rounded max-w-[50%]"
          >
            {routineData.routine.map(r => (
              <option key={r.day_number} value={r.day_number}>
                Day {r.day_number}: {r.workout_type}
              </option>
            ))}
          </select>
        </h2>
        <div className="border-l-[4px] border-black pl-4">
          <input
            type="text"
            className="w-full font-serif text-5xl font-black leading-none uppercase bg-transparent outline-none placeholder:text-black/30 disabled:opacity-50"
            value={loggedWorkout?.workout_type ?? workout.workout_type}
            onChange={(e) => {
              if (loggedWorkout) {
                setLoggedWorkout({ ...loggedWorkout, workout_type: e.target.value });
              }
            }}
            onBlur={(e) => updateWorkoutDetail('workout_type', e.target.value)}
            placeholder="Workout Type"
            disabled={loggedWorkout?.isCompleted}
          />
        </div>
        <input
          type="text"
          className="w-full font-sans font-medium text-lg uppercase tracking-tight bg-transparent outline-none placeholder:text-black/30 disabled:opacity-50"
          value={loggedWorkout?.focus ?? workout.focus}
          onChange={(e) => {
            if (loggedWorkout) {
              setLoggedWorkout({ ...loggedWorkout, focus: e.target.value });
            }
          }}
          onBlur={(e) => updateWorkoutDetail('focus', e.target.value)}
          placeholder="Focus"
          disabled={loggedWorkout?.isCompleted}
        />
      </section>

      {/* Warmup Section */}
      <section className="bg-[#EBEBEB] border-[4px] border-black p-4 space-y-4">
        <h3 className="font-serif text-2xl font-black uppercase tracking-tighter border-b-2 border-black pb-2">Warmup Protocol</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-sans font-bold text-sm uppercase opacity-70 mb-2">Thermal Activation</h4>
            <ul className="space-y-1 font-mono text-xs">
              <li>&gt; 5 Min Incline Walk / Row</li>
              <li>&gt; 2x15 Band Pull-Aparts</li>
              <li>&gt; 2x10 Scapular Pushups</li>
            </ul>
          </div>
          <div>
            <h4 className="font-sans font-bold text-sm uppercase opacity-70 mb-2">Static Lengthening</h4>
            <ul className="space-y-1 font-mono text-xs">
              <li>&gt; 60s Dead Hang</li>
              <li>&gt; 60s Deep Squat Hold</li>
              <li>&gt; 30s Chest Stretch (Wall)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Routine list */}
      <section className="space-y-8">
        {workout.exercises.length === 0 ? (
          <div className="p-6 border-[4px] border-black border-dashed flex flex-col items-center justify-center text-center">
             <p className="font-serif text-2xl font-black uppercase">Active Recovery</p>
             <p className="font-sans text-sm mt-2 opacity-70">No mandated lifts today. Rebuild.</p>
          </div>
        ) : (
          (loggedWorkout?.exercises || []).map((logEx, exIndex) => {
            const staticEx = workout.exercises[exIndex] || { name: logEx.name || "Unknown", notes: "", reps: 0 };
            const allCompleted = logEx.sets.length > 0 && logEx.sets.every(s => s.completed);
            
            return (
              <motion.div 
                key={exIndex} 
                animate={allCompleted ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className={cn(
                  "border-[4px] p-4 space-y-4 transition-all duration-500",
                  allCompleted ? "bg-[#EBEBEB] border-black/50 grayscale opacity-90" : "bg-white border-black"
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <h3 
                        className={cn(
                          "font-sans font-black text-2xl uppercase tracking-tighter transition-all duration-300 flex items-center gap-2",
                          allCompleted && "line-through text-black/50 grayscale",
                          !loggedWorkout?.isCompleted && "cursor-pointer hover:underline decoration-black/30 underline-offset-4"
                        )}
                        onClick={() => !loggedWorkout?.isCompleted && setSwappingExIndex(exIndex)}
                      >
                        {logEx.name || staticEx.name}
                        {customExercises.some(ce => ce.name === (logEx.name || staticEx.name)) && (
                          <span className="bg-black text-white px-1.5 py-0.5 text-[10px] font-mono tracking-widest leading-none origin-left scale-90 sm:scale-100 no-underline inline-block">
                            CUSTOM
                          </span>
                        )}
                      </h3>
                      {previousStats[logEx.name || staticEx.name] && (
                        <span className="font-mono text-[10px] font-bold uppercase opacity-60 tracking-widest mt-1">
                          Prev Max: {previousStats[logEx.name || staticEx.name].weight}KG × {previousStats[logEx.name || staticEx.name].reps}
                        </span>
                      )}
                    </div>
                    {allCompleted && (
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="bg-black text-white p-1 border-[2px] border-black"
                      >
                        <Check className="w-5 h-5" strokeWidth={4} />
                      </motion.div>
                    )}
                  </div>
                  {staticEx.notes && <p className="font-serif text-lg leading-snug italic border-l-[4px] border-black pl-4 py-2 mt-2 bg-[#EBEBEB]">{staticEx.notes}</p>}
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60 px-2">
                    <div>Set</div>
                    <div>KG</div>
                    <div>Reps</div>
                    <div className="text-right">Done</div>
                  </div>
                  {logEx.sets && logEx.sets.map((set, setIndex) => (
                    <motion.div 
                      key={setIndex}
                      initial={false}
                      animate={{
                        scale: set.completed ? 0.98 : 1,
                        backgroundColor: set.completed ? "#EBEBEB" : "#ffffff",
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className={cn(
                        "grid grid-cols-4 gap-2 items-center p-2 border-[4px] border-black transition-all",
                        set.completed && "opacity-60 grayscale border-black/50"
                      )}
                    >
                      <div className={cn("font-mono font-bold text-sm", set.completed && "line-through text-black/50")}>{setIndex + 1}</div>
                      
                      <input 
                        type="number" 
                        value={set.weight || ''} 
                        onChange={e => updateSet(exIndex, setIndex, 'weight', Number(e.target.value))}
                        disabled={set.completed || loggedWorkout?.isCompleted}
                        placeholder="--"
                        className={cn(
                          "w-full bg-transparent border-b-2 border-black/20 focus:border-black outline-none font-mono text-center appearance-none disabled:opacity-50",
                          set.completed && "line-through text-black/50"
                        )}
                      />
                      
                      <input 
                        type="number" 
                        value={set.reps || ''} 
                        onChange={e => updateSet(exIndex, setIndex, 'reps', Number(e.target.value))}
                        disabled={set.completed || loggedWorkout?.isCompleted}
                        placeholder={staticEx.reps?.toString() || '--'}
                        className={cn(
                          "w-full bg-transparent border-b-2 border-black/20 focus:border-black outline-none font-mono text-center appearance-none disabled:opacity-50",
                          set.completed && "line-through text-black/50"
                        )}
                      />

                      <button 
                        onClick={() => updateSet(exIndex, setIndex, 'completed', !set.completed)}
                        className="flex items-center justify-end gap-2 pr-2 disabled:opacity-50"
                        disabled={loggedWorkout?.isCompleted}
                      >
                        {set.completed && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="w-2 h-2 rounded-full bg-green-500"
                          />
                        )}
                        <motion.div 
                          animate={{ 
                            backgroundColor: set.completed ? "#000000" : "rgba(0,0,0,0)",
                            scale: set.completed ? [1, 1.2, 1] : 1
                          }}
                          transition={{ duration: 0.3 }}
                          className={cn(
                            "w-6 h-6 border-[4px] border-black flex items-center justify-center",
                            !set.completed && "text-transparent hover:bg-black/10 transition-colors"
                          )}
                        >
                          {set.completed && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: [0.5, 1.3, 1], opacity: 1 }}
                              transition={{ duration: 0.3, ease: "easeOut" }}
                            >
                              <Check className="w-4 h-4 text-white" strokeWidth={4} />
                            </motion.div>
                          )}
                        </motion.div>
                      </button>
                    </motion.div>
                  ))}
                  <button
                    onClick={() => addSet(exIndex)}
                    disabled={loggedWorkout?.isCompleted}
                    className="w-full py-2 mt-2 font-mono text-xs font-bold uppercase border-[2px] border-dashed border-black/50 hover:border-black hover:bg-black/5 transition-colors flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none"
                  >
                    + Add Set
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </section>

      {/* Complete Workout Button */}
      {loggedWorkout?.exercises && loggedWorkout.exercises.length > 0 && !loggedWorkout.isCompleted && (
        <section className="pt-8">
          <button
            onClick={completeWorkout}
            className="w-full bg-black text-white py-4 font-serif text-2xl font-black uppercase tracking-widest hover:bg-black/80 transition-colors"
          >
            Complete Workout
          </button>
        </section>
      )}
      
      {loggedWorkout?.isCompleted && (
        <section className="pt-8 flex flex-col items-center justify-center space-y-2">
          <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center">
            <Check className="w-6 h-6 text-white" strokeWidth={4} />
          </div>
          <p className="font-serif text-2xl font-black uppercase">Workout Completed</p>
          <p className="font-sans text-sm opacity-70">This workout has been moved to your archives.</p>
        </section>
      )}

      <AnimatePresence>
        {swappingExIndex !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm"
          >
            <div className="absolute inset-0" onClick={() => {
              setSwappingExIndex(null);
              setSwapSearch("");
            }} />
            
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-[#EBEBEB] border-t-[8px] border-black p-6 pb-12 w-full relative z-10 max-h-[85vh] flex flex-col rounded-t-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] max-w-3xl mx-auto"
            >
              <button 
                onClick={() => {
                  setSwappingExIndex(null);
                  setSwapSearch("");
                }}
                className="absolute top-4 right-4 bg-black/10 p-2 rounded-full hover:bg-black/20"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="font-serif text-3xl font-black uppercase mb-6">Swap Exercise</h2>
              
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-50" />
                <input 
                  type="text"
                  placeholder="Search exercises..."
                  value={swapSearch}
                  onChange={e => setSwapSearch(e.target.value)}
                  className="w-full bg-white border-[4px] border-black p-3 pl-10 font-mono text-lg font-bold outline-none focus:bg-[#f5f5f5] transition-colors"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 mb-6">
                <button 
                  onClick={() => setFilterStatus('all')}
                  className={`px-4 py-1.5 font-mono text-sm font-bold uppercase transition-colors ${filterStatus === 'all' ? 'bg-black text-white' : 'bg-white border-2 border-black text-black hover:bg-[#f5f5f5]'}`}
                >
                  All Exercises
                </button>
                <button 
                  onClick={() => setFilterStatus('custom')}
                  className={`px-4 py-1.5 font-mono text-sm font-bold uppercase transition-colors ${filterStatus === 'custom' ? 'bg-black text-white' : 'bg-white border-2 border-black text-black hover:bg-[#f5f5f5]'}`}
                >
                  Custom
                </button>
              </div>

              <div className="bg-white border-[4px] border-black p-4 mb-6">
                <h3 className="font-sans font-black uppercase text-sm mb-2 opacity-60 flex items-center">
                  <Plus className="w-4 h-4 mr-1"/> Custom Exercise
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="E.g., Chest Fly"
                    value={newCustomName}
                    onChange={e => setNewCustomName(e.target.value)}
                    className="flex-grow border-2 border-black p-2 font-mono text-sm outline-none"
                  />
                  <button
                    onClick={createCustomExercise}
                    disabled={!newCustomName.trim()}
                    className="bg-black text-white px-4 font-mono font-bold uppercase text-sm disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto pr-2 space-y-2 flex-grow">
                {allExercises
                  .filter(e => e.name.toLowerCase().includes(swapSearch.toLowerCase()))
                  .filter(e => filterStatus === 'all' || customExercises.some(ce => ce.name === e.name))
                  .map(e => (
                  <button
                    key={e.name}
                    onClick={() => {
                      swapExercise(swappingExIndex, e.name);
                      setSwapSearch("");
                      setFilterStatus('all');
                    }}
                    className="w-full text-left bg-white border-[4px] border-black p-4 hover:bg-black hover:text-white transition-colors group flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="font-sans font-black text-xl uppercase tracking-tight flex items-center gap-2">
                        {e.name}
                        {customExercises.some(ce => ce.name === e.name) && (
                          <span className="bg-black text-white group-hover:bg-white group-hover:text-black px-1.5 py-0.5 text-[10px] font-mono tracking-widest leading-none">
                            CUSTOM
                          </span>
                        )}
                      </span>
                      {previousStats[e.name] && (
                        <span className="font-mono text-[10px] font-bold opacity-60 uppercase mt-1 tracking-widest">
                          Prev Max: {previousStats[e.name].weight}KG × {previousStats[e.name].reps}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs opacity-50 group-hover:opacity-100 uppercase shrink-0 min-w-max ml-4">&gt; Select</span>
                  </button>
                ))}
                {allExercises.filter(e => e.name.toLowerCase().includes(swapSearch.toLowerCase())).filter(e => filterStatus === 'all' || customExercises.some(ce => ce.name === e.name)).length === 0 && (
                  <div className="p-8 text-center font-mono opacity-50 uppercase border-2 border-dashed border-black/20">
                    No exercises found matching "{swapSearch}"
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PlateCalculator />
    </div>
  );
}
