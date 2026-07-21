import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  detectarSOUsuario,
  instaladorLocalHelperParaSO,
  INSTALADOR_LOCAL_HELPER,
} from './detectarSOUsuario.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('detectarSOUsuario', () => {
  it('identifica macOS', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
    });
    expect(detectarSOUsuario()).toBe('macos');
    expect(instaladorLocalHelperParaSO()).toEqual(INSTALADOR_LOCAL_HELPER.macos);
  });

  it('identifica Windows', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32',
    });
    expect(detectarSOUsuario()).toBe('windows');
    expect(instaladorLocalHelperParaSO()).toEqual(INSTALADOR_LOCAL_HELPER.windows);
  });

  it('retorna null para Linux', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      platform: 'Linux x86_64',
    });
    expect(instaladorLocalHelperParaSO()).toBeNull();
  });
});
