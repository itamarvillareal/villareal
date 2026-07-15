import { describe, expect, it } from 'vitest';
import {
  buildTemplateParamsFromMessage,
  findLastOutboundTemplateMessage,
  parseStoredTemplateParams,
} from './whatsappTemplateParamsUtils.js';

describe('findLastOutboundTemplateMessage', () => {
  it('retorna o último template de saída', () => {
    const messages = [
      { direction: 'OUTBOUND', templateName: 'a', content: '1' },
      { direction: 'INBOUND', content: 'oi' },
      { direction: 'OUTBOUND', templateName: 'b', content: '2' },
    ];
    expect(findLastOutboundTemplateMessage(messages)?.templateName).toBe('b');
  });
});

describe('parseStoredTemplateParams', () => {
  it('usa o conteúdo inteiro quando há um único parâmetro', () => {
    const template = { params: ['Mensagem'] };
    expect(parseStoredTemplateParams('Olá, tudo bem?', template)).toEqual(['Olá, tudo bem?']);
  });

  it('divide parâmetros múltiplos pelo separador do backend', () => {
    const template = { params: ['Nome', 'Unidade', 'Condomínio'] };
    expect(parseStoredTemplateParams('Ana, Apto 101, Residencial X', template)).toEqual([
      'Ana',
      'Apto 101',
      'Residencial X',
    ]);
  });
});

describe('buildTemplateParamsFromMessage', () => {
  it('monta nome e parâmetros a partir da mensagem', () => {
    const result = buildTemplateParamsFromMessage(
      { templateName: 'boas_vindas_cliente', content: 'Maria' },
      [{ value: 'boas_vindas_cliente', params: ['Nome do cliente'] }],
    );
    expect(result).toEqual({ templateName: 'boas_vindas_cliente', params: ['Maria'] });
  });
});
