import React, { useState, useEffect } from 'react';
import { UserState } from '../types';
import { Terminal, RefreshCw, Cpu, HardDrive } from 'lucide-react';

interface HeaderProps {
  currentUser: UserState;
  activeLayout: 'split' | 'terminal' | 'gui' | 'cheatsheet';
  onLayoutChange: (layout: 'split' | 'terminal' | 'gui' | 'cheatsheet') => void;
  onUserSwitch: (user: UserState) => void;
  onResetData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  activeLayout,
  onLayoutChange,
  onUserSwitch,
  onResetData,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [cpuUsage, setCpuUsage] = useState<number>(12);
  const [ramUsage, setRamUsage] = useState<string>('4.2GB / 16GB');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      const hr = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      const se = String(d.getSeconds()).padStart(2, '0');
      setTimeStr(`${yr}-${mo}-${da} ${hr}:${mi}:${se}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Subtle telemetry variance
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage(Math.floor(9 + Math.random() * 8));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-12 border-b border-[#2A2B2F] flex items-center justify-between px-4 sm:px-6 bg-[#0F1014] select-none shrink-0 font-mono">
      {/* Left OS & Terminal Badges */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Terminal Window Control Dots */}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] shadow-xs cursor-pointer hover:opacity-80 transition-opacity"></div>
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-xs cursor-pointer hover:opacity-80 transition-opacity"></div>
          <div className="w-3 h-3 rounded-full bg-[#27C93F] shadow-xs cursor-pointer hover:opacity-80 transition-opacity"></div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs tracking-wider uppercase text-[#A0A0A0] font-bold">
            habitOS <span className="text-[#4ADE80]">v2.6.4</span> — Kernel 8.1.2
          </span>
          <span className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-[#16171D] text-[#6A6B6F] border border-[#2A2B2F]">
            tty: pts/0
          </span>
        </div>
      </div>

      {/* Right Telemetry & Clock */}
      <div className="flex items-center gap-4 sm:gap-6 text-[10px] text-[#6A6B6F] uppercase tracking-tighter">
        <span className="hidden sm:inline">CPU: <span className="text-[#E0E0E0]">{cpuUsage}%</span></span>
        <span className="hidden md:inline">RAM: <span className="text-[#E0E0E0]">{ramUsage}</span></span>
        <span className="hidden lg:inline">DISK: <span className="text-[#E0E0E0]">82%</span></span>
        <span className="text-[#A0A0A0] font-bold tracking-normal">{timeStr}</span>
      </div>
    </header>
  );
};
