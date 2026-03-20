import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserCog, Calendar } from 'lucide-react';
import { agendaUsuarios } from '../data/mockData';
import { getUsuariosAtivos, setUsuariosAtivos } from '../data/agendaPersistenciaData';

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
 * Cadastro de usuários ativos do sistema (Agenda: agendamento “para todos” e seleção de calendário).
 * Mesma regra do modal na tela Agenda — dados em localStorage via setUsuariosAtivos.
 */
export function Usuarios() {
  const [usuariosAtivos, setUsuariosAtivosState] = useState(() => getUsuariosAtivos());
  const [slotsCustom, setSlotsCustom] = useState(['', '']);

  function persistirUsuariosAtivos(next) {
    setUsuariosAtivosState(next);
    setUsuariosAtivos(next);
  }

  function incluirUsuario(usuario) {
    if (!usuario?.id) return;
    const ids = new Set((usuariosAtivos || []).map((u) => u.id));
    if (ids.has(usuario.id)) return;
    persistirUsuariosAtivos([...(usuariosAtivos || []), usuario]);
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
    persistirUsuariosAtivos([...(usuariosAtivos || []), basePrimeiro]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idsAtivos = new Set((usuariosAtivos || []).map((u) => u.id));
  const primeira = agendaUsuarios?.[0];
  const resto = Array.isArray(agendaUsuarios) ? agendaUsuarios.slice(1) : [];

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
              Esta lista é a única fonte: quem está ativo aqui aparece na <strong className="font-medium text-gray-700">Agenda</strong> (filtro por pessoa), nas <strong className="font-medium text-gray-700">Pendências</strong> (uma coluna por pessoa) e entra no agendamento automático para todos.
            </p>
          </div>
        </div>
        <Link
          to="/agenda"
          className="inline-flex items-center gap-2 self-start rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Calendar className="h-4 w-4" />
          Abrir Agenda
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-800">Usuários do sistema</h2>
          <p className="mt-1 text-xs text-slate-600">
            O primeiro usuário da lista base permanece sempre ativo. Para os demais, use Incluir ou Excluir. Você pode
            adicionar nomes personalizados nas linhas em branco.
          </p>
        </div>

        <div className="p-4">
          <div className="space-y-3 max-w-3xl">
            {primeira ? (
              <div className="grid grid-cols-1 gap-2">
                <label className="text-xs font-medium text-slate-600">Usuário base (sempre ativo)</label>
                <input
                  type="text"
                  value={primeira.nome}
                  readOnly
                  className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                />
              </div>
            ) : null}

            {resto.map((u) => {
              const ativo = idsAtivos.has(u.id);
              return (
                <div key={u.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_120px] sm:items-center sm:gap-3">
                  <input
                    type="text"
                    value={u.nome}
                    readOnly
                    className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => incluirUsuario(u)}
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
                </div>
              );
            })}

            {slotsCustom.map((val, idx) => {
              const idSlot = normalizarNomeParaId(val);
              const ativo = idSlot && idsAtivos.has(idSlot);
              return (
                <div
                  key={`custom-${idx}`}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_120px] sm:items-center sm:gap-3"
                >
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => {
                      const next = [...slotsCustom];
                      next[idx] = e.target.value;
                      setSlotsCustom(next);
                    }}
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Nome adicional (opcional)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!val.trim()) return;
                      if (!idSlot) return;
                      if (ativo) return;
                      incluirUsuario({ id: idSlot, nome: String(val || '').trim() });
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
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Usuários ativos no momento:{' '}
          <span className="font-medium text-slate-800">
            {(usuariosAtivos || []).map((u) => u.nome).join(', ') || '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
