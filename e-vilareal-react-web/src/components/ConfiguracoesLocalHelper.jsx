import { useEffect, useMemo, useState } from 'react';
import { Download, HardDrive, Loader2, RefreshCw } from 'lucide-react';
import { verificarLocalHelperAtivo } from '../services/abrirPastaLocalService.js';
import {
  detectarSOUsuario,
  instaladorLocalHelperParaSO,
  rotuloSOUsuario,
} from '../utils/detectarSOUsuario.js';

function botaoDownload(instalador) {
  return (
    <a
      href={instalador.href}
      download={instalador.arquivo}
      className="group flex items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 hover:border-indigo-400 hover:bg-indigo-50"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <Download className="h-4 w-4 shrink-0 text-indigo-700" aria-hidden />
          <span className="truncate">{instalador.rotulo}</span>
        </span>
        <span className="pl-6 text-xs font-normal text-slate-500">{instalador.descricao}</span>
      </span>
    </a>
  );
}

export function ConfiguracoesLocalHelper() {
  const [status, setStatus] = useState({ carregando: true, ativo: false, baseClientes: null });
  const so = useMemo(() => detectarSOUsuario(), []);
  const instalador = useMemo(() => instaladorLocalHelperParaSO(so), [so]);
  const soRotulo = useMemo(() => rotuloSOUsuario(so), [so]);

  async function recarregar() {
    setStatus((s) => ({ ...s, carregando: true }));
    const r = await verificarLocalHelperAtivo();
    setStatus({ carregando: false, ativo: r.ativo, baseClientes: r.baseClientes });
  }

  useEffect(() => {
    void recarregar();
  }, []);

  return (
    <div className="border-t border-slate-200 pt-6">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-100 p-2">
          <HardDrive className="h-5 w-5 text-indigo-800" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              {instalador?.tituloSecao ?? 'Pasta local no Finder / Explorer'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              O botão <strong>Pasta local</strong> (Processos e Clientes) abre a cópia sincronizada do Google Drive
              Desktop. Instale o agente <strong>uma vez por máquina</strong> — ele sobe automaticamente a cada login.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Sistema detectado nesta estação: <strong>{soRotulo}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            {status.carregando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden />
                <span className="text-slate-600">Verificando agente local…</span>
              </>
            ) : status.ativo ? (
              <>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  Ativo
                </span>
                <span className="truncate text-slate-600" title={status.baseClientes ?? undefined}>
                  {status.baseClientes ? `Base: ${status.baseClientes}` : 'Agente respondendo em localhost:9876'}
                </span>
              </>
            ) : (
              <>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                  Inativo
                </span>
                <span className="text-slate-600">
                  {instalador
                    ? 'Baixe e execute o instalador abaixo nesta máquina.'
                    : 'Instalador disponível apenas para macOS e Windows.'}
                </span>
              </>
            )}
            <button
              type="button"
              onClick={() => void recarregar()}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Verificar
            </button>
          </div>

          {instalador ? (
            <>
              <div className="max-w-xl">{botaoDownload(instalador)}</div>
              <p className="text-xs text-slate-500">{instalador.rodape}</p>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Use um computador com <strong>macOS</strong> ou <strong>Windows</strong> para instalar o agente local.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
