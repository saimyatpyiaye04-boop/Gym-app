import { useState, useEffect, ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, loginWithGoogle } from "./services/firebase";
import { AppShell } from "./components/AppShell";
import { Orbit } from "lucide-react";

export function AuthWrapper({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    try {
      setError("");
      await loginWithGoogle();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#F2F2F2] flex flex-col items-center justify-center sm:border-x-[4px] border-black max-w-2xl mx-auto">
        <Orbit className="w-12 h-12 animate-spin mb-4" />
        <p className="font-mono text-sm tracking-widest uppercase animate-pulse">Initializing System...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#F2F2F2] flex flex-col items-center justify-center p-6 sm:border-x-[4px] border-black max-w-2xl mx-auto text-center relative overflow-hidden">
        
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center">
           <h1 className="text-[20rem] font-serif font-black uppercase text-black break-all leading-none text-center">OVERLOAD</h1>
        </div>

        <div className="z-10 bg-white border-[4px] border-black p-8 max-w-md w-full shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
          <Orbit className="w-16 h-16 mb-6 mx-auto" />
          <h2 className="font-serif text-4xl font-black uppercase tracking-tighter mb-2">Overload</h2>
          <p className="font-sans font-medium mb-8 text-black/70">Execute. Log. Progress. No excuses.</p>
          
          {error && <div className="mb-4 bg-red-100 text-red-900 border-2 border-red-900 p-2 text-sm font-mono">{error}</div>}

          <button 
            onClick={handleLogin}
            className="w-full bg-black text-white py-4 font-bold uppercase tracking-widest text-sm border-[4px] border-transparent hover:bg-white hover:text-black hover:border-black transition-colors"
          >
            Authenticate via Google
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
