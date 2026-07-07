import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'
import { AppRootErrorBoundary } from './components/AppRootErrorBoundary.jsx'

function mostrarErroBoot(mensagem) {
  const rootEl = document.getElementById('root')
  if (!rootEl) return
  rootEl.innerHTML = `
    <div style="min-height:100dvh;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;">
      <div style="max-width:420px;width:100%;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(15,23,42,.92);padding:24px;">
        <p style="margin:0;font-size:18px;font-weight:600;">Não foi possível iniciar o sistema</p>
        <p style="margin:12px 0 0;font-size:14px;line-height:1.55;color:#cbd5e1;">${mensagem}</p>
        <button type="button" onclick="location.reload()" style="margin-top:20px;width:100%;border:none;border-radius:12px;padding:12px 16px;background:#0891b2;color:#fff;font-size:14px;font-weight:600;">Atualizar página</button>
      </div>
    </div>`
}

window.addEventListener(
  'error',
  (event) => {
    const alvo = event?.target
    if (alvo && alvo.tagName === 'SCRIPT') {
      mostrarErroBoot(
        'Falha ao carregar o aplicativo. No iPhone: Ajustes → Safari → Avançado → Dados dos sites → remover este site, ou abra em aba anônima.',
      )
    }
  },
  true,
)

window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event?.reason?.message || event?.reason || '')
  if (/Failed to fetch dynamically imported module|Loading chunk .* failed|ChunkLoadError/i.test(msg)) {
    event.preventDefault?.()
    mostrarErroBoot(
      'Versão antiga em cache no celular. Atualize a página; se continuar, limpe os dados do site no Safari.',
    )
  }
})

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Elemento #root não encontrado no index.html.')
}
createRoot(rootEl).render(
  <StrictMode>
    <AppRootErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AppRootErrorBoundary>
  </StrictMode>,
)
