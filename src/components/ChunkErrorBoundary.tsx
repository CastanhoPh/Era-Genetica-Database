import React from 'react';

// Depois de um novo deploy, os arquivos JS das páginas (lazy-loaded) trocam de nome/hash.
// Se a aba já estava aberta com a versão antiga e o usuário navega pra uma página cujo
// chunk mudou, o import dinâmico falha (404) e o React quebra a árvore inteira, deixando
// a tela preta — sem isso, só um F5 manual resolve. Detecta esse erro específico e recarrega sozinho.
const CHUNK_ERROR_PATTERN = /Failed to fetch dynamically imported module|Loading chunk|error loading dynamically imported module|Importing a module script failed/i;
const RELOAD_FLAG = 'era-genetica-chunk-reload';

interface Props { children: React.ReactNode }
interface State { hasError: boolean; isChunkError: boolean }

export default class ChunkErrorBoundary extends React.Component<Props, State> {
  // Este projeto não tem @types/react instalado (react 19 não empacota .d.ts própria aqui),
  // então Component<P,S> tipa como `any` e não propaga `this.props` sozinho — declara explícito.
  declare props: Readonly<Props>;
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, isChunkError: CHUNK_ERROR_PATTERN.test(message) };
  }

  componentDidCatch(error: unknown) {
    if (this.state.isChunkError) {
      // Evita loop infinito se o reload não resolver (ex: deploy quebrado de verdade).
      if (sessionStorage.getItem(RELOAD_FLAG)) return;
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
    } else {
      console.error('Erro na aplicação:', error);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.isChunkError) return null; // reload já disparado, não pisca fallback
      return (
        <div className="min-h-screen flex items-center justify-center bg-black text-tech-primary p-8">
          <div className="text-center space-y-3">
            <p className="text-sm uppercase tracking-widest">Algo deu errado.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="border border-tech-primary/40 px-4 py-2 text-xs uppercase tracking-widest hover:bg-tech-primary hover:text-black transition-all"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
