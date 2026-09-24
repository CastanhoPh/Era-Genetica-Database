// O botão de Configurações da barra superior e o painel que ele abre.
//
// Fica ao lado do ADMIN/LOGIN e aparece para TODO MUNDO, logado ou não: quem mais precisa do modo
// leve é quem está num computador simples, e esse pode muito bem ser um visitante ou o computador
// da sessão sem ninguém logado.
//
// Hoje o painel tem uma opção só. Ele é um painel e não um botão solto porque é o lugar natural
// para as próximas preferências de aparelho — a de capas coloridas, por exemplo, poderia morar aqui.
import { useEffect, useRef, useState } from 'react';
import { Settings, Feather } from 'lucide-react';
import { useModoLeve } from '../utils/modoLeve';

export default function Configuracoes() {
  const [aberto, setAberto] = useState(false);
  const [modoLeve, setModoLeve] = useModoLeve();
  const caixa = useRef<HTMLDivElement | null>(null);

  // fecha ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        title="Configurações"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className={`flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border transition-all ${aberto
          ? 'bg-tech-primary text-black border-tech-primary'
          : 'border-tech-border text-tech-primary/70 hover:border-tech-primary hover:text-tech-primary'
          }`}
      >
        <Settings size={10} />
        <span className="hidden sm:inline">CONFIG</span>
        {/* sem o painel aberto, um ponto diz que o modo leve está ligado — senão quem esqueceu não
            entende por que o site ficou sem brilho */}
        {modoLeve && !aberto && <span className="w-1.5 h-1.5 bg-tech-accent" aria-label="modo leve ligado" />}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Configurações"
          className="absolute right-0 top-full mt-2 w-72 bg-black border border-tech-primary shadow-[0_0_20px_rgba(0,255,65,0.15)] p-4 normal-case tracking-normal text-left z-[60]"
        >
          <div className="text-[10px] font-black uppercase tracking-widest text-tech-primary mb-3 flex items-center gap-2">
            <Settings size={11} /> Configurações
            <span className="flex-1 h-px bg-tech-border" />
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={modoLeve}
            onClick={() => setModoLeve(!modoLeve)}
            className="w-full flex items-start gap-3 text-left group"
          >
            {/* a chave */}
            <span
              className={`mt-0.5 shrink-0 w-8 h-4 border flex items-center px-0.5 transition-all ${modoLeve ? 'bg-tech-primary border-tech-primary justify-end' : 'border-tech-border justify-start'
                }`}
            >
              <span className={`w-2.5 h-2.5 ${modoLeve ? 'bg-black' : 'bg-tech-primary/50'}`} />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-tech-primary">
                <Feather size={11} /> Modo leve
                <span className={`ml-auto text-[9px] ${modoLeve ? 'text-tech-primary' : 'text-tech-primary/40'}`}>
                  {modoLeve ? 'LIGADO' : 'DESLIGADO'}
                </span>
              </span>
              <span className="block mt-1 text-[11px] leading-snug text-slate-400">
                Para computadores mais simples. Desliga desfoques, animações, brilhos e o filtro de
                tela. As capas passam a aparecer coloridas.
              </span>
              <span className="block mt-1.5 text-[10px] leading-snug text-tech-primary/40">
                Vale só para este navegador.
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
