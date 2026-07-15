import { describe, expect, it, vi, afterEach } from 'vitest';
import { mensagemLocalHelperIndisponivel, tituloBotaoPastaLocal } from './abrirPastaLocalMessages.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('abrirPastaLocalMessages', () => {
  it('tituloBotaoPastaLocal indica Explorer no Windows', () => {
    expect(tituloBotaoPastaLocal({ ativo: true, so: 'windows' })).toMatch(/Explorer/);
  });

  it('tituloBotaoPastaLocal indica Finder no macOS', () => {
    expect(tituloBotaoPastaLocal({ ativo: true, so: 'macos' })).toMatch(/Finder/);
  });

  it('mensagemLocalHelperIndisponivel menciona .bat no Windows', () => {
    vi.stubGlobal('navigator', { userAgent: 'Windows NT 10.0', platform: 'Win32' });
    expect(mensagemLocalHelperIndisponivel('windows')).toMatch(/Instalar-Pasta-Local-VillaReal\.bat/);
  });

  it('tituloBotaoPastaLocal inclui base quando ativo', () => {
    const titulo = tituloBotaoPastaLocal({ ativo: true, baseClientes: '/tmp/clientes', so: 'macos' });
    expect(titulo).toMatch(/Base detectada/);
  });
});
