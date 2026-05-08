import { useState, useEffect } from "react";
import { auth, db } from "../services/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { LoggedWorkout } from "../types";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../components/AppShell";

export function Archives() {
  const [history, setHistory] = useState<LoggedWorkout[]>([]);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [selectedLift, setSelectedLift] = useState<string | null>(null);

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
  let maxWeightOverTime: number[] = [];
  
  // To chart properly from oldest to newest:
  const chronoHistory = [...history].reverse();
  chronoHistory.forEach(workout => {
    const ex = workout.exercises.find(e => e.name === activeLift);
    if (ex) {
       const completedSets = ex.sets.filter(s => s.completed);
       if (completedSets.length > 0) {
         const maxW = Math.max(...completedSets.map(s => s.weight || 0));
         if (maxW > 0) maxWeightOverTime.push(maxW);
       }
    }
  });

  // Chart scaling
  const chartHeight = 150;
  const chartWidth = 300;
  const maxW = Math.max(...maxWeightOverTime, 20);
  const minW = Math.min(...maxWeightOverTime.filter(w => w > 0), maxW - 20);
  const range = maxW - minW === 0 ? 1 : maxW - minW;

  const points = maxWeightOverTime.map((val, i) => {
    const x = maxWeightOverTime.length > 1 ? (i / (maxWeightOverTime.length - 1)) * chartWidth : chartWidth / 2;
    const y = chartHeight - ((val - minW) / range) * (chartHeight - 40) - 20; // 20px padding top/bottom
    return `${x},${y}`;
  }).join(" ");

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

      {/* SVG Chart */}
      <section className="bg-white border-[4px] border-black p-6 space-y-4">
         <div>
            <h3 className="font-serif text-2xl font-black uppercase">Strength Velocity</h3>
            <p className="font-mono text-xs opacity-60 uppercase mb-4">Progressive Overload Trends</p>
         </div>

         {topExercises.length > 0 && (
           <div className="flex flex-wrap gap-2">
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
         
         <div className="w-full overflow-x-auto pb-4">
           {maxWeightOverTime.length >= 2 ? (
              <svg width={chartWidth} height={chartHeight} className="overflow-visible stroke-black">
                <polyline 
                  points={points} 
                  fill="none" 
                  strokeWidth="4" 
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {maxWeightOverTime.map((val, i) => {
                  const x = (i / (maxWeightOverTime.length - 1)) * chartWidth;
                  const y = chartHeight - ((val - minW) / range) * (chartHeight - 40) - 20;
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r="4" fill="#F2F2F2" strokeWidth="4" className="stroke-black" />
                      {i === maxWeightOverTime.length - 1 && (
                        <text x={x} y={y - 12} fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                          {val}KG
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
           ) : (
             <div className="h-[150px] flex items-center justify-center font-mono text-sm opacity-50 uppercase border-2 border-dashed border-black/20">
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
                  <div className="text-left flex flex-col">
                    <span className="font-sans font-bold uppercase">{new Date(workout.date).toLocaleDateString()}</span>
                    <span className="font-serif text-lg leading-none mt-1">{workout.workout_type} - {workout.focus}</span>
                  </div>
                  <ChevronDown className={cn(
                    "w-6 h-6 transition-transform duration-300",
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
