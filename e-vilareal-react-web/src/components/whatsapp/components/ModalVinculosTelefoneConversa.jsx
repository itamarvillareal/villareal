import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';
import { formatPhoneDisplay } from '../../../utils/whatsappFormat.js';
import { buildRouterStateChaveClienteProcesso } from '../../../domain/camposProcessoCliente.js';
import { buscarVinculosPorTelefoneConversa } from '../services/buscarVinculosPorTelefoneConversa.js';

function formatCodigoExibicao(codigoCliente) {
  const cod = String(codigoCliente ?? '').trim();
  if (!cod) return '';
  return cod.replace(/^0+(?=\d)/, '') || cod;
}

function linkProcesso(codigoCliente, numeroInterno) {
  const params = new URLSearchParams();
  params.set('codigoCliente', codigoCliente);
  params.set('numeroInterno', String(numeroInterno));
  return `/processos?${params.toString()}`;
}

function PainelPessoa({ pessoa }) {
  const vinculos = Array.isArray(pessoa?.vinculos) ? pessoa.vinculos : [];
  const codigos = Array.isArray(pessoa?.codigosCliente) ? pessoa.codigosCliente : [];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Códigos de cliente</h3>
        {codigos.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum código de cliente vinculado a esta pessoa.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {codigos.map((cod) => (
              <li key={cod}>
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-sm font-medium dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                  {formatCodigoExibicao(cod)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Código + proc.</h3>
        {vinculos.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum processo encontrado com vínculo para esta pessoa.</p>
        ) : (
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Cód.</th>
                  <th className="text-left px-3 py-2 font-medium">Proc.</th>
                  <th className="text-left px-3 py-2 font-medium">Papéis</th>
                  <th className="text-right px-3 py-2 font-medium">Abrir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {vinculos.map((row) => (
                  <tr key={`${row.codigoCliente}-${row.numeroInterno}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200 tabular-nums">
                      {formatCodigoExibicao(row.codigoCliente)}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200 tabular-nums">{row.numeroInterno}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.papeis || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={linkProcesso(row.codigoCliente, row.numeroInterno)}
                        state={buildRouterStateChaveClienteProcesso(row.codigoCliente, row.numeroInterno)}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:underline text-sm font-medium dark:text-emerald-400"
                      >
                        Processo
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Modal com vínculos (cód. + proc.) das pessoas encontradas pelo telefone da conversa.
 * @param {{ open: boolean, telefone: string, onClose: () => void }} props
 */
export function ModalVinculosTelefoneConversa({ open, telefone, onClose }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [pessoas, setPessoas] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState(0);

  useCloseOnEscape(open, onClose, { enabled: !carregando });

  useEffect(() => {
    if (!open || !telefone) return undefined;
    let cancelled = false;
    setCarregando(true);
    setErro('');
    setPessoas([]);
    setAbaAtiva(0);

    void buscarVinculosPorTelefoneConversa(telefone)
      .then((resultado) => {
        if (cancelled) return;
        if (resultado.erro) {
          setErro(resultado.erro);
          setPessoas([]);
          return;
        }
        setPessoas(Array.isArray(resultado.pessoas) ? resultado.pessoas : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setErro(err?.message || 'Erro ao buscar vínculos.');
        setPessoas([]);
      })
      .finally(() => {
        if (!cancelled) setCarregando(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, telefone]);

  if (!open) return null;

  const pessoaAtiva = pessoas[abaAtiva] ?? pessoas[0];
  const multiplasPessoas = pessoas.length > 1;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/45"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-vinculos-telefone-titulo"
        className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="modal-vinculos-telefone-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Vínculos pelo telefone
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Telefone da conversa: <span className="font-medium tabular-nums">{formatPhoneDisplay(telefone)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          {carregando ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Buscando pessoas e vínculos…
            </div>
          ) : erro ? (
            <p className="text-sm text-red-600 dark:text-red-400 py-4">{erro}</p>
          ) : pessoas.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              Nenhuma pessoa encontrada no cadastro com este telefone.
            </p>
          ) : (
            <>
              {multiplasPessoas ? (
                <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700 pb-3">
                  {pessoas.map((pessoa, index) => (
                    <button
                      key={pessoa.id}
                      type="button"
                      onClick={() => setAbaAtiva(index)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        index === abaAtiva
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                      }`}
                      title={`Pessoa nº ${pessoa.id}`}
                    >
                      {pessoa.nome}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Pessoa nº <span className="font-semibold">{pessoaAtiva.id}</span> — {pessoaAtiva.nome}
                </p>
              )}

              {pessoaAtiva ? <PainelPessoa pessoa={pessoaAtiva} /> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
