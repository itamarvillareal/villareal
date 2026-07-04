import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Plus, X } from 'lucide-react';
import { buscarClientesCadastroPorTermo } from '../../../repositories/clientesRepository.js';
import {
  excluirConversaGrupo,
  getWhatsAppConversationGrupos,
  incluirConversaGrupo,
} from '../../../repositories/whatsappRepository.js';
import { padCliente8Cadastro } from '../../../data/cadastroClientesStorage.js';

function tagOrigem(grupo) {
  if (grupo.incluidoManual && grupo.automatico) return 'auto+manual';
  if (grupo.incluidoManual) return 'manual';
  if (grupo.automatico) return 'auto';
  return '';
}

export function WhatsAppConversationGruposPanel({ phoneNumber, onChanged, collapsibleOnMobile = true }) {
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [expandedMobile, setExpandedMobile] = useState(false);

  const carregar = useCallback(async () => {
    if (!phoneNumber) return;
    setLoading(true);
    setErro('');
    try {
      const list = await getWhatsAppConversationGrupos(phoneNumber);
      setGrupos(Array.isArray(list) ? list : []);
    } catch (e) {
      setErro(e?.message || 'Erro ao carregar grupos.');
      setGrupos([]);
    } finally {
      setLoading(false);
    }
  }, [phoneNumber]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setExpandedMobile(false);
  }, [phoneNumber]);

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      setSugestoes([]);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setBuscando(true);
      try {
        const rows = await buscarClientesCadastroPorTermo(termo, { limite: 12 });
        if (!cancelled) setSugestoes(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setSugestoes([]);
      } finally {
        if (!cancelled) setBuscando(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [busca]);

  const aplicarLista = async (fn) => {
    setSalvando(true);
    setErro('');
    try {
      const atualizada = await fn();
      setGrupos(Array.isArray(atualizada) ? atualizada : []);
      setBusca('');
      setSugestoes([]);
      onChanged?.();
    } catch (e) {
      setErro(e?.message || 'Erro ao salvar grupo.');
    } finally {
      setSalvando(false);
    }
  };

  const handleIncluir = (codigoRaw) => {
    const codigo = padCliente8Cadastro(codigoRaw);
    if (!codigo) return;
    void aplicarLista(() => incluirConversaGrupo(phoneNumber, codigo));
  };

  const handleRemover = (codigo) => {
    void aplicarLista(() => excluirConversaGrupo(phoneNumber, codigo));
  };

  if (!phoneNumber) return null;

  const bodyHiddenOnMobile = collapsibleOnMobile && !expandedMobile;

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-800/40">
      {collapsibleOnMobile ? (
        <button
          type="button"
          onClick={() => setExpandedMobile((open) => !open)}
          className="md:hidden flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200"
          aria-expanded={expandedMobile}
        >
          <span>
            Grupos
            {grupos.length > 0 ? ` (${grupos.length})` : ''}
          </span>
          {expandedMobile ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          )}
        </button>
      ) : null}

      <div className={`px-2.5 py-2 ${bodyHiddenOnMobile ? 'max-md:hidden' : ''}`}>
        <p className="hidden md:block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Grupos por cliente
        </p>
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando…
          </div>
        ) : (
          <>
            {grupos.length === 0 ? (
              <p className="text-xs text-slate-500 py-1">Nenhum grupo vinculado.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5 py-1">
                {grupos.map((grupo) => {
                  const tag = tagOrigem(grupo);
                  return (
                    <li
                      key={grupo.codigo}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-100">{grupo.nome}</span>
                      {tag ? (
                        <span className="text-[10px] uppercase text-emerald-700 dark:text-emerald-400">{tag}</span>
                      ) : null}
                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() => handleRemover(grupo.codigo)}
                        className="rounded p-0.5 text-slate-400 hover:text-red-600 disabled:opacity-50"
                        title="Remover deste cliente"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-1 flex items-center gap-1.5">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Código ou nome do cliente"
                className="flex-1 min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
              />
              {buscando ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : null}
            </div>
            {sugestoes.length > 0 ? (
              <ul className="mt-1 max-h-28 overflow-y-auto rounded-md border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
                {sugestoes.map((c) => (
                  <li key={c.codigo}>
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => handleIncluir(c.codigo)}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3 shrink-0 text-emerald-700" />
                      <span className="font-medium">{c.nomeRazao || c.nome || c.codigo}</span>
                      <span className="text-slate-400">{padCliente8Cadastro(c.codigo)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
        {erro ? <p className="mt-1 text-[11px] text-red-600">{erro}</p> : null}
      </div>
    </div>
  );
}
