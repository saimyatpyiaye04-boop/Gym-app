import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calculator, X } from 'lucide-react';
import { cn } from './AppShell';

export function PlateCalculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [weight, setWeight] = useState<string>("100");
  const [barWeight, setBarWeight] = useState<string>("20");

  const parsedWeight = parseFloat(weight) || 0;
  const parsedBar = parseFloat(barWeight) || 0;
  
  const platesList = [25, 20, 15, 10, 5, 2.5, 1.25];
  let targetPerSide = (parsedWeight - parsedBar) / 2;
  const platesNeeded: { weight: number, count: number }[] = [];
  
  if (targetPerSide > 0) {
    let remaining = targetPerSide;
    for (const p of platesList) {
      if (remaining >= p) {
        const count = Math.floor(remaining / p);
        if (count > 0) {
          platesNeeded.push({ weight: p, count });
          remaining -= count * p;
        }
      }
    }
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-black text-white flex items-center justify-center rounded-full shadow-lg hover:scale-105 transition-transform z-40 border-4 border-white"
        aria-label="Plate Calculator"
      >
        <Calculator className="w-6 h-6" strokeWidth={3} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm"
          >
            <div className="absolute inset-0" onClick={() => setIsOpen(false)} />
            
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-white border-t-[8px] border-black p-6 pb-12 w-full relative z-10 max-w-3xl mx-auto rounded-t-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)]"
            >
              <button 
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 bg-black/10 p-2 rounded-full hover:bg-black/20"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="font-serif text-3xl font-black uppercase mb-6">Plate Calculator</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="font-sans font-bold text-xs uppercase tracking-widest opacity-60">Target Weight (KG)</label>
                    <input 
                      type="number" 
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="w-full border-[4px] border-black p-3 font-mono text-2xl font-bold bg-[#EBEBEB] outline-none focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-sans font-bold text-xs uppercase tracking-widest opacity-60">Bar Weight (KG)</label>
                    <input 
                      type="number" 
                      value={barWeight}
                      onChange={(e) => setBarWeight(e.target.value)}
                      className="w-full border-[4px] border-black p-3 font-mono text-2xl font-bold bg-[#EBEBEB] outline-none focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                <div className="bg-black text-white p-6 rounded-xl border-[4px] border-black shadow-[8px_8px_0px_#000000] shadow-black/20">
                  <h3 className="font-sans font-bold text-sm uppercase opacity-70 mb-4 tracking-widest">Plates Per Side</h3>
                  
                  {targetPerSide <= 0 ? (
                    <p className="font-mono text-lg opacity-50">Weight must be greater than bar.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {platesNeeded.length === 0 ? (
                        <p className="font-mono text-lg">No additional plates needed.</p>
                      ) : (
                        platesNeeded.map(plate => (
                          <div key={plate.weight} className="flex flex-col items-center">
                            <div className={cn(
                              "border-4 border-white flex items-center justify-center font-black rounded-full font-mono text-lg",
                              plate.weight >= 20 ? "w-16 h-16 bg-red-600" :
                              plate.weight === 15 ? "w-14 h-14 bg-yellow-500" :
                              plate.weight === 10 ? "w-12 h-12 bg-green-500" :
                              plate.weight === 5 ? "w-10 h-10 bg-white text-black" :
                              "w-8 h-8 bg-black border-2 border-white text-xs"
                            )}>
                              {plate.weight}
                            </div>
                            <span className="font-mono font-bold mt-2">x{plate.count}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
