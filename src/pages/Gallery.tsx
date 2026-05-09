import { useState } from "react";
import { routineData } from "../data/routine";
import { motion, AnimatePresence } from "motion/react";
import { X, Play } from "lucide-react";
import { Exercise } from "../types";

import { extraExercises } from "../data/extraExercises";

const VIDEO_MAP: Record<string, string> = {
  "Flat Dumbbell Press": "o7TvO377OqA",
  "Incline Dumbbell Press": "0G2_XV7slIg",
  "Cable Crossovers": "taI4XduLpTk",
  "Dumbbell Lateral Raises": "Kl3LEzQ5Zqs",
  "Overhead Tricep Extensions": "fYqswDVbJDg",
  "Tricep Rope Pushdowns": "2-LAMcpzODU",
  "Assisted Pull-Up Machine": "owMowIRkyvQ",
  "Dumbbell Rows": "pYcpY20QaE8",
  "Lat Pullovers": "32auHIqgEoM",
  "Face Pulls": "pB9qVPwWp1I",
  "Incline Bicep Curls": "XhIsIcjIbCw",
  "Hammer Curls": "zC3nLlEvin4",
  "Hack Squats": "0tn5K9NlCfo",
  "Bulgarian Split Squats": "2C-uNgKwPLE",
  "Leg Extensions": "YyvSfVjQeL0",
  "Lying Hamstring Curls": "d6sg829PgNs",
  "Standing Calf Raises": "-M4-G8p8fmc",
  "Seated DB Shoulder Press": "qEwKCR5JCog",
  "Seated Cable Rows": "GZbfZ033f74",
  "Preacher Curls": "fIWP-FRFNU0",
  "Romanian Deadlifts": "JCXUYuzwNrM",
  "Seated Hamstring Curls": "F488k67BTNo",
  "Walking Lunges": "D7KaRcUTQeE",
  "Seated Calf Raises": "JbyjNymZOt0",
  // Additional videos for extra exercises
  "Barbell Squat": "bEv6CCg2BC8",
  "Barbell Bench Press": "rT7DgCr-3pg",
  "Conventional Deadlift": "op9kVnSso6Q",
  "Overhead Press": "zoN5EH50Dro",
  "Barbell Row": "G8l_8chR5BE",
  "Pull-Ups": "ym1V5H35IpA",
  "Dips": "2z8JmcrW-As",
  "Front Squat": "nmUof3vszxM",
  "Hip Thrust": "SEdqd1n0cvg",
  "Bicep Curls": "ykJmrZ5v0Oo",
  "Tricep Extensions": "nRiJVZDpdL0",
  "Lat Pulldown": "CAwf7n6Luuc",
  "Leg Press": "K5n2vg3oZa4",
  "Goblet Squat": "lRYBbchqxtI",
  "Kettlebell Swing": "YSxHifyI6s8",
  "Plank": "ASdvN_XEl_c",
  "Ab Rollout": "MinlHnG7j4k",
  "Pec Deck Fly": "g3T7LsEeDWQ",
  "Cable Crossover": "taI4XduLpTk",
  "Face Pulls": "IeOqdw9WI90",
  "Lateral Raises": "JMt_uxE8bBc"
};

export function Gallery() {
  const allExercises = Array.from(new Map(
    [...routineData.routine.flatMap(day => day.exercises), ...extraExercises].map(ex => [ex.name, ex])
  ).values()).sort((a, b) => a.name.localeCompare(b.name));

  const [selectedEx, setSelectedEx] = useState<Exercise | null>(null);

  // Generate a mock youtube query or search URL for the video embed (Since we don't have exact youtube IDs for 30 lifts, we will just simulate the video frame or link to search)
  
  return (
    <div className="p-6 space-y-6">
      <section className="space-y-2 mb-8">
        <h2 className="font-serif text-5xl font-black leading-none uppercase break-words border-l-[4px] border-black pl-4">
          Gallery
        </h2>
        <p className="font-sans font-medium text-lg uppercase tracking-tight opacity-70">
          Movement Encyclopedia
        </p>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {allExercises.map((ex, i) => (
          <button
            key={i}
            onClick={() => setSelectedEx(ex)}
            className="text-left bg-white border-[4px] border-black p-4 hover:bg-black hover:text-white transition-colors duration-300 flex justify-between items-center group"
          >
            <span className="font-sans font-bold uppercase tracking-tight">{ex.name}</span>
            <Play className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {selectedEx && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEx(null)}
              className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: "100%" }} 
              animate={{ x: 0 }} 
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l-[4px] border-black z-[60] overflow-y-auto overscroll-contain flex flex-col min-h-full [-webkit-overflow-scrolling:touch]"
            >
              <div className="sticky top-0 bg-white border-b-[4px] border-black p-4 flex justify-between items-center z-10">
                <h3 className="font-serif text-2xl font-black uppercase tracking-tighter truncate pr-4">{selectedEx.name}</h3>
                <button 
                  onClick={() => setSelectedEx(null)} 
                  className="p-2 bg-[#F2F2F2] border-[4px] border-black hover:bg-black hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-8 flex-1 pb-32">
                {/* Real Video Embed */}
                <div className="w-full aspect-video bg-[#EBEBEB] border-[4px] border-black flex items-center justify-center relative overflow-hidden group mb-2">
                   {VIDEO_MAP[selectedEx.name] ? (
                     <iframe 
                       className="w-full h-full"
                       src={`https://www.youtube-nocookie.com/embed/${VIDEO_MAP[selectedEx.name]}?rel=0&modestbranding=1`}
                       title={`${selectedEx.name} Tutorial`}
                       frameBorder="0"
                       allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                       allowFullScreen
                     ></iframe>
                   ) : (
                     <div className="flex flex-col items-center justify-center w-full h-full p-4 text-center z-10">
                       <p className="font-sans text-sm font-bold opacity-60 mb-4 tracking-wider">VIDEO UNAVAILABLE</p>
                       <a 
                         href={`https://www.youtube.com/results?search_query=${selectedEx.name.replace(/\s+/g, '+')}+exercise+tutorial`}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="bg-red-600 text-white w-full max-w-[85%] py-4 font-black uppercase tracking-widest text-sm border-[4px] border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:bg-black hover:text-white hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-3"
                       >
                         <Play className="w-6 h-6 fill-white" />
                         Search YouTube for Tutorial
                       </a>
                     </div>
                   )}
                </div>
                
                {VIDEO_MAP[selectedEx.name] && (
                  <div className="flex justify-end mb-6">
                    <a 
                      href={`https://www.youtube.com/watch?v=${VIDEO_MAP[selectedEx.name]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs uppercase font-bold text-blue-600 hover:text-blue-800 underline"
                    >
                      Watch on YouTube
                    </a>
                  </div>
                )}

                <div>
                  <h4 className="font-sans font-bold text-lg uppercase border-b-2 border-black pb-1 mb-4">Execution Steps</h4>
                  <ol className="list-decimal list-outside ml-5 space-y-3 font-serif text-lg leading-snug">
                     <li>Stabilize your core and plant your feet firmly.</li>
                     <li>Initiate the movement by controlling the eccentric phase slowly.</li>
                     <li>Explode through the concentric phase.</li>
                     <li>Squeeze at peak contraction.</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-sans font-bold text-lg uppercase border-b-2 border-black pb-1 mb-4">Mental Cues</h4>
                  <div className="bg-black text-white p-4 font-mono text-sm">
                    {selectedEx.notes || "Push floor away. Break the bar. Chest up."}
                  </div>
                </div>

                <div>
                  <h4 className="font-sans font-bold text-lg uppercase border-b-2 border-red-600 text-red-600 pb-1 mb-4">Common Mistakes</h4>
                  <ul className="space-y-3 font-sans text-sm pb-12">
                     <li className="flex gap-2">
                       <X className="w-5 h-5 shrink-0 text-red-600" />
                       <span>Using momentum instead of strict muscle contraction. <br/><strong className="text-black">Fix:</strong> Lower the weight, master form.</span>
                     </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
