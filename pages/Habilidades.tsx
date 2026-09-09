// A aba Habilidades: o fichário das Habilidades Lendárias e das liberações.
//
// Forma escolhida pelo Pedro em 09/09/2026, entre três desenhos: trilha à esquerda com os verbetes,
// painel à direita com um só aberto. Foi escolhida por ser a que cabe descrição — o dia em que cada
// degrau ganhar uma linha de texto, só ela não estoura.
//
// NÃO GUARDA NADA. Os dois lados vêm de código, não do Firestore:
//
//   FAMILIAS_LENDARIAS   data/habilidades-lendarias.ts   já existia, é o MESMO catálogo que a busca
//                                                        do site usa para casar nível lendário
//   LIBERACOES           data/liberacoes.ts              novo, ditado em 09/09/2026
//
// A escolha de ler o catálogo que já existe, em vez de digitar uma segunda lista, é o que evita duas
// verdades: se um degrau aparece nesta aba, a busca o entende; se não aparece, ele não existe. As
// grafias, portanto, são as do catálogo (`Fujogan`, `Mangekyou`, `Iryou`), e não as com macron da
// lista que o Pedro mandou — fechar isso é decisão dele, e vale para os dois lados de uma vez.
//
// Custo para o visitante: zero leitura de Firestore. Os dois arquivos viajam no bundle.
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, ChevronRight, Layers, GitMerge, Droplets } from 'lucide-react';
import { FAMILIAS_LENDARIAS, FamiliaLendaria } from '../data/habilidades-lendarias';
import { GRUPOS_DE_LIBERACAO, GrupoLiberacao, Liberacao, liberacoesDoGrupo, combinacoesPossiveis } from '../data/liberacoes';
import { slugify } from '../data/firestore';

/** Um verbete da trilha: ou uma família lendária, ou um grupo de liberação. */
type Verbete =
  | { tipo: 'familia'; slug: string; rotulo: string; qtd: number; familia: FamiliaLendaria }
  | { tipo: 'liberacao'; slug: string; rotulo: string; qtd: number; grupo: GrupoLiberacao };

const VERBETES: Verbete[] = [
  ...FAMILIAS_LENDARIAS.map((f): Verbete => ({
    tipo: 'familia',
    slug: slugify(f.familia),
    rotulo: f.familia,
    qtd: f.degraus.reduce((s, d) => s + d.marcas.length, 0),
    familia: f,
  })),
  ...GRUPOS_DE_LIBERACAO.map((g): Verbete => ({
    tipo: 'liberacao',
    slug: slugify(g),
    rotulo: g,
    qtd: liberacoesDoGrupo(g).length,
    grupo: g,
  })),
];

const FAMILIAS = VERBETES.filter(v => v.tipo === 'familia');
const GRUPOS = VERBETES.filter(v => v.tipo === 'liberacao');
const TOTAL_MARCAS = FAMILIAS.reduce((s, v) => s + v.qtd, 0);
const TOTAL_LIBERACOES = GRUPOS.reduce((s, v) => s + v.qtd, 0);

/**
 * Liberações que TAMBÉM são família lendária, pelo nome. Não é coincidência: a liberação é o
 * caminho de chakra, e a família lendária diz se você o tem de nascença ou implantado — o Ranton
 * é liberação e é `Ranton Natural` / `Ranton Artificial`. Mostrar o vínculo é grátis e informa.
 */
const FAMILIA_POR_NOME = new Map(FAMILIAS_LENDARIAS.map(f => [f.familia.toLowerCase(), f.familia]));
const familiaDaLiberacao = (nome: string): string | null =>
  FAMILIA_POR_NOME.get(nome.toLowerCase()) ?? null;

const ROTULO_CURTO: Record<string, string> = {
  'Elementos da Natureza': 'Elementos',
  'Evoluções da Natureza': 'Evoluções',
  'Kekkei Genkai Exclusiva': 'Exclusivas de clã',
};

// ---------------------------------------------------------------- painel: família lendária
const PainelFamilia: React.FC<{ f: FamiliaLendaria }> = ({ f }) => {
  const marcas = f.degraus.reduce((s, d) => s + d.marcas.length, 0);
  return (
    <>
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="text-xl font-black text-white uppercase tracking-wide">{f.familia}</h2>
        <span className="bg-tech-accent text-black text-[9px] font-black px-2 py-0.5 clip-corner-sm">
          {marcas} {marcas === 1 ? 'marca' : 'marcas'}
        </span>
      </div>

      <p className="text-[10px] uppercase tracking-widest text-tech-primary/50 mt-1 flex items-center gap-1.5">
        {f.paralelo ? (
          <><Layers size={12} /> alternativas — não há ordem entre elas</>
        ) : (
          <><ChevronRight size={12} /> escada de {f.degraus.length} {f.degraus.length === 1 ? 'degrau' : 'degraus'}, do mais fraco ao mais forte</>
        )}
      </p>

      <div className="flex flex-col gap-1.5 mt-5">
        {f.degraus.map((d, i) => (
          <div key={i} className="flex flex-col gap-1">
            {d.marcas.map((m, k) => {
              // Marca extra no mesmo degrau é variante, não nível novo: o implante muda a
              // origem e não a potência. Entra recuada, em âmbar, sem número.
              const variante = k > 0;
              return (
                <div
                  key={m}
                  className={`flex items-baseline gap-3 border-l-2 py-1 pl-3 ${variante
                    ? 'border-tech-accent/40 ml-6'
                    : 'border-tech-border'}`}
                >
                  <span
                    className={`text-[10px] font-mono shrink-0 w-5 text-right tabular-nums ${variante
                      ? 'text-tech-accent/50'
                      : 'text-tech-primary/50'}`}
                  >
                    {variante ? '↳' : f.paralelo ? '·' : i + 1}
                  </span>
                  <span className={`text-sm ${variante ? 'text-tech-accent/80' : 'text-slate-200'}`}>{m}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {f.apelidos?.length ? (
        <p className="text-[11px] text-slate-400 mt-5 leading-relaxed">
          <span className="text-tech-primary/50 uppercase tracking-widest text-[10px]">busca também por</span>
          {' '}{f.apelidos.join(' · ')}
        </p>
      ) : null}
    </>
  );
};

// ---------------------------------------------------------------- painel: grupo de liberação
const PainelLiberacoes: React.FC<{ g: GrupoLiberacao }> = ({ g }) => {
  const lista = liberacoesDoGrupo(g);
  // Só as Kekkei que somam elementos têm "de quantas possíveis": as bases não combinam nada e as
  // exclusivas vêm de sangue.
  const k = lista[0]?.de.length ?? 0;
  const possiveis = g.startsWith('Kekkei') && g !== 'Kekkei Genkai Exclusiva' ? combinacoesPossiveis(k) : 0;

  const formula = (l: Liberacao) => {
    if (l.fonte?.length) return l.fonte.join(' · ');
    if (!l.de.length) return 'elemento base';
    if (l.de.length === 1) return `${l.de[0]} →`;
    return l.de.join(' + ') + ' =';
  };

  return (
    <>
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="text-xl font-black text-white uppercase tracking-wide">{g}</h2>
        <span className="bg-tech-accent text-black text-[9px] font-black px-2 py-0.5 clip-corner-sm">
          {lista.length}
        </span>
      </div>

      <p className="text-[10px] uppercase tracking-widest text-tech-primary/50 mt-1 flex items-center gap-1.5">
        {lista[0]?.fonte?.length ? (
          <><Droplets size={12} /> vêm de sangue, não de combinação</>
        ) : !k ? (
          <><Droplets size={12} /> as cinco de que todo o resto sai</>
        ) : (
          <>
            <GitMerge size={12} />
            {k === 1 ? 'um elemento vira outro' : `${k} elementos somados`}
            {possiveis ? ` · ${lista.length} de ${possiveis} combinações possíveis` : ''}
          </>
        )}
      </p>

      <div className="flex flex-col gap-1.5 mt-5">
        {lista.map(l => {
          const fam = familiaDaLiberacao(l.nome);
          return (
            <div key={l.nome} className="border-l-2 border-tech-border py-1 pl-3">
              {/* A fórmula vem ANTES do nome quando ela é uma conta — "Katon + Doton = Youton" só
                  se lê nessa ordem. A fonte de sangue vem DEPOIS, porque ali ela é um atributo do
                  jutsu e não uma conta: "Ketton, Liberação de Sangue, do clã Chinoike". */}
              <div className="flex items-baseline gap-2 flex-wrap">
                {!l.fonte?.length && (
                  <span className="text-[11px] font-mono text-tech-primary/70 tabular-nums">{formula(l)}</span>
                )}
                <span className="text-sm text-slate-100">{l.nome}</span>
                <span className="text-[11px] text-slate-400">Liberação de {l.traducao}</span>
                {l.fonte?.length ? (
                  <span className="text-[11px] font-mono text-tech-primary/70">{formula(l)}</span>
                ) : null}
              </div>
              {fam && (
                <span className="text-[10px] uppercase tracking-widest text-tech-accent/60">
                  também é família lendária
                </span>
              )}
            </div>
          );
        })}
      </div>

      {possiveis > 0 && lista.length < possiveis && (
        <p className="text-[11px] text-slate-400 mt-5 leading-relaxed">
          {possiveis - lista.length} das {possiveis} combinações de {k} elementos ainda não têm nome.
        </p>
      )}
    </>
  );
};

// ---------------------------------------------------------------- a aba
const Habilidades: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const segmentos = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const slugDaUrl = segmentos[1] ? decodeURIComponent(segmentos[1]) : '';

  // Sem nada na URL abre no primeiro verbete: a aba nunca aparece vazia, e o link com slug é
  // compartilhável.
  const aberto = VERBETES.find(v => v.slug === slugDaUrl) ?? VERBETES[0];
  const abre = (v: Verbete) => navigate(`/habilidades/${encodeURIComponent(v.slug)}`);

  const item = (v: Verbete) => (
    <button
      key={v.slug}
      type="button"
      onClick={() => abre(v)}
      aria-current={v.slug === aberto.slug ? 'true' : undefined}
      className={`w-full text-left flex items-baseline justify-between gap-2 px-3 py-1 text-xs border-l-2 transition-colors ${v.slug === aberto.slug
        ? 'border-tech-primary bg-tech-primary/10 text-tech-primary'
        : 'border-transparent text-slate-300 hover:text-white hover:bg-tech-primary/5'}`}
    >
      <span className="truncate">{ROTULO_CURTO[v.rotulo] ?? v.rotulo}</span>
      <span className="text-[10px] text-tech-primary/50 tabular-nums shrink-0">{v.qtd}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-1 flex items-center gap-2">
        <Sparkles size={12} />
        <span>Habilidades e Liberações</span>
        <span className="flex-1 h-px bg-tech-border"></span>
        <span className="text-tech-primary/50">
          {FAMILIAS.length} famílias · {TOTAL_MARCAS} marcas · {TOTAL_LIBERACOES} liberações
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[13rem_1fr] gap-px bg-tech-border/40 border border-tech-border/40">
        <div className="bg-tech-panel/40 py-2 md:max-h-[34rem] md:overflow-y-auto">
          <div className="text-[9px] uppercase tracking-[0.18em] text-tech-primary/45 px-3 pt-2 pb-1">
            Habilidades Lendárias
          </div>
          {FAMILIAS.map(item)}
          <div className="text-[9px] uppercase tracking-[0.18em] text-tech-primary/45 px-3 pt-4 pb-1">
            Liberações
          </div>
          {GRUPOS.map(item)}
        </div>

        <div className="bg-black/40 p-5">
          {aberto.tipo === 'familia'
            ? <PainelFamilia f={aberto.familia} />
            : <PainelLiberacoes g={aberto.grupo} />}
        </div>
      </div>
    </div>
  );
};

export default Habilidades;
