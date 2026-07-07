import { Component } from 'react';

function mensagemAmigavel(error) {
  const msg = String(error?.message || error || 'Erro inesperado.');
  if (/Failed to fetch dynamically imported module|Loading chunk .* failed|ChunkLoadError/i.test(msg)) {
    return {
      titulo: 'Nova versão do sistema disponível',
      detalhe:
        'O navegador está usando arquivos antigos (comum no celular após atualização). Atualize a página ou limpe o cache do Safari.',
      acao: 'Atualizar página',
      reload: true,
    };
  }
  if (/Unexpected token|SyntaxError|Invalid regular expression/i.test(msg)) {
    return {
      titulo: 'Navegador incompatível ou cache corrompido',
      detalhe:
        'Atualize o iOS/Safari ou abra em aba anônima. Se persistir, Ajustes → Safari → Avançado → Dados dos sites → remover portal.villarealadvocacia.adv.br.',
      acao: 'Tentar novamente',
      reload: true,
    };
  }
  return {
    titulo: 'Não foi possível carregar o sistema',
    detalhe: msg,
    acao: 'Recarregar',
    reload: true,
  };
}

/** Evita tela branca total quando o React quebra antes de renderizar telas internas. */
export class AppRootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const info = mensagemAmigavel(error);
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(15, 23, 42, 0.92)',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
          }}
        >
          <p style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{info.titulo}</p>
          <p style={{ margin: '12px 0 0', fontSize: '14px', lineHeight: 1.55, color: '#cbd5e1' }}>
            {info.detalhe}
          </p>
          <button
            type="button"
            onClick={() => (info.reload ? window.location.reload() : this.setState({ error: null }))}
            style={{
              marginTop: '20px',
              width: '100%',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 16px',
              background: '#0891b2',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {info.acao}
          </button>
        </div>
      </div>
    );
  }
}
