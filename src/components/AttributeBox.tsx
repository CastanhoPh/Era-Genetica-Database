import React from 'react';
import { LucideIcon } from 'lucide-react';

interface AttributeBoxProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
}

const AttributeBox: React.FC<AttributeBoxProps> = ({ label, value, icon: Icon }) => {
  const maxStat = 30;
  const isUnknown = value === '?' || value === '？';
  
  // Se for desconhecido, consideramos 0 para a barra visual, senão usamos o valor numérico
  const numericValue = isUnknown ? 0 : Number(value);
  const clampedValue = Math.min(Math.max(numericValue, 0), maxStat);

  return (
    <div className={`border p-2 relative group transition-colors ${isUnknown ? 'border-tech-dim bg-tech-panel/20' : 'border-tech-dim bg-tech-panel/50 hover:border-tech-primary'}`}>
      {/* Corner accents */}
      <div className={`absolute top-0 left-0 w-1 h-1 ${isUnknown ? 'bg-tech-dim' : 'bg-tech-primary'}`}></div>
      <div className={`absolute bottom-0 right-0 w-1 h-1 ${isUnknown ? 'bg-tech-dim' : 'bg-tech-primary'}`}></div>

      <div className="flex items-center justify-between mb-1">
        <div className={`flex items-center gap-2 ${isUnknown ? 'text-tech-dim' : 'text-tech-primary/80'}`}>
          <Icon size={14} />
          <span className="text-xs uppercase tracking-widest">{label}</span>
        </div>
        <span className={`text-sm font-bold font-mono tabular-nums ${isUnknown ? 'text-tech-dim animate-pulse' : 'text-tech-primary'}`}>
          {isUnknown ? '??' : numericValue.toString().padStart(2, '0')}
        </span>
      </div>

      {/* 30 Segments for 1-30 scale */}
      <div className="flex gap-[1px] h-3 mt-1">
        {isUnknown ? (
             // Visualização para dados desconhecidos (padrão de ruído estático)
             <div className="w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,#1a2e1a_2px,#1a2e1a_4px)] opacity-50"></div>
        ) : (
            // Visualização normal das barras
            [...Array(maxStat)].map((_, i) => (
            <div 
                key={i}
                className={`flex-1 transition-all duration-300 ${
                i < clampedValue 
                    ? 'bg-tech-primary shadow-[0_0_5px_rgba(0,255,65,0.6)]' 
                    : 'bg-tech-dim/30 border border-tech-dim/50'
                }`}
            ></div>
            ))
        )}
      </div>
    </div>
  );
};

export default AttributeBox;