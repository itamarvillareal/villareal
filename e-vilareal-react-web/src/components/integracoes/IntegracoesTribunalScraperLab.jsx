import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { featureFlags } from '../../config/featureFlags.js';
import {
  DATAJUD_WIKI_GLOSSARIO_URL,
  DATAJUD_URL_PARAMETRIZACAO,
} from '../../data/datajudApiClient.js';
import { useUsuarioPerfil } from '../../hooks/useUsuarioPerfil.js';
import { DataJudBuscaSimples } from './DataJudBuscaSimples.jsx';
import { DataJudExploradorBusca } from './DataJudExploradorBusca.jsx';

/**
 * Integrações — consulta pública DataJud (CNJ).
 * Usuários comuns: busca por CNJ. Administradores: laboratório técnico opcional.
 */
export function IntegracoesTribunalScraperLab() {
  const { isAdmin } = useUsuarioPerfil();
  const [modoAvancadoAberto, setModoAvancadoAberto] = useState(false);

  if (!featureFlags.showTribunalScraperLab) {
    return (
      <div className="p-6 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
        <p className="font-medium text-slate-800 dark:text-slate-200">Integração indisponível</p>
        <p className="mt-2">
          Esta funcionalidade não está ativa neste ambiente. Contacte o administrador do sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-4 space-y-2">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Consulta DataJud (CNJ)</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Consulta processos públicos do Tribunal de Justiça de Goiás através da API nacional do CNJ.
          {isAdmin ? (
            <>
              {' '}
              <a className="underline" href={DATAJUD_WIKI_GLOSSARIO_URL} target="_blank" rel="noreferrer">
                Glossário CNJ
              </a>
              {' · '}
              <a className="underline" href={DATAJUD_URL_PARAMETRIZACAO} target="_blank" rel="noreferrer">
                Parametrização
              </a>
            </>
          ) : null}
        </p>
      </div>

      <DataJudBuscaSimples showDebug={isAdmin} />

      {isAdmin ? (
        <section className="max-w-6xl mx-auto px-4 md:px-6 border-t border-slate-200 dark:border-white/10 pt-6">
          <button
            type="button"
            onClick={() => setModoAvancadoAberto((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-medium text-amber-950 hover:bg-amber-100/80 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100 dark:hover:bg-amber-950/40"
            aria-expanded={modoAvancadoAberto}
          >
            <span>Modo avançado — laboratório de buscas (técnico)</span>
            {modoAvancadoAberto ? (
              <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            )}
          </button>
          {modoAvancadoAberto ? (
            <div className="mt-4">
              <DataJudExploradorBusca />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
