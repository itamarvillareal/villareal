import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserCog, Calendar, Shield, UserRoundCog } from 'lucide-react';
import { agendaUsuarios } from '../data/mockData';
import { getUsuariosAtivos, setUsuariosAtivos, criarUsuarioRegistroMinimo } from '../data/agendaPersistenciaData';
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

  function persistirUsuariosAtivos(next) {
    const r = setUsuariosAtivos(next);
    if (!r.ok) {
      window.alert(r.error || 'Não foi possível salvar os usuários.');
      return false;
    }
    setUsuariosAtivosState(getUsuariosAtivos());
    return true;
  }

  function incluirUsuario(usuario) {
    if (!usuario?.id) return;
    const ids = new Set((usuariosAtivos || []).map((u) => u.id));
    if (ids.has(usuario.id)) return;
    persistirUsuariosAtivos([...(usuariosAtivos || []), criarUsuarioRegistroMinimo(usuario)]);
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
                onClick={() => incluirUsuario(criarUsuarioRegistroMinimo(ag))}
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
            to="/clientes"
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
                          incluirUsuario(criarUsuarioRegistroMinimo({ id: idSlot, nome: String(val || '').trim() }));
                          const next = [...slotsCustom];
                          next[idx] = '';
                          setSlotsCustom(next);
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
    </div>
  );
}
