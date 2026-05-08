import { routineData } from "../data/routine";
import { cn } from "../components/AppShell";

export function Split() {
  const currentDay = new Date().getDay() || 7;

  return (
    <div className="p-6 space-y-8">
      <section className="space-y-2">
        <h2 className="font-serif text-5xl font-black leading-none uppercase break-words border-l-[4px] border-black pl-4">
          The Split
        </h2>
        <p className="font-sans font-medium text-lg uppercase tracking-tight opacity-70">
          6-Day Push / Pull / Legs
        </p>
      </section>

      <section className="space-y-4">
        {routineData.routine.map((day) => (
          <div key={day.day_number} className="group cursor-pointer">
            <div className={cn(
              "p-4 border-[4px] border-black transition-all duration-300",
              day.day_number === currentDay
                ? "bg-yellow-400 text-black hover:bg-yellow-300"
                : day.workout_type === "Rest" 
                  ? "bg-black text-white hover:bg-[#F2F2F2] hover:text-black" 
                  : "bg-white hover:bg-[#EBEBEB]"
            )}>
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-sm font-bold tracking-widest">
                  DAY {day.day_number}
                </span>
                <span className="font-serif text-2xl font-black uppercase tracking-tighter">
                  {day.workout_type}
                </span>
              </div>
              <div className="flex justify-between items-end border-t-2 border-black/10 pt-2 mt-2">
                <span className="font-sans text-sm font-bold uppercase">{day.focus}</span>
                <span className="text-[10px] font-mono opacity-60 uppercase">{day.exercises.length} Movements</span>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
