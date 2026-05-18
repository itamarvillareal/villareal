import { describe, expect, it } from 'vitest';
import {
  parseDataPrazoFatalTxt,
  parseNomeArquivo145_1,
} from './gerais-145-1-prazo-fatal.mjs';

describe('parseNomeArquivo145_1', () => {
  it('extrai cod8 e proc do último segmento', () => {
    expect(parseNomeArquivo145_1('00000985.145.1.110.txt')).toEqual({
      cod8: '00000985',
      codNum: 985,
      numeroInterno: 110,
    });
    expect(parseNomeArquivo145_1('00000728.145.1.1469.txt')?.numeroInterno).toBe(1469);
  });
});

describe('parseDataPrazoFatalTxt', () => {
  it('lê dd/mm/aaaa', () => {
    expect(parseDataPrazoFatalTxt('15/05/2026\n')).toBe('2026-05-15');
    expect(parseDataPrazoFatalTxt('19/03/2024')).toBe('2024-03-19');
  });
});
