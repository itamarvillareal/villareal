import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Users, X } from 'lucide-react';
import { buscarClientesCadastroPorTermo } from '../../../repositories/clientesRepository.js';
import {
  atualizarWhatsAppGrupo,
  criarWhatsAppGrupo,
  excluirWhatsAppGrupo,
  getWhatsAppGrupoSugestoesConversas,
} from '../../../repositories/whatsappRepository.js';
import { padCliente8Cadastro } from '../../../data/cadastroClientesStorage.js';
import { formatPhoneDisplay } from '../../../utils/whatsappFormat.js';

function tituloContato(nome, telefone) {
  const nomeLimpo = String(nome ?? '').trim();
  if (nomeLimpo) return nomeLimpo;
  return formatPhoneDisplay(telefone);
}

/**
 * @param {{
 *   open: boolean,
 *   modo?: 'criar' | 'editar',
 *   grupoInicial?: { codigo: string, nome: string } | null,
 *   onClose: () => void,
 *   onSalvo: () => void,
 * }} props
 */
export function ModalGrupoWhatsApp({ open, modo = 'criar', grupoInicial = null, onClose, onSalvo }) {
  const editando = modo === 'editar' && grupoInicial?.codigo;
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [sugestoesCliente, setSugestoesCliente] = useState([]);
  const [sugestoesRows, setSugestoesRows] = useState([]);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtroConversa, setFiltroConversa] = useState('');

  useEffect(() => {
    if (!open) return;
    setErro('');
    setFiltroConversa('');
    setBuscaCliente('');
    setSugestoesCliente([]);
    if (editando) {
      setClienteSelecionado({
        codigo: padCliente8Cadastro(grupoInicial.codigo),
        nome: grupoInicial.nome,
      });
    } else {
      setClienteSelecionado(null);
      setSugestoesRows([]);
      setSelecionados(new Set());
    }
  }, [open, editando, grupoInicial?.codigo, grupoInicial?.nome]);

  useEffect(() => {
    if (!open || editando) return undefined;
    const termo = buscaCliente.trim();
    if (termo.length < 2) {
      setSugestoesCliente([]);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setBuscandoCliente(true);
      try {
        const rows = await buscarClientesCadastroPorTermo(termo, { limite: 12 });
        if (!cancelled) setSugestoesCliente(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setSugestoesCliente([]);
      } finally {
        if (!cancelled) setBuscandoCliente(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, editando, buscaCliente]);

  const codigoAtivo = clienteSelecionado?.codigo ?? null;

  const carregarSugestoes = useCallback(async (codigo) => {
    if (!codigo) return;
    setCarregandoSugestoes(true);
    setErro('');
    try {
      const rows = await getWhatsAppGrupoSugestoesConversas(codigo);
      const lista = Array.isArray(rows) ? rows : [];
      setSugestoesRows(lista);
      const inicial = new Set(
        lista.filter((r) => r.included || r.suggested).map((r) => String(r.phoneNumber)),
      );
      setSelecionados(inicial);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar sugestões.');
      setSugestoesRows([]);
      setSelecionados(new Set());
    } finally {
      setCarregandoSugestoes(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !codigoAtivo) return;
    void carregarSugestoes(codigoAtivo);
  }, [open, codigoAtivo, carregarSugestoes]);

  const rowsFiltradas = useMemo(() => {
    const q = filtroConversa.trim().toLowerCase();
    if (!q) return sugestoesRows;
    return sugestoesRows.filter((row) => {
      const nome = tituloContato(row.contactName, row.phoneNumber).toLowerCase();
      const tel = formatPhoneDisplay(row.phoneNumber).toLowerCase();
      return nome.includes(q) || tel.includes(q) || String(row.phoneNumber).includes(q);
    });
  }, [sugestoesRows, filtroConversa]);

  const togglePhone = (phone) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };

  const selecionarTodosSugeridos = () => {
    setSelecionados(
      new Set(sugestoesRows.filter((r) => r.suggested || r.included).map((r) => String(r.phoneNumber))),
    );
  };

  const handleSalvar = async () => {
    if (!codigoAtivo) {
      setErro('Selecione o cliente do grupo.');
      return;
    }
    if (selecionados.size === 0) {
      setErro('Selecione ao menos uma conversa.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const phones = [...selecionados];
      if (editando) {
        await atualizarWhatsAppGrupo(codigoAtivo, phones);
      } else {
        await criarWhatsAppGrupo(codigoAtivo, phones);
      }
      onSalvo?.();
      onClose?.();
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar grupo.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!editando || !codigoAtivo) return;
    const ok = window.confirm(`Excluir o grupo "${clienteSelecionado?.nome || codigoAtivo}"?`);
    if (!ok) return;
    setSalvando(true);
    setErro('');
    try {
      await excluirWhatsAppGrupo(codigoAtivo);
      onSalvo?.();
      onClose?.();
    } catch (e) {
      setErro(e?.message || 'Falha ao excluir grupo.');
    } finally {
      setSalvando(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-lg max-h-[90dvh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-grupo-whatsapp-titulo"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="h-5 w-5 shrink-0 text-emerald-700" />
            <h2 id="modal-grupo-whatsapp-titulo" className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {editando ? 'Editar grupo' : 'Novo grupo'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {editando ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
              <div className="font-semibold text-emerald-900 dark:text-emerald-100">{clienteSelecionado?.nome}</div>
              <div className="text-xs text-emerald-800/80 dark:text-emerald-300">Cód. {codigoAtivo}</div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Cliente do grupo</label>
              {clienteSelecionado ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{clienteSelecionado.nome}</div>
                    <div className="text-xs text-slate-500">{clienteSelecionado.codigo}</div>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-slate-800"
                    onClick={() => {
                      setClienteSelecionado(null);
                      setSugestoesRows([]);
                      setSelecionados(new Set());
                    }}
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 dark:border-slate-600">
                    <Search className="h-4 w-4 text-slate-400 shrink-0" />
                    <input
                      type="search"
                      value={buscaCliente}
                      onChange={(e) => setBuscaCliente(e.target.value)}
                      placeholder="Código ou nome do cliente"
                      className="flex-1 min-w-0 bg-transparent text-sm outline-none"
                    />
                    {buscandoCliente ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                  </div>
                  {sugestoesCliente.length > 0 ? (
                    <ul className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600">
                      {sugestoesCliente.map((c) => (
                        <li key={c.codigo}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            onClick={() =>
                              setClienteSelecionado({
                                codigo: padCliente8Cadastro(c.codigo),
                                nome: c.nomeRazao || c.nome || c.codigo,
                              })
                            }
                          >
                            <span className="font-medium">{c.nomeRazao || c.nome || c.codigo}</span>
                            <span className="ml-2 text-xs text-slate-400">{padCliente8Cadastro(c.codigo)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
          )}

          {codigoAtivo ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Conversas do grupo ({selecionados.size} selecionada(s))
                </label>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                  onClick={selecionarTodosSugeridos}
                >
                  Marcar sugeridas
                </button>
              </div>
              <input
                type="search"
                value={filtroConversa}
                onChange={(e) => setFiltroConversa(e.target.value)}
                placeholder="Filtrar conversas…"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              {carregandoSugestoes ? (
                <div className="flex items-center gap-2 py-6 text-sm text-slate-500 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando sugestões…
                </div>
              ) : rowsFiltradas.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  Nenhuma conversa sugerida para este cliente. Você pode adicionar conversas depois pelo painel da conversa.
                </p>
              ) : (
                <ul className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 dark:border-slate-600 dark:divide-slate-700">
                  {rowsFiltradas.map((row) => {
                    const phone = String(row.phoneNumber);
                    const checked = selecionados.has(phone);
                    return (
                      <li key={phone}>
                        <label className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePhone(phone)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-medium block truncate">
                              {tituloContato(row.contactName, phone)}
                            </span>
                            <span className="text-xs text-slate-500">{formatPhoneDisplay(phone)}</span>
                            {row.suggested ? (
                              <span className="ml-1 text-[10px] uppercase font-bold text-emerald-700">Sugerida</span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-[11px] text-slate-500">
                Conversas do grupo continuam visíveis em «Todas». O grupo funciona como filtro na lista.
              </p>
            </div>
          ) : null}

          {erro ? <p className="text-xs text-red-600">{erro}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          {editando ? (
            <button
              type="button"
              disabled={salvando}
              onClick={() => void handleExcluir()}
              className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Excluir grupo
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              disabled={salvando}
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvando || !codigoAtivo}
              onClick={() => void handleSalvar()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editando ? 'Salvar' : 'Criar grupo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
