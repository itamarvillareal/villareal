import { useEffect, useState } from 'react';
import { PanelLeft, Loader2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { getColaboradoresHumanosAtivos } from '../data/agendaPersistenciaData.js';
import {
  getPerfilAtivoParaPermissoes,
  isUsuarioMasterEstacao,
  usuarioEhAdminApi,
} from '../data/usuarioPermissoesStorage.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  MODULO_MENU_SEMPRE_VISIVEL,
  getEstruturaMenuLateral,
  getMenuPreferenciaUsuario,
  normalizarItensPreferencia,
} from '../data/menuVisivelStorage.js';
import {
  carregarMenuPreferenciaUsuario,
  persistirMenuPreferenciaUsuario,
} from '../repositories/menuPreferenciaRepository.js';

function montarLinhas(preferencia) {
  const estrutura = getEstruturaMenuLateral();
  const itens = normalizarItensPreferencia(preferencia?.itens);
  const porId = new Map(itens.map((it) => [it.id, it]));

  const topo = [...estrutura].sort((a, b) => {
    const oa = porId.get(a.id)?.ordem ?? 9999;
    const ob = porId.get(b.id)?.ordem ?? 9999;
    return oa - ob;
  });

  return topo.map((item) => {
    const pref = porId.get(item.id) || { id: item.id, visivel: true, ordem: 0 };
    let children = null;
    if (item.children) {
      children = [...item.children]
        .map((ch) => {
          const p = porId.get(ch.id) || { id: ch.id, visivel: true, ordem: 0 };
          return { ...ch, visivel: p.visivel !== false, ordem: p.ordem };
        })
        .sort((a, b) => a.ordem - b.ordem);
    }
    return {
      id: item.id,
      label: item.label,
      visivel: pref.visivel !== false,
      children,
    };
  });
}

function linhasParaPreferencia(linhas) {
  const itens = [];
  linhas.forEach((linha, ordemTopo) => {
    itens.push({
      id: linha.id,
      visivel: linha.id === MODULO_MENU_SEMPRE_VISIVEL ? true : linha.visivel !== false,
      ordem: ordemTopo,
    });
    if (Array.isArray(linha.children)) {
      linha.children.forEach((ch, i) => {
        itens.push({
          id: ch.id,
          visivel: ch.visivel !== false,
          ordem: i,
        });
      });
    }
  });
  return { itens: normalizarItensPreferencia(itens) };
}

/**
 * Preferência de itens do menu lateral — visibilidade, ordem e persistência em banco.
 */
export function ConfiguracaoMenuLateral() {
  const podeEditarOutros =
    isUsuarioMasterEstacao() || (featureFlags.requiresApiAuth && usuarioEhAdminApi());
  const listaUsuarios = getColaboradoresHumanosAtivos() || [];
  const perfilPadrao = getPerfilAtivoParaPermissoes();

  const [alvoId, setAlvoId] = useState(() => perfilPadrao);
  const [linhas, setLinhas] = useState(() => montarLinhas(getMenuPreferenciaUsuario(perfilPadrao)));
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msgOk, setMsgOk] = useState('');
  const [msgErro, setMsgErro] = useState('');
  const [dragIndex, setDragIndex] = useState(null);

  async function carregar(id) {
    setCarregando(true);
    setMsgErro('');
    try {
      const pref = await carregarMenuPreferenciaUsuario(id);
      setLinhas(montarLinhas(pref));
    } catch (e) {
      setLinhas(montarLinhas(getMenuPreferenciaUsuario(id)));
      setMsgErro(e?.message || 'Falha ao carregar preferência do menu.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const id = podeEditarOutros ? alvoId : getPerfilAtivoParaPermissoes();
    void carregar(id);
  }, [alvoId, podeEditarOutros]);

  useEffect(() => {
    if (!podeEditarOutros) {
      setAlvoId(getPerfilAtivoParaPermissoes());
    }
  }, [podeEditarOutros]);

  function onChangeAlvo(novoId) {
    setAlvoId(novoId);
    setMsgOk('');
    setMsgErro('');
  }

  function toggleTopo(id) {
    if (id === MODULO_MENU_SEMPRE_VISIVEL) return;
    setLinhas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visivel: !l.visivel } : l)),
    );
    setMsgOk('');
  }

  function toggleFilho(grupoId, filhoId) {
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.id !== grupoId || !l.children) return l;
        return {
          ...l,
          children: l.children.map((ch) =>
            ch.id === filhoId ? { ...ch, visivel: !ch.visivel } : ch,
          ),
        };
      }),
    );
    setMsgOk('');
  }

  function marcarTodos(valor) {
    setLinhas((prev) =>
      prev.map((l) => ({
        ...l,
        visivel: l.id === MODULO_MENU_SEMPRE_VISIVEL ? true : valor,
        children: l.children
          ? l.children.map((ch) => ({ ...ch, visivel: valor }))
          : null,
      })),
    );
    setMsgOk('');
  }

  function moverTopo(from, to) {
    if (from == null || to == null || from === to) return;
    setLinhas((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setMsgOk('');
  }

  function moverFilho(grupoId, from, to) {
    if (from == null || to == null || from === to) return;
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.id !== grupoId || !l.children) return l;
        const children = [...l.children];
        if (to < 0 || to >= children.length) return l;
        const [item] = children.splice(from, 1);
        children.splice(to, 0, item);
        return { ...l, children };
      }),
    );
    setMsgOk('');
  }

  async function salvar() {
    const id = podeEditarOutros ? alvoId : getPerfilAtivoParaPermissoes();
    if (!id) {
      setMsgErro('Usuário inválido.');
      return;
    }
    const preferencia = linhasParaPreferencia(linhas);
    const algum = preferencia.itens.some((it) => it.visivel);
    if (!algum) {
      setMsgErro('Marque pelo menos um item do menu.');
      return;
    }
    setSalvando(true);
    setMsgErro('');
    setMsgOk('');
    try {
      const { persistidoEmBanco } = await persistirMenuPreferenciaUsuario(id, preferencia);
      setLinhas(montarLinhas(getMenuPreferenciaUsuario(id)));
      setMsgOk(
        persistidoEmBanco
          ? 'Menu lateral salvo no banco de dados.'
          : 'Menu lateral salvo neste navegador (sem sessão na API — faça login para gravar no banco).',
      );
    } catch (e) {
      setMsgErro(e?.message || 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const nomeAlvo =
    listaUsuarios.find((u) => String(u.id) === String(alvoId))?.nome || alvoId;

  return (
    <div className="border-t border-slate-200 pt-6">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-sky-100 border border-sky-200 shrink-0">
          <PanelLeft className="w-5 h-5 text-sky-800" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Menu lateral</h2>
            <p className="text-sm text-slate-600 mt-1">
              Defina quais itens aparecem no menu à esquerda e a ordem dos botões (arraste pelo ícone).
              {podeEditarOutros ? (
                <>
                  {' '}
                  Pode configurar o seu menu ou o de outro usuário. Preferências são gravadas no{' '}
                  <strong>banco de dados</strong>. O acesso às telas continua em{' '}
                  <strong>Usuários → Permissões</strong>.
                </>
              ) : (
                <> Preferências são gravadas no banco quando houver sessão autenticada.</>
              )}
            </p>
          </div>

          {podeEditarOutros ? (
            <label className="block text-xs font-medium text-slate-600">
              Configurar menu de
              <select
                value={alvoId}
                onChange={(e) => onChangeAlvo(e.target.value)}
                className="mt-1 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                {listaUsuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome} ({u.id})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-slate-500">
              Editando o menu de <strong>{nomeAlvo}</strong>.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => marcarTodos(true)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Marcar todos
            </button>
            <button
              type="button"
              onClick={() => marcarTodos(false)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Desmarcar todos
            </button>
          </div>

          {carregando ? (
            <p className="text-xs text-slate-500 inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              Carregando preferências…
            </p>
          ) : null}

          <div className="max-h-96 overflow-y-auto space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/50 p-2">
            {linhas.map((linha, index) => {
              const fixo = linha.id === MODULO_MENU_SEMPRE_VISIVEL;
              return (
                <div
                  key={linha.id}
                  draggable={!carregando}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    moverTopo(dragIndex, index);
                    setDragIndex(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="cursor-grab text-slate-400 active:cursor-grabbing shrink-0"
                      title="Arrastar para reordenar"
                    >
                      <GripVertical className="h-4 w-4" aria-hidden />
                    </span>
                    <label
                      className={`flex items-center gap-2 min-w-0 flex-1 ${
                        fixo ? 'opacity-80 cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={!!linha.visivel}
                        disabled={fixo || carregando}
                        onChange={() => toggleTopo(linha.id)}
                      />
                      <span className="text-sm text-slate-800 truncate">
                        {linha.label}
                        {fixo ? (
                          <span className="ml-1 text-xs text-slate-500">(sempre visível)</span>
                        ) : null}
                      </span>
                    </label>
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        disabled={index === 0 || carregando}
                        onClick={() => moverTopo(index, index - 1)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        aria-label="Subir"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === linhas.length - 1 || carregando}
                        onClick={() => moverTopo(index, index + 1)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        aria-label="Descer"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {linha.children?.length ? (
                    <div className="mt-2 ml-6 space-y-1 border-l border-slate-200 pl-2">
                      {linha.children.map((ch, chIndex) => (
                        <div key={ch.id} className="flex items-center gap-2">
                          <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              checked={!!ch.visivel}
                              disabled={carregando}
                              onChange={() => toggleFilho(linha.id, ch.id)}
                            />
                            <span className="text-xs text-slate-700 truncate">{ch.label}</span>
                          </label>
                          <div className="flex shrink-0 gap-0.5">
                            <button
                              type="button"
                              disabled={chIndex === 0 || carregando}
                              onClick={() => moverFilho(linha.id, chIndex, chIndex - 1)}
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                              aria-label="Subir subitem"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={chIndex === linha.children.length - 1 || carregando}
                              onClick={() => moverFilho(linha.id, chIndex, chIndex + 1)}
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                              aria-label="Descer subitem"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {msgErro ? <p className="text-xs text-rose-700">{msgErro}</p> : null}
          {msgOk ? <p className="text-xs text-emerald-700">{msgOk}</p> : null}

          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando || carregando}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {salvando ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <PanelLeft className="w-4 h-4" aria-hidden />
            )}
            Salvar menu lateral
          </button>
        </div>
      </div>
    </div>
  );
}
