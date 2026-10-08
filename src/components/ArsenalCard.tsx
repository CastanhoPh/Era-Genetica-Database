import React from 'react';
import { ChevronRight, Cpu, Hexagon } from 'lucide-react';
import { Equipment, classificationColors } from '../types/Equipment';
import { formatImageUrl } from '../utils/formatters';
import { filtroDaCapa } from './BotaoDeCores';

interface ArsenalCardProps {
  item: Equipment;
  index: number;
  onClick: () => void;
  /** Arte em cores em vez do dessaturado padrão. Vem do botão de paleta da lista. */
  colorido?: boolean;
}

const ArsenalCard: React.FC<ArsenalCardProps> = ({ item, index, onClick, colorido = false }) => {
  const [imgError, setImgError] = React.useState(false);
  const classStyle = classificationColors[item.classification] || classificationColors['D'];

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="group relative border border-tech-border bg-black/50 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col h-full opacity-0 animate-fade-in-up hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(0,255,65,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-tech-primary"
      style={{ animationDelay: `${Math.min(index * 70, 1200)}ms` }}
    >
      {/* Holographic shimmer overlay */}
      <div className="absolute inset-0 z-30 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-tech-primary/5 to-transparent animate-shimmer" />
      </div>

      {/* Glitch border on hover */}
      <div className="absolute inset-0 z-20 border-2 border-transparent group-hover:border-tech-primary/40 transition-all duration-300 pointer-events-none group-hover:animate-border-pulse" />

      {/* Header Strip */}
      <div className="h-7 bg-tech-dim/30 border-b border-tech-border flex justify-between items-center px-2.5 text-[10px] text-tech-primary font-mono shrink-0 group-hover:bg-tech-primary/10 transition-colors relative overflow-hidden">
        {/* Scanning line in header */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-tech-primary/10 to-transparent opacity-0 group-hover:opacity-100 animate-shimmer pointer-events-none" />
        
        <span className="flex items-center gap-1.5 relative z-10">
          <Hexagon size={8} className="text-tech-primary/40 group-hover:text-tech-primary transition-colors" />
          ID: {item.id.toString().padStart(4, '0')}
        </span>
        
        {/* Classification Badge */}
        <div className={`relative z-10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${classStyle.bg} text-black clip-corner-sm ${classStyle.glow} transition-all`}>
          {item.classification}
        </div>
      </div>

      {/* Image Area */}
      <div className="h-[250px] relative overflow-hidden bg-tech-dim/10 border-b border-tech-border shrink-0 card-zoom-container">
        {/* Overlay scanline grid */}
        <div className="absolute inset-0 z-10 bg-[linear-gradient(transparent_2px,rgba(0,0,0,0.5)_3px)] bg-[size:100%_4px] pointer-events-none opacity-20" />

        {/* Corner targeting markers */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-tech-primary z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:w-4 group-hover:h-4" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-tech-primary z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:w-4 group-hover:h-4" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-tech-primary z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:w-4 group-hover:h-4" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-tech-primary z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:w-4 group-hover:h-4" />

        {/* Tech corner detail */}
        <div className="absolute bottom-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="text-[7px] text-tech-primary/50 font-mono leading-tight">
            <div>SYS.ARM</div>
            <div>v2.0.5</div>
          </div>
        </div>

        {/* Tech corner detail - right */}
        <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-60 transition-opacity duration-500 pointer-events-none">
          <div className="text-[7px] text-tech-primary/50 font-mono text-right leading-tight">
            <div>█▓▒░</div>
          </div>
        </div>

        {item.image && !imgError ? (
          <img
            src={formatImageUrl(item.image)}
            alt={item.name}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${filtroDaCapa(false, colorido)}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-striped-pattern opacity-50">
            <Cpu size={48} className="text-tech-dim animate-pulse" />
          </div>
        )}

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none" />
      </div>

      {/* Info Footer */}
      <div className="p-3 flex flex-col justify-between flex-1 relative overflow-hidden">
        {/* Background scan animation */}
        <div className="absolute inset-0 bg-tech-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500 pointer-events-none" />

        <div className="relative z-10">
          <h3 className="text-lg font-bold uppercase truncate transition-colors text-glow text-white group-hover:text-tech-primary">
            {item.name}
          </h3>
        </div>

        <div className="mt-3 flex justify-end relative z-10">
          <span className="text-[10px] flex items-center gap-1 group-hover:gap-2 transition-all text-tech-primary">
            ACESSAR_DADOS <ChevronRight size={10} />
          </span>
        </div>
      </div>
    </div>
  );
};

export default ArsenalCard;
