import { Outlet, NavLink } from "react-router-dom";
import { type ReactNode } from "react";
import { MoveRight, CalendarDays, LayoutList, BookOpen, Orbit } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function AppShell() {
  return (
    <div className="flex flex-col min-h-[100dvh] w-full max-w-2xl mx-auto bg-[#F2F2F2] border-x-0 sm:border-x-[4px] border-black relative overflow-hidden">
      
      {/* Top Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white border-b-[4px] border-black">
        <h1 className="font-serif font-black text-2xl uppercase tracking-tighter mix-blend-difference">
          Overload
        </h1>
        <Orbit className="w-6 h-6" />
      </header>

      {/* Main Content Area: Fluid Scrolling */}
      <main className="flex-1 w-full overflow-y-auto overscroll-contain pb-24">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full max-w-2xl bg-white border-t-[4px] border-black z-50">
        <div className="flex justify-between items-center px-2 py-4">
          <NavItem to="/" icon={<MoveRight className="w-6 h-6" />} label="Today" />
          <NavItem to="/split" icon={<CalendarDays className="w-6 h-6" />} label="Split" />
          <NavItem to="/gallery" icon={<BookOpen className="w-6 h-6" />} label="Gallery" />
          <NavItem to="/archives" icon={<LayoutList className="w-6 h-6" />} label="Logs" />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center w-full gap-1 transition-all",
          isActive ? "text-black" : "text-gray-400 hover:text-black"
        )
      }
    >
      {icon}
      <span className="text-[10px] font-bold tracking-widest uppercase">{label}</span>
    </NavLink>
  );
}
