import { Component } from 'react';

/** Evita derrubar a tela inteira quando o embed de Processos falha no render. */
export class ProcessoEmbedErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (error) {
      const msg = String(error?.message || error || 'Erro inesperado ao carregar o formulário.');
      const chunkStale =
        /Failed to fetch dynamically imported module|Loading chunk \d+ failed|ChunkLoadError/i.test(msg);
      return (
        <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-base font-semibold text-red-700">
            {chunkStale ? 'Nova versão do sistema disponível' : 'Não foi possível abrir o processo'}
          </p>
          <p className="max-w-md text-sm text-slate-600 leading-relaxed">
            {chunkStale
              ? 'O navegador está usando arquivos de uma versão anterior. Atualize a página (Ctrl+Shift+R ou Cmd+Shift+R).'
              : msg}
          </p>
          <button
            type="button"
            className="mt-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => (chunkStale ? window.location.reload() : this.props.onFechar?.())}
          >
            {chunkStale ? 'Atualizar página' : 'Fechar'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
