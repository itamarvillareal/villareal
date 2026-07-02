import { describe, expect, it } from 'vitest';
import {
  aplicarEditoresDomParaTeste,
  coletarPayloadManualParaPdf,
  htmlSecaoTemTexto,
  normalizarPayloadManualPdf,
  sanitizarHtmlSecao,
  sincronizarFormManualComEditores,
} from './documentoManualUtils.js';

function mockEditor(key, html) {
  return {
    getAttribute: (attr) => (attr === 'data-html-editor' ? key : null),
    innerHTML: html,
  };
}

function mockRoot(editors) {
  return {
    querySelectorAll: (selector) => (selector === '[data-html-editor]' ? editors : []),
  };
}

describe('documentoManualUtils', () => {
  describe('htmlSecaoTemTexto', () => {
    it('retorna false para HTML vazio ou só tags', () => {
      expect(htmlSecaoTemTexto('')).toBe(false);
      expect(htmlSecaoTemTexto('<p></p>')).toBe(false);
      expect(htmlSecaoTemTexto('<p><br></p>')).toBe(false);
      expect(htmlSecaoTemTexto('&nbsp;')).toBe(false);
    });

    it('retorna true quando há texto visível', () => {
      expect(htmlSecaoTemTexto('<p>Embora tenha sido o processo extinto.</p>')).toBe(true);
    });
  });

  describe('sanitizarHtmlSecao', () => {
    it('envolve br inicial em parágrafo', () => {
      expect(sanitizarHtmlSecao('<br>Embora tenha sido o processo extinto.')).toBe(
        '<p>Embora tenha sido o processo extinto.</p>',
      );
    });

    it('preserva html já estruturado', () => {
      const html = '<div>Texto dos fatos.</div>';
      expect(sanitizarHtmlSecao(html)).toBe(html);
    });
  });

  describe('normalizarPayloadManualPdf', () => {
    it('remove seções sem texto visível', () => {
      const out = normalizarPayloadManualPdf({
        enderecamento: '  Excelentíssimo  ',
        preambulo: '<p>Preâmbulo</p>',
        secoes: [
          { titulo: 'DOS FATOS', conteudo: '<p>Texto dos fatos.</p>' },
          { titulo: 'DO DIREITO', conteudo: '<p></p>' },
        ],
        pedidos: [' Pedido 1 ', ''],
      });

      expect(out.enderecamento).toBe('Excelentíssimo');
      expect(out.secoes).toHaveLength(1);
      expect(out.secoes[0].titulo).toBe('DOS FATOS');
      expect(out.pedidos).toEqual(['Pedido 1']);
    });
  });

  describe('sincronizarFormManualComEditores', () => {
    it('mescla HTML dos editores no formulário', () => {
      const root = mockRoot([
        mockEditor('preambulo', '<p>Preâmbulo editado</p>'),
        mockEditor('secao-0-conteudo', '<p>Texto dos fatos no DOM</p>'),
      ]);

      const form = {
        preambulo: '<p>Antigo</p>',
        secoes: [
          { titulo: 'DOS FATOS', conteudo: '<p>Antigo fatos</p>' },
          { titulo: 'DO DIREITO', conteudo: '' },
        ],
      };

      const sync = sincronizarFormManualComEditores(form, root);
      expect(sync.preambulo).toBe('<p>Preâmbulo editado</p>');
      expect(sync.secoes[0].conteudo).toBe('<p>Texto dos fatos no DOM</p>');
    });
  });

  describe('coletarPayloadManualParaPdf', () => {
    it('usa conteúdo do DOM mesmo com payload desatualizado', () => {
      const root = mockRoot([
        mockEditor('secao-0-conteudo', '<p>Fatos atualizados na prévia</p>'),
      ]);

      const payload = {
        preambulo: '<p>Preâmbulo</p>',
        secoes: [{ titulo: 'DOS FATOS', conteudo: '<p>Texto antigo</p>' }],
        pedidos: ['Pedido'],
      };

      const out = coletarPayloadManualParaPdf(payload, root);
      expect(out.secoes[0].conteudo).toBe('<p>Fatos atualizados na prévia</p>');
    });
  });

  describe('aplicarEditoresDomParaTeste', () => {
    it('ignora chaves desconhecidas', () => {
      const root = mockRoot([mockEditor('outro-campo', '<p>x</p>')]);
      const base = { preambulo: '<p>ok</p>', secoes: [] };
      expect(aplicarEditoresDomParaTeste(base, root)).toEqual(base);
    });
  });
});
