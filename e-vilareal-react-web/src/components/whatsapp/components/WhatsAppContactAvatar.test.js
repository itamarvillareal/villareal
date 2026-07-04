import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WhatsAppContactAvatar } from './WhatsAppContactAvatar.jsx';

vi.mock('../hooks/useWhatsAppContactPhotoUrl.js', () => ({
  useWhatsAppContactPhotoUrl: (_telefone, contactPhotoUrl) => ({
    url: contactPhotoUrl ? 'blob:mock-photo' : null,
    loading: false,
    error: null,
  }),
}));

describe('WhatsAppContactAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sem contactPhotoUrl renderiza iniciais', () => {
    const html = renderToStaticMarkup(
      createElement(WhatsAppContactAvatar, {
        nome: 'Juliano Silva',
        telefone: '5562983452868',
        size: 'sm',
      }),
    );
    expect(html).toContain('JS');
    expect(html).not.toContain('<img');
  });

  it('com contactPhotoUrl renderiza img', () => {
    const html = renderToStaticMarkup(
      createElement(WhatsAppContactAvatar, {
        nome: 'Juliano Silva',
        telefone: '5562983452868',
        contactPhotoUrl: '/api/whatsapp/conversations/5562983452868/photo',
        size: 'sm',
      }),
    );
    expect(html).toContain('<img');
    expect(html).toContain('blob:mock-photo');
    expect(html).not.toContain('>JS<');
  });
});
