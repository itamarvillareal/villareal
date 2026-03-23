import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserCog, Calendar, Shield, UserRoundCog } from 'lucide-react';
import { agendaUsuarios } from '../data/mockData';
import {
  getUsuariosAtivos,
  setUsuariosAtivos,
  criarUsuarioRegistroMinimo,
  clonarAgendaEntreUsuarios,
} from '../data/agendaPersistenciaData';
import { ModalPermissoesUsuario } from './ModalPermissoesUsuario.jsx';
import { ModalDadosUsuario } from './ModalDadosUsuario.jsx';
import { getNomeExibicaoUsuario } from '../data/usuarioDisplayHelpers.js';

function normalizarNomeParaId(nome) {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Cadastro de usuários ativos do sistema (Agenda, permissões, vínculo a Pessoas).
 */
export function Usuarios() {
  const [usuariosAtivos, setUsuariosAtivosState] = useState(() => getUsuariosAtivos());
  const [slotsCustom, setSlotsCustom] = useState(['', '']);
  const [permModalUsuario, setPermModalUsuario] = useState(null);
  const [dadosModalUsuario, setDadosModalUsuario] = useState(null);
  /** { ag: { id, nome }, origemCloneId, clearSlotIndex } */
  const [modalIncluir, setModalIncluir] = useState(null);

  function persistirUsuariosAtivos(next) {
    const r = setUsuariosAtivos(next);
    if (!r.ok) {
      window.alert(r.error || 'Não foi possível salvar os usuários.');
      return false;
    }
    setUsuariosAtivosState(getUsuariosAtivos());
    return true;
  }

  function abrirModalIncluir(ag, opts = {}) {
    if (!ag?.id) return;
    const ids = new Set((usuariosAtivos || []).map((u) => String(u.id)));
    if (ids.has(String(ag.id))) return;
    setModalIncluir({
      ag: { id: String(ag.id), nome: String(ag.nome ?? '').trim() || String(ag.id) },
      origemCloneId: '',
      clearSlotIndex: opts.clearSlotIndex != null ? opts.clearSlotIndex : null,
    });
  }

  function confirmarInclusaoModal() {
    if (!modalIncluir?.ag?.id) return;
    const { ag, origemCloneId, clearSlotIndex } = modalIncluir;
    const novo = criarUsuarioRegistroMinimo(ag);
    const next = [...(usuariosAtivos || []), novo];
    if (!persistirUsuariosAtivos(next)) return;

    const origem = String(origemCloneId || '').trim();
    if (origem) {
      const r = clonarAgendaEntreUsuarios({ origemUsuarioId: origem, destinoUsuarioId: ag.id });
      if (r.ok) {
        const nomeAlvo = getNomeExibicaoUsuario(novo) || ag.nome;
        if (r.clonados > 0) {
          window.alert(
            `Usuário incluído. Foram copiados ${r.clonados} compromisso(s) da agenda de origem para ${nomeAlvo}.`
          );
        } else {
          window.alert(
            `Usuário ${nomeAlvo} incluído. Não havia compromissos persistidos na agenda do usuário de origem para copiar.`
          );
        }
      } else {
        window.alert('Usuário incluído, mas não foi possível copiar a agenda (verifique origem e destino).');
      }
    }

    if (clearSlotIndex != null) {
      setSlotsCustom((prev) => {
        const n = [...prev];
        if (n[clearSlotIndex] !== undefined) n[clearSlotIndex] = '';
        return n;
      });
    }
    setModalIncluir(null);
  }

  function excluirUsuario(usuarioId) {
    if (!usuarioId) return;
    const basePrimeiro = Array.isArray(agendaUsuarios) && agendaUsuarios[0] ? agendaUsuarios[0] : null;
    if (basePrimeiro && usuarioId === basePrimeiro.id) return;
    persistirUsuariosAtivos((usuariosAtivos || []).filter((u) => u.id !== usuarioId));
  }

  useEffect(() => {
    const basePrimeiro = Array.isArray(agendaUsuarios) && agendaUsuarios[0] ? agendaUsuarios[0] : null;
    if (!basePrimeiro) return;
    const ids = new Set((usuariosAtivos || []).map((u) => u.id));
    if (ids.has(basePrimeiro.id)) return;
    persistirUsuariosAtivos([...(usuariosAtivos || []), criarUsuarioRegistroMinimo(basePrimeiro)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idsAtivos = new Set((usuariosAtivos || []).map((u) => u.id));
  const primeira = agendaUsuarios?.[0];
  const resto = Array.isArray(agendaUsuarios) ? agendaUsuarios.slice(1) : [];

  const mapaPorId = new Map((usuariosAtivos || []).map((u) => [u.id, u]));

  function usuarioMesclado(ag) {
    return mapaPorId.get(ag.id) || criarUsuarioRegistroMinimo(ag);
  }

  async function salvarDadosUsuario(atualizado) {
    const atual = getUsuariosAtivos();
    const next = atual.some((x) => String(x.id) === String(atualizado.id))
      ? atual.map((x) => (String(x.id) === String(atualizado.id) ? atualizado : x))
      : [...atual, atualizado];
    if (!persistirUsuariosAtivos(next)) throw new Error('Falha ao persistir');
  }

  function botaoPermissoes(usuario) {
    if (!usuario?.id) return null;
    return (
      <button
        type="button"
        onClick={() =>
          setPermModalUsuario({
            id: usuario.id,
            nome: getNomeExibicaoUsuario(usuario),
          })
        }
        className="inline-flex items-center justify-center gap-1.5 rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100 whitespace-nowrap"
      >
        <Shield className="h-4 w-4 shrink-0" aria-hidden />
        Permissões
      </button>
    );
  }

  function botaoDados(usuario) {
    if (!usuario?.id) return null;
    return (
      <button
        type="button"
        onClick={() => setDadosModalUsuario(usuario)}
        className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
      >
        <UserRoundCog className="h-4 w-4 shrink-0" aria-hidden />
        Dados
      </button>
    );
  }

  function linhaUsuario(ag, opts) {
    const { ativo } = opts;
    const u = usuarioMesclado(ag);
    const exibir = getNomeExibicaoUsuario(u);
    const temPessoa = u.numeroPessoa != null && Number.isFinite(Number(u.numeroPessoa));
    return (
      <div
        key={u.id}
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-900">{exibir}</span>
            <span className="text-xs text-slate-500 font-mono">id: {u.id}</span>
          </div>
          {temPessoa ? (
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-700">Pessoa nº</span> {u.numeroPessoa}
              {u.nome && u.nome !== exibir ? (
                <>
                  {' '}
                  · <span className="text-slate-700">{u.nome}</span>
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1 inline-block">
              Vincule o nº da pessoa em <strong>Dados</strong> (Cadastro de Pessoas).
            </p>
          )}
          {u.login ? (
            <p className="text-xs text-slate-500">
              Login: <span className="font-mono text-slate-700">{u.login}</span>
              {u.senhaHash ? ' · senha definida' : ' · senha não definida'}
            </p>
          ) : (
            <p className="text-xs text-slate-500">Login ainda não configurado.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {opts.mostrarIncluirExcluir ? (
            <>
              <button
                type="button"
                onClick={() => abrirModalIncluir(ag)}
                disabled={ativo}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Incluir
              </button>
              <button
                type="button"
                onClick={() => excluirUsuario(u.id)}
                disabled={!ativo}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Excluir
              </button>
            </>
          ) : null}
          {botaoDados(u)}
          {botaoPermissoes(u)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col p-4 overflow-auto">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200 text-slate-700">
            <UserCog className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Usuários</h1>
            <p className="text-sm text-gray-600">
              Cada usuário deve ter uma pessoa no <strong>Cadastro de Pessoas</strong> (nº único) para evitar homônimos.
              Use o <strong>apelido</strong> para exibição no sistema. Login e senha ficam guardados para o acesso
              futuro. A lista ativa alimenta a <strong>Agenda</strong>, <strong>Pendências</strong> e agendamentos.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <Link
            to="/clientes/lista"
            className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900 hover:bg-indigo-100"
          >
            Cadastro de Pessoas
          </Link>
          <Link
            to="/agenda"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Calendar className="h-4 w-4" />
            Abrir Agenda
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-800">Usuários do sistema</h2>
          <p className="mt-1 text-xs text-slate-600">
            O primeiro usuário da base permanece sempre ativo. Inclua os demais e preencha <strong>Dados</strong> (pessoa,
            apelido, login). Linhas em branco permitem nomes personalizados.
          </p>
        </div>

        <div className="p-4">
          <div className="space-y-4 max-w-4xl">
            {primeira ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600">Usuário base (sempre ativo)</label>
                {linhaUsuario(primeira, { ativo: true, mostrarIncluirExcluir: false })}
              </div>
            ) : null}

            {resto.map((ag) => {
              const ativo = idsAtivos.has(ag.id);
              return linhaUsuario(ag, { ativo, mostrarIncluirExcluir: true });
            })}

            {slotsCustom.map((val, idx) => {
              const idSlot = normalizarNomeParaId(val);
              const ativo = idSlot && idsAtivos.has(idSlot);
              const agSlot = idSlot && val.trim() ? { id: idSlot, nome: String(val).trim() } : null;
              const uSlot = agSlot ? usuarioMesclado(agSlot) : null;
              return (
                <div key={`custom-${idx}`} className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => {
                        const next = [...slotsCustom];
                        next[idx] = e.target.value;
                        setSlotsCustom(next);
                      }}
                      className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Nome adicional (opcional)"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!val.trim()) return;
                          if (!idSlot) return;
                          if (ativo) return;
                          abrirModalIncluir({ id: idSlot, nome: String(val || '').trim() }, { clearSlotIndex: idx });
                        }}
                        disabled={!val.trim() || !!ativo}
                        className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        Incluir
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (ativo) excluirUsuario(idSlot);
                          const next = [...slotsCustom];
                          next[idx] = '';
                          setSlotsCustom(next);
                        }}
                        disabled={!val.trim() && !ativo}
                        className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                  {uSlot && ativo ? (
                    <div className="pl-0 sm:pl-0">
                      {linhaUsuario(agSlot, { ativo: true, mostrarIncluirExcluir: false })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Usuários ativos no momento:{' '}
          <span className="font-medium text-slate-800">
            {(usuariosAtivos || []).map((u) => getNomeExibicaoUsuario(u)).join(', ') || '—'}
          </span>
        </div>
      </div>

      <ModalPermissoesUsuario
        open={!!permModalUsuario}
        usuario={permModalUsuario}
        onClose={() => setPermModalUsuario(null)}
      />

      <ModalDadosUsuario
        open={!!dadosModalUsuario}
        usuario={dadosModalUsuario}
        listaTodos={usuariosAtivos || []}
        onClose={() => setDadosModalUsuario(null)}
        onSalvar={salvarDadosUsuario}
      />

      {modalIncluir ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-incluir-titulo"
          onClick={() => setModalIncluir(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 id="modal-incluir-titulo" className="text-base font-semibold text-slate-800">
                Incluir usuário no sistema
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-medium text-slate-800">{modalIncluir.ag.nome}</span>
                <span className="text-slate-500 font-mono text-xs"> · id: {modalIncluir.ag.id}</span>
              </p>
            </div>
            <div className="px-4 py-4 space-y-4">
              <div>
                <label htmlFor="clone-agenda-origem" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Copiar agenda de outro usuário (opcional)
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Replica na agenda desta pessoa os compromissos já guardados no navegador do usuário escolhido —
                  útil para alinhar audiências e marcos do escritório com quem está entrando.
                </p>
                <select
                  id="clone-agenda-origem"
                  value={modalIncluir.origemCloneId}
                  onChange={(e) =>
                    setModalIncluir((m) => (m ? { ...m, origemCloneId: e.target.value } : m))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  <option value="">— Não copiar agenda —</option>
                  {(usuariosAtivos || [])
                    .filter((u) => String(u.id) !== String(modalIncluir.ag.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {getNomeExibicaoUsuario(u)} ({u.id})
                      </option>
                    ))}
                </select>
                {(usuariosAtivos || []).filter((u) => String(u.id) !== String(modalIncluir.ag.id)).length === 0 ? (
                  <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                    Não há outro usuário ativo para servir de origem. Inclua primeiro ou copie a agenda depois pela
                    tela Agenda.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 bg-slate-50 rounded-b-lg">
              <button
                type="button"
                onClick={() => setModalIncluir(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarInclusaoModal}
                className="rounded-lg border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Confirmar inclusão
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
