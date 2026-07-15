import { describe, expect, it } from 'vitest';
import { tituloBotaoPastaLocal } from './abrirPastaLocalMessages.js';

describe('abrirPastaLocalMessages', () => {
  it('tituloBotaoPastaLocal indica agente inativo', () => {
    expect(tituloBotaoPastaLocal({ ativo: false })).toMatch(/local-helper:install|Configurações/);
  });

  it('tituloBotaoPastaLocal inclui base quando ativo', () => {
    const titulo = tituloBotaoPastaLocal({ ativo: true, baseClientes: '/tmp/clientes' });
    expect(titulo).toMatch(/Base detectada/);
    expect(titulo).toContain('/tmp/clientes');
  });
});
