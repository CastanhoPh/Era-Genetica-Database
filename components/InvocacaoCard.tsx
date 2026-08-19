import React from 'react';
import { ChevronRight, Sparkles, Hexagon } from 'lucide-react';
import { classificationColors } from '../types/Equipment';
import { formatImageUrl } from '../utils/formatters';

export interface InvocacaoCardData {
  nome: string;
  dono: string;
  capaUrl?: string;
  arteUrl?: string;
  rank?: string;
  nature?: string;
  village?: string;
  placeholder: boolean;
  /** Página no projeto Invocações do Canva. */
  pagina: number;
}

interface Props {
  inv: InvocacaoCardData;
  index: number;
  onClick: () => void;
}

/**
 * Mesmo card do Arsenal, com uma diferença: a área da imagem é 4:3 em vez de 250px fixos, que é o
 * formato real das artes de invocação. Como a coluna da grade tem largura fixa, a altura sai igual
 * em todos os cards do mesmo jeito — só não recorta o desenho.
 */
const InvocacaoCard: React.FC<Props> = ({ inv, index, onClick }) => {
  const [imgError, setImgError] = React.useState(false);
  const rankStyle = inv.rank ? (classificationColors[inv.rank] || classificationColors['F']) : null;
  const semArte = inv.placeholder || !inv.capaUrl || imgError;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="group relative border border-tech-border bg-black/50 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col h-full opacity-0 animate-fade-in-up hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(0,255,65,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-tech-primary"
      style={{ animationDelay: `${Math.min(index * 70, 1200)}ms` }}
    >
      <div className="absolute inset-0 z-30 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-tech-primary/5 to-transparent animate-shimmer" />
      </div>
      <div className="absolute inset-0 z-20 border-2 border-transparent group-hover:border-tech-primary/40 transition-all duration-300 pointer-events-none group-hover:animate-border-pulse" />

      {/* faixa de cima */}
      <div className="h-7 bg-tech-dim/30 border-b border-tech-border flex justify-between items-center px-2.5 text-[10px] text-tech-primary font-mono shrink-0 group-hover:bg-tech-primary/10 transition-colors relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-tech-primary/10 to-transparent opacity-0 group-hover:opacity-100 animate-shimmer pointer-events-none" />
        <span className="flex items-center gap-1.5 relative z-10">
          <Hexagon size={8} className="text-tech-primary/40 group-hover:text-tech-primary transition-colors" />
          Nº {inv.pagina.toString().padStart(4, '0')}
        </span>
        {/* rank quando existir; senão o aviso de arte pendente, que é a única outra coisa
            que vale ocupar esse canto */}
        {rankStyle ? (
          <div className={`relative z-10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${rankStyle.bg} text-black clip-corner-sm ${rankStyle.glow} transition-all`}>
            {inv.rank}
          </div>
        ) : inv.placeholder ? (
          <div className="relative z-10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border border-tech-primary/30 text-tech-primary/40 clip-corner-sm">
            pendente
          </div>
        ) : null}
      </div>

      {/* imagem */}
      <div className="aspect-[4/3] relative overflow-hidden bg-tech-dim/10 border-b border-tech-border shrink-0 card-zoom-container">
        <div className="absolute inset-0 z-10 bg-[linear-gradient(transparent_2px,rgba(0,0,0,0.5)_3px)] bg-[size:100%_4px] pointer-events-none opacity-20" />

        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-tech-primary z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:w-4 group-hover:h-4" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-tech-primary z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:w-4 group-hover:h-4" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-tech-primary z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:w-4 group-hover:h-4" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-tech-primary z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:w-4 group-hover:h-4" />

        <div className="absolute bottom-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="text-[7px] text-tech-primary/50 font-mono leading-tight">
            <div>SYS.INV</div>
            <div>v1.0.0</div>
          </div>
        </div>
        <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-60 transition-opacity duration-500 pointer-events-none">
          <div className="text-[7px] text-tech-primary/50 font-mono text-right leading-tight">
            <div>█▓▒░</div>
          </div>
        </div>

        {/* placeholder é página em branco: exibir seria fingir que a arte existe */}
        {!semArte ? (
          <img
            src={formatImageUrl(inv.capaUrl!)}
            alt={inv.nome}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-all duration-700 grayscale brightness-90 group-hover:grayscale-0 group-hover:brightness-110 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-striped-pattern opacity-50">
            <Sparkles size={44} className="text-tech-dim animate-pulse" />
            {inv.placeholder && (
              <span className="text-[8px] uppercase tracking-widest text-tech-primary/30">arte pendente</span>
            )}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none" />
      </div>

      {/* rodapé */}
      <div className="p-3 flex flex-col justify-between flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-tech-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500 pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-lg font-bold uppercase truncate transition-colors text-glow text-white group-hover:text-tech-primary">
            {inv.nome}
          </h3>
        </div>
        <div className="mt-3 flex justify-between items-center gap-2 relative z-10">
          <span className="text-[10px] uppercase tracking-widest text-tech-primary/40 truncate">
            {inv.dono}{inv.nature && <span className="text-tech-primary/25"> · {inv.nature}</span>}
          </span>
          <span className="text-[10px] flex items-center gap-1 group-hover:gap-2 transition-all text-tech-primary whitespace-nowrap">
            ACESSAR_DADOS <ChevronRight size={10} />
          </span>
        </div>
      </div>
    </div>
  );
};

export default InvocacaoCard;
