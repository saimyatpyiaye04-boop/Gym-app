import React, { useState, useEffect } from "react";
import { auth, db } from "../services/firebase";
import { collection, query, orderBy, getDocs, doc, updateDoc } from "firebase/firestore";
import { LoggedWorkout } from "../types";
import { ChevronDown, Check, X, Edit2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../components/AppShell";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";

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
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function Archives() {
  const [history, setHistory] = useState<LoggedWorkout[]>([]);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [selectedLift, setSelectedLift] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState("");
  const [editFocus, setEditFocus] = useState("");

  useEffect(() => {
    async function fetchHistory() {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, `users/${auth.currentUser.uid}/workouts`),
          orderBy("date", "desc")
        );
        const snaps = await getDocs(q);
        setHistory(snaps.docs.map(d => ({ id: d.id, ...d.data() } as LoggedWorkout)));
      } catch (error) {
        console.error("Failed to load history", error);
        handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser.uid}/workouts`);
      }
    }
    fetchHistory();
  }, []);

  const toggleAccordion = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpdate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/workouts`;
    try {
      await updateDoc(doc(db, path, id), {
        workout_type: editType,
        focus: editFocus
      });
      setHistory(prev => prev.map(w => w.id === id ? { ...w, workout_type: editType, focus: editFocus } : w));
      setEditingId(null);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // Compute top exercises
  const exerciseFreq: Record<string, number> = {};
  history.forEach(w => {
    w.exercises.forEach(ex => {
      // Consider an exercise "logged" if it has at least one completed set
      if (ex.sets.some(s => s.completed)) {
         exerciseFreq[ex.name] = (exerciseFreq[ex.name] || 0) + 1;
      }
    });
  });

  const topExercises = Object.entries(exerciseFreq)
    .sort((a, b) => b[1] - a[1])
    .map(e => e[0])
    .slice(0, 3);

  const activeLift = selectedLift || topExercises[0] || "Flat Dumbbell Press";
  
  const chartData: { date: string, weight: number, reps: number }[] = [];
  
  let prWeight = 0;
  let prReps = 0;

  // To chart properly from oldest to newest:
  const chronoHistory = [...history].reverse();
  chronoHistory.forEach(workout => {
    const ex = workout.exercises.find(e => e.name === activeLift);
    if (ex) {
       const completedSets = ex.sets.filter(s => s.completed);
       if (completedSets.length > 0) {
         const bestSet = completedSets.reduce((prev, curr) => (curr.weight > prev.weight ? curr : prev));
         if (bestSet.weight > 0) {
           if (bestSet.weight > prWeight) {
             prWeight = bestSet.weight;
             prReps = bestSet.reps;
           }
           chartData.push({
             date: new Date(workout.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
             weight: bestSet.weight,
             reps: bestSet.reps
           });
         }
       }
    }
  });

  return (
    <div className="p-6 space-y-10">
      <section className="space-y-2">
        <h2 className="font-serif text-5xl font-black leading-none uppercase break-words border-l-[4px] border-black pl-4">
          Archives
        </h2>
        <p className="font-sans font-medium text-lg uppercase tracking-tight opacity-70">
          Telemetry & Logs
        </p>
      </section>

      {/* Recharts Chart */}
      <section className="bg-white border-[4px] border-black p-6 space-y-4">
         <div>
            <h3 className="font-serif text-2xl font-black uppercase">Strength Velocity</h3>
            <p className="font-mono text-xs opacity-60 uppercase mb-4">Progressive Overload Trends</p>
         </div>

         {topExercises.length > 0 && (
           <div className="flex flex-wrap gap-2 mb-4">
             {topExercises.map(lift => (
               <button
                 key={lift}
                 onClick={() => setSelectedLift(lift)}
                 className={cn(
                   "px-3 py-1 font-mono text-[10px] font-bold uppercase border-[2px] border-black transition-colors rounded-none",
                   activeLift === lift ? "bg-black text-white" : "bg-transparent text-black hover:bg-black/5"
                 )}
               >
                 {lift}
               </button>
             ))}
           </div>
         )}
         
         <div className="w-full h-[250px] pb-4">
           {chartData.length >= 2 ? (
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                 <XAxis 
                   dataKey="date" 
                   tick={{ fontSize: 10, fontFamily: 'monospace' }} 
                   stroke="#000" 
                   tickMargin={10} 
                   axisLine={false}
                   tickLine={false}
                 />
                 <YAxis 
                   tick={{ fontSize: 10, fontFamily: 'monospace' }} 
                   stroke="#000" 
                   axisLine={false}
                   tickLine={false}
                 />
                 <Tooltip 
                   contentStyle={{ backgroundColor: '#fff', border: '4px solid #000', borderRadius: '0', fontFamily: 'monospace', fontSize: '12px' }}
                   itemStyle={{ color: '#000', fontWeight: 'bold' }}
                   formatter={(value: number, name: string, props: any) => [`${value} kg × ${props.payload.reps}`, 'Max']}
                   labelStyle={{ display: 'none' }}
                   cursor={{ stroke: '#000', strokeWidth: 1, strokeDasharray: '4 4' }}
                 />
                 {prWeight > 0 && (
                   <ReferenceLine 
                     y={prWeight} 
                     stroke="#000" 
                     strokeDasharray="4 4" 
                     label={{ 
                       position: 'top', 
                       value: `PR: ${prWeight}KG × ${prReps}`, 
                       fill: '#000', 
                       fontSize: 10, 
                       fontFamily: 'monospace', 
                       fontWeight: 'bold' 
                     }} 
                   />
                 )}
                 <Line 
                   type="monotone" 
                   dataKey="weight" 
                   stroke="#000" 
                   strokeWidth={4} 
                   dot={{ r: 4, strokeWidth: 4, fill: '#fff', stroke: '#000' }} 
                   activeDot={{ r: 6, fill: '#000', stroke: '#000' }} 
                 />
               </LineChart>
             </ResponsiveContainer>
           ) : (
             <div className="h-full flex items-center justify-center font-mono text-sm opacity-50 uppercase border-2 border-dashed border-black/20">
               Insufficient Data
             </div>
           )}
         </div>
      </section>

      {/* Accordion Log */}
      <section className="space-y-4">
        <h3 className="font-serif text-3xl font-black uppercase tracking-tighter">Master Log</h3>
        {history.length === 0 ? (
          <p className="font-mono text-sm opacity-60">No logs found.</p>
        ) : (
          <div className="space-y-2">
            {history.map(workout => (
              <div key={workout.id} className="border-[4px] border-black bg-white">
                <button 
                  onClick={() => toggleAccordion(workout.id!)}
                  className="w-full flex justify-between items-center p-4 hover:bg-[#F2F2F2] transition-colors"
                >
                  <div className="text-left flex flex-col w-full pr-4">
                    <span className="font-sans font-bold uppercase">{new Date(workout.date).toLocaleDateString()}</span>
                    {editingId === workout.id ? (
                      <div className="flex flex-col sm:flex-row gap-2 mt-2 w-full" onClick={e => e.stopPropagation()}>
                        <input 
                          value={editType} 
                          onChange={e => setEditType(e.target.value)} 
                          className="font-serif text-lg leading-none border-b-2 border-black outline-none bg-transparent flex-1"
                          placeholder="Type"
                        />
                        <input 
                          value={editFocus} 
                          onChange={e => setEditFocus(e.target.value)} 
                          className="font-serif text-lg leading-none border-b-2 border-black outline-none bg-transparent flex-1"
                          placeholder="Focus"
                        />
                        <div className="flex gap-2 shrink-0">
                          <button onClick={(e) => handleUpdate(workout.id!, e)} className="bg-black text-white p-1 hover:opacity-80 transition-opacity"><Check className="w-5 h-5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="bg-black text-white p-1 hover:opacity-80 transition-opacity"><X className="w-5 h-5" /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group mt-1">
                        <span className="font-serif text-lg leading-none">{workout.workout_type} - {workout.focus}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(workout.id!);
                            setEditType(workout.workout_type);
                            setEditFocus(workout.focus);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/5 transition-opacity"
                        >
                          <Edit2 className="w-4 h-4 opacity-50" />
                        </button>
                      </div>
                    )}
                  </div>
                  <ChevronDown className={cn(
                    "w-6 h-6 transition-transform duration-300 shrink-0",
                    openIds.has(workout.id!) ? "rotate-180" : ""
                  )} />
                </button>

                <AnimatePresence>
                  {openIds.has(workout.id!) && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden border-t-[4px] border-black bg-[#EBEBEB]"
                    >
                      <div className="p-4 space-y-4">
                        {workout.exercises.map((ex, i) => (
                           <div key={i}>
                             <h4 className="font-sans font-bold text-sm uppercase">{ex.name}</h4>
                             <div className="grid grid-cols-2 gap-2 mt-2">
                               {ex.sets.map((set, sIdx) => set.completed && (
                                 <div key={sIdx} className="border-l-2 border-black pl-2 font-mono text-xs">
                                   Set {sIdx + 1}: {set.weight}kg x {set.reps}
                                 </div>
                               ))}
                             </div>
                           </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
