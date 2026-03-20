import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Board } from './components/Board';
import { CadastroPessoas } from './components/cadastro-pessoas/CadastroPessoas';
import { CadastroClientes } from './components/CadastroClientes';
import { Agenda } from './components/Agenda';
import { Processos } from './components/Processos';
import { Imoveis } from './components/Imoveis';
import { Relatorio } from './components/Relatorio';
import { Calculos } from './components/Calculos';
import { Diagnosticos } from './components/Diagnosticos';
import { Financeiro } from './components/Financeiro';
import { atualizarIndicesMensaisAposDia10 } from './services/monetaryIndicesService.js';
import { ensureHistoricoDemonstracaoDiagnostico } from './data/processosHistoricoData.js';

function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  useEffect(() => {
    try {
      ensureHistoricoDemonstracaoDiagnostico();
    } catch {
      /* não bloqueia o app */
    }
    let cancelled = false;
    (async () => {
      try {
        if (cancelled) return;
        const run = () => atualizarIndicesMensaisAposDia10();
        if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
          await new Promise((resolve) => {
            window.requestIdleCallback(async () => {
              if (cancelled) return resolve();
              try {
                await run();
              } catch {
                // silencioso: não quebra a UI
              } finally {
                resolve();
              }
            });
          });
        } else {
          await new Promise((resolve) => setTimeout(resolve, 0));
          try {
            await run();
          } catch {
            // silencioso: não quebra a UI
          }
        }
      } catch {
        // Não impede o app de abrir se a atualização falhar.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Board />} />
          <Route path="/clientes" element={<CadastroPessoas />} />
          <Route path="/pessoas" element={<CadastroClientes />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/processos" element={<Processos />} />
          <Route path="/imoveis" element={<Imoveis />} />
          <Route path="/relatorio" element={<Relatorio />} />
          <Route path="/calculos" element={<Calculos />} />
          <Route path="/diagnosticos" element={<Diagnosticos />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/:section" element={<Board />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
