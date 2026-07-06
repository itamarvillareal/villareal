import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  FaturaCartaoXlsxSenhaIncorretaError,
  descriptografarFaturaCartaoXlsxSeNecessario,
} from './faturaCartaoXlsx.js';

const FIXTURE = process.env.FATURA_BTG_FIXTURE;

describe('descriptografarFaturaCartaoXlsxSeNecessario', () => {
  it.skipIf(!FIXTURE || !fs.existsSync(FIXTURE))(
    'sem Buffer global, senha errada não lança «Buffer is not defined»',
    async () => {
      const saved = globalThis.Buffer;
      // eslint-disable-next-line no-undefined
      globalThis.Buffer = undefined;

      try {
        await expect(
          descriptografarFaturaCartaoXlsxSeNecessario(fs.readFileSync(FIXTURE), {
            password: '00000000000',
          }),
        ).rejects.toBeInstanceOf(FaturaCartaoXlsxSenhaIncorretaError);
      } finally {
        globalThis.Buffer = saved;
      }
    },
  );
});
