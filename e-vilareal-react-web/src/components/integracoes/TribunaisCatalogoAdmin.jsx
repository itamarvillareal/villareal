import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useUsuarioPerfil } from '../../hooks/useUsuarioPerfil.js';
import { listarTribunais, sincronizarTribunal } from '../../repositories/orgaosJulgadoresRepository.js';

function formatSyncResult(r) {
  if (!r) return '';
  const parts = [
    r.orgaosRecebidos != null ? `${r.orgaosRecebidos} recebidos` : null,
    r.orgaosInseridos ? `${r.orgaosInseridos} inseridos` : null,
    r.orgaosAtualizados ? `${r.orgaosAtualizados} atualizados` : null,
    r.orgaosDesativados ? `${r.orgaosDesativados} desativados` : null,
    r.fallbackJson ? 'fallback JSON' : null,
    r.desativacaoExecutada === false && r.orgaosRecebidos > 0 ? 'desativação abortada' : null,
  ].filter(Boolean);
  return parts.join(' · ') || r.mensagem || 'OK';
}

export function TribunaisCatalogoAdmin() {
  const { isAdmin } = useUsuarioPerfil();
  const [tribunais, setTribunais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [syncId, setSyncId] = useState(null);
  const [ultimoResultado, setUltimoResultado] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const lista = await listarTribunais();
      setTribunais(Array.isArray(lista) ? lista : []);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar tribunais.');
      setTribunais([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function onSincronizar(tribunal) {
    if (!tribunal?.id || syncId != null) return;
    const ok = window.confirm(
      `Sincronizar órgãos julgadores do ${tribunal.sigla} via DataJud?\n\nA desativação só ocorre se a resposta vier íntegra.`
    );
    if (!ok) return;
    setSyncId(tribunal.id);
    setUltimoResultado(null);
    setErro('');
    try {
      const r = await sincronizarTribunal(tribunal.id);
      setUltimoResultado({ sigla: tribunal.sigla, ...r });
      await carregar();
    } catch (e) {
      setErro(e?.message || `Falha ao sincronizar ${tribunal.sigla}.`);
    } finally {
      setSyncId(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
        <p className="font-medium text-slate-800 dark:text-slate-200">Acesso restrito</p>
        <p className="mt-2">Somente administradores podem gerenciar o catálogo de tribunais.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tribunais e órgãos julgadores</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Catálogo de TJs (DataJud). Apenas tribunais ativos aparecem no autocomplete de processos. A sincronização
          preserva órgãos existentes se a resposta vier incompleta.
        </p>
      </div>

      {erro ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {erro}
        </p>
      ) : null}

      {ultimoResultado ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-100">
          <strong>{ultimoResultado.sigla}:</strong> {formatSyncResult(ultimoResultado)}
          {ultimoResultado.mensagem ? <span className="block mt-1 opacity-80">{ultimoResultado.mensagem}</span> : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-white/5 text-left text-slate-600 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Sigla</th>
              <th className="px-4 py-2 font-medium">UF</th>
              <th className="px-4 py-2 font-medium">DataJud</th>
              <th className="px-4 py-2 font-medium">Ativo</th>
              <th className="px-4 py-2 font-medium w-40">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : tribunais.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-slate-500">
                  Nenhum tribunal cadastrado.
                </td>
              </tr>
            ) : (
              tribunais.map((t) => (
                <tr key={t.id} className="text-slate-800 dark:text-slate-200">
                  <td className="px-4 py-2 font-medium">{t.sigla}</td>
                  <td className="px-4 py-2">{t.uf}</td>
                  <td className="px-4 py-2 font-mono text-xs">{t.datajudAlias || '—'}</td>
                  <td className="px-4 py-2">
                    {t.ativo ? (
                      <span className="text-emerald-700 dark:text-emerald-400">Sim</span>
                    ) : (
                      <span className="text-slate-500">Não</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      disabled={syncId != null}
                      onClick={() => void onSincronizar(t)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncId === t.id ? 'animate-spin' : ''}`} aria-hidden />
                      {syncId === t.id ? 'Sincronizando…' : 'Sincronizar'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
