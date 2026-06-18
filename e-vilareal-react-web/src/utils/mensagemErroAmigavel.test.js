import { describe, expect, it } from 'vitest';
import {
  mensagemErroAmigavel,
  normalizarMensagemErroApi,
} from './mensagemErroAmigavel.js';

describe('normalizarMensagemErroApi', () => {
  it('remove sufixo técnico /api/...', () => {
    expect(
      normalizarMensagemErroApi(
        'Nenhum PDF pendente para assinar. — /api/processos/diagnostico/aguardando-protocolo/preparar-assinar',
      ),
    ).toBe('Nenhum PDF pendente para assinar.');
  });
});

describe('mensagemErroAmigavel', () => {
  it('preserva mensagem 422 do backend (não substitui por genérica)', () => {
    expect(
      mensagemErroAmigavel(
        new Error(
          'Nenhum PDF na pasta «Assinar» do Google Drive nos 3 processo(s) listados. Coloque os PDFs na subpasta «Assinar» de cada processo (não use Petição, Movimentações ou outras pastas) e tente novamente.',
        ),
        'preparar os PDFs da pasta Assinar',
      ),
    ).toMatch(/pasta «Assinar»/i);
  });

  it('traduz erro 413 no upload de assinados', () => {
    expect(mensagemErroAmigavel(new Error('Erro 413'), 'enviar os arquivos assinados')).toMatch(
      /250 MB/i,
    );
  });

  it('enriquece PDF ausente no servidor ao gerar ZIP', () => {
    expect(
      mensagemErroAmigavel(
        new Error('PDF da petição #42 não está no servidor. Clique em «Preparar e baixar ZIP» de novo'),
        'gerar o ZIP para assinar',
      ),
    ).toMatch(/servidor|Drive/i);
  });
});
