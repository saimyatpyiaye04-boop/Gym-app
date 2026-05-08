import { useState, useEffect } from "react";
import { routineData } from "../data/routine";
import { motion } from "motion/react";
import { cn } from "../components/AppShell"; // reusing the cn utility
import { Check } from "lucide-react";
import { auth, db } from "../services/firebase";
import { collection, doc, setDoc, onSnapshot, getDocs, query, orderBy, limit } from "firebase/firestore";
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
  const dayNumber = rawDay === 0 ? 7 : rawDay;

  const workout = routineData.routine.find(r => r.day_number === dayNumber);

  const [loggedWorkout, setLoggedWorkout] = useState<LoggedWorkout | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser || !workout) return;
    const todayStr = date.toISOString().split('T')[0];
    const path = `users/${auth.currentUser.uid}/workouts`;
    
    // Auto-create or resume today's workout
    const workoutRef = doc(db, path, todayStr);
    
    const unsubscribe = onSnapshot(workoutRef, (snap) => {
      if (snap.exists()) {
        setLoggedWorkout({ id: snap.id, ...snap.data() } as LoggedWorkout);
      } else {
        const newWorkout: LoggedWorkout = {
          day_number: workout.day_number,
          workout_type: workout.workout_type,
          focus: workout.focus,
          date: Date.now(),
          exercises: workout.exercises.map(ex => ({
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

    return () => unsubscribe();
  }, [dayNumber]);

  const updateSet = async (exIndex: number, setIndex: number, field: 'reps' | 'weight' | 'completed', value: number | boolean) => {
    if (!loggedWorkout || !auth.currentUser) return;
    
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
    } catch (err) {
      setErrorMsg('Failed to save workout. Check your connection.');
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}/workouts`);
    }
  };

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
        <h2 className="font-sans text-sm font-bold tracking-widest uppercase opacity-70">
          Day {workout.day_number} &mdash; {date.toLocaleDateString('en-US', { weekday: 'long' })}
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
                  "border-[4px] border-black p-4 space-y-4 transition-colors duration-500",
                  allCompleted ? "bg-[#EBEBEB]" : "bg-white"
                )}
              >
                <div>
                  <h3 className="font-sans font-black text-2xl uppercase tracking-tighter">{staticEx.name}</h3>
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
                        "grid grid-cols-4 gap-2 items-center p-2 border-[4px] border-black",
                        set.completed && "opacity-50 grayscale"
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
                        placeholder={staticEx.reps.toString()}
                        className={cn(
                          "w-full bg-transparent border-b-2 border-black/20 focus:border-black outline-none font-mono text-center appearance-none disabled:opacity-50",
                          set.completed && "line-through text-black/50"
                        )}
                      />

                      <button 
                        onClick={() => updateSet(exIndex, setIndex, 'completed', !set.completed)}
                        className="flex justify-end pr-2 disabled:opacity-50"
                        disabled={loggedWorkout?.isCompleted}
                      >
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

    </div>
  );
}
