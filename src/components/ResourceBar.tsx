import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ResourceBarProps {
  label: string;
  value: number;
  colorClass?: string;
  icon: LucideIcon;
  isDead?: boolean;
}

const ResourceBar: React.FC<ResourceBarProps> = ({ label, value, icon: Icon, isDead }) => {
  // Determine specific styling based on label content
  const isHp = label.toLowerCase().includes('vida') ||
               label.toLowerCase().includes('hp') ||
               label.toLowerCase().includes('integridade');

  const isChakra = label.toLowerCase().includes('chakra') ||
                   label.toLowerCase().includes('cp') ||
                   label.toLowerCase().includes('energia');

  // HP/CP são estatísticas fixas do personagem, não um recurso que se esgota —
  // a barra sempre aparece cheia; o valor real fica só no rótulo "VAL:".
  const fillPercent = 100;

  let barGradient = 'bg-tech-secondary';
  let glowColor = 'shadow-[0_0_10px_rgba(14,165,233,0.4)]';
  let textColor = 'text-tech-primary';
  let iconColor = 'text-tech-primary';
  let pulseAnimation = '';
  
  // Logic for Broken/Dead state vs Alive state
  if (isDead) {
     // Corrupted / Dead State
     // Uses a striped pattern to mimic a "hazard" or "no signal" area
     barGradient = 'bg-neutral-900 bg-[repeating-linear-gradient(45deg,#171717,#171717_10px,#262626_10px,#262626_20px)]';
     glowColor = 'shadow-none';
     textColor = 'text-neutral-600 line-through decoration-2 decoration-red-900/50';
     iconColor = 'text-neutral-700';
     pulseAnimation = 'animate-flicker opacity-60';
  } else if (isHp) {
    // Alive: Red for Life
    barGradient = 'bg-gradient-to-r from-red-900 via-red-600 to-red-500';
    glowColor = 'shadow-[0_0_15px_rgba(220,38,38,0.6)]';
    textColor = 'text-red-500';
    iconColor = 'text-red-500';
    pulseAnimation = 'animate-[pulse_3s_ease-in-out_infinite]';
  } else if (isChakra) {
    // Alive: Blue for Chakra
    barGradient = 'bg-gradient-to-r from-blue-900 via-blue-600 to-blue-400';
    glowColor = 'shadow-[0_0_15px_rgba(59,130,246,0.6)]';
    textColor = 'text-blue-400';
    iconColor = 'text-blue-400';
    pulseAnimation = 'animate-[pulse_4s_ease-in-out_infinite]';
  }

  return (
    <div className="mb-4 group">
      <div className="flex justify-between items-end mb-1 text-xs font-bold uppercase tracking-widest">
        <span className={`flex items-center gap-2 transition-colors duration-300 ${textColor} group-hover:brightness-125`}>
          <Icon size={14} className={iconColor} /> 
          {label} {isDead && <span className="text-[9px] no-underline ml-1 text-red-900 font-black">[OFFLINE]</span>}
        </span>
        <span className={`font-mono text-[10px] border px-2 flex items-center gap-2 ${isDead ? 'text-neutral-600 border-neutral-800 bg-black' : 'text-tech-dim border-tech-dim/30 bg-black/80'}`}>
            VAL: <span className={`${isDead ? 'text-neutral-500' : 'text-white'} text-sm`}>{value}</span>
        </span>
      </div>
      
      {/* Container */}
      <div className={`w-full h-5 bg-black/80 border p-[1px] relative overflow-hidden backdrop-blur-sm ${isDead ? 'border-neutral-800' : 'border-tech-dim/50'}`}>
        
        {/* Background grid lines (ticks) for measurement feel */}
        <div className="absolute inset-0 flex justify-between px-1 pointer-events-none z-20 opacity-20">
            {[...Array(20)].map((_, i) => (
                <div key={i} className={`w-px h-full ${isDead ? 'bg-neutral-800' : 'bg-white'}`}></div>
            ))}
        </div>
        
        {/* The Animated Bar */}
        <div className="relative w-full h-full bg-gray-900/50">
            <div 
              className={`h-full ${barGradient} ${glowColor} relative overflow-hidden transition-all duration-1000 ${pulseAnimation}`}
              style={{ width: `${fillPercent}%` }}
            >
                {/* Fluid Shimmer Effect - ONLY if alive */}
                {!isDead && (
                    <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] animate-shimmer skew-x-[-20deg]"></div>
                )}

                {/* Dead Noise Effect - ONLY if dead */}
                {isDead && (
                    <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNmZmYiLz4KPC9zdmc+')]"></div>
                )}
                
                {/* Subtle texture/noise pattern common to both but fainter on dead */}
                <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.2)_4px,rgba(0,0,0,0.2)_8px)] opacity-50"></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ResourceBar;