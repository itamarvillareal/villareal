import { describe, expect, it } from 'vitest';
import {
  parseContactCardContent,
  resumoContactCardContent,
  telefoneCartaoParaApi,
} from './whatsappContactCard.js';

describe('whatsappContactCard', () => {
  it('parseContactCardContent lê JSON do backend', () => {
    const json = JSON.stringify({
      contatos: [
        {
          nome: 'Carlos',
          telefones: [{ numero: '+55 62 99999-0000', waId: '5562999990000', tipo: 'CELL' }],
        },
      ],
    });
    const contatos = parseContactCardContent(json);
    expect(contatos).toHaveLength(1);
    expect(contatos[0].nome).toBe('Carlos');
    expect(telefoneCartaoParaApi(contatos[0].telefones[0])).toBe('5562999990000');
  });

  it('resumoContactCardContent formata preview', () => {
    const json = JSON.stringify({ contatos: [{ nome: 'Paulo' }] });
    expect(resumoContactCardContent(json)).toBe('Cartão de contato: Paulo');
  });
});
