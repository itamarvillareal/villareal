import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { UserCog, Calendar, Shield, UserRoundCog, UserPlus, Search } from 'lucide-react';
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
import {
  listarUsuarios,
  salvarUsuario,
  alternarUsuarioAtivo,
} from '../repositories/usuariosRepository.js';
import { UsuariosListaApiPaginada } from './usuarios/UsuariosListaApiPaginada.jsx';
import { featureFlags } from '../config/featureFlags.js';
import {
  obterPessoaParaVinculoUsuario,
  pesquisarPessoasParaVinculoUsuario,
} from '../services/pessoaVinculoUsuarioService.js';
import { migrarUsuarioIdLocal } from '../services/migrarUsuarioIdLocal.js';
import { gravarSnapshotUsuariosApi } from '../services/syncApiUsuariosSnapshot.js';

/** Exibe CPF (11) ou CNPJ (14) com máscara simples para lista de busca. */
function formatarCpfCnpjLista(digits) {
  const d = String(digits ?? '').replace(/\D/g, '');
  if (d.length <= 11) {
    const p1 = d.slice(0, 3);
    const p2 = d.slice(3, 6);
    const p3 = d.slice(6, 9);
    const p4 = d.slice(9, 11);
    const base = [p1, p2, p3].filter(Boolean).join('.');
    return p4 ? `${base}-${p4}` : base || d;
  }
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 8);
  const p4 = d.slice(8, 12);
  const p5 = d.slice(12, 14);
  const head = [p1, p2, p3].filter(Boolean).join('.');
  const tail = [p4, p5].filter(Boolean).join('-');
  return tail ? `${head}/${tail}` : head || d;
}

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
  const [loading, setLoading] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const extraSlotSeq = useRef(2);
  const [slotsCustom, setSlotsCustom] = useState(() => []);
  const [buscaUsuariosAtivos, setBuscaUsuariosAtivos] = useState('');
  const [listaUsuariosApiRefreshTick, setListaUsuariosApiRefreshTick] = useState(0);
  const [permModalUsuario, setPermModalUsuario] = useState(null);
  const [dadosModalUsuario, setDadosModalUsuario] = useState(null);
  /** { ag, origemCloneId, clearSlotId?, numeroPessoa } */
  const [modalIncluir, setModalIncluir] = useState(null);
  /** Busca no cadastro de pessoas (modal incluir): nome ou CPF/CNPJ. */
  const [modalIncluirBusca, setModalIncluirBusca] = useState({
    termo: '',
    resultados: [],
    loading: false,
    erro: '',
  });

  function persistirUsuariosAtivos(next) {
    const r = setUsuariosAtivos(next);
    if (!r.ok) {
      window.alert(r.error || 'Não foi possível salvar os usuários.');
      return false;
    }
    setUsuariosAtivosState(getUsuariosAtivos());
    return true;
  }

  /** Nova linha para cadastro além dos slots fixos da agenda (quantidade ilimitada). */
  function adicionarLinhaUsuarioExtra() {
    extraSlotSeq.current += 1;
    setSlotsCustom((prev) => [...prev, { id: `extra-${extraSlotSeq.current}`, nome: '' }]);
  }

  const recarregarUsuariosApi = useCallback(async () => {
    if (!featureFlags.useApiUsuarios) return;
    setErroCarregamento('');
    try {
      const data = await listarUsuarios();
      gravarSnapshotUsuariosApi(data || []);
      setUsuariosAtivosState((data || []).filter((u) => u.ativo !== false));
      setListaUsuariosApiRefreshTick((t) => t + 1);
    } catch (e) {
      setErroCarregamento(e?.message || 'Erro ao carregar usuários da API.');
    }
  }, []);

  function excluirUsuario(usuarioId) {
    if (!usuarioId) return;
    const basePrimeiro = Array.isArray(agendaUsuarios) && agendaUsuarios[0] ? agendaUsuarios[0] : null;
    if (basePrimeiro && usuarioId === basePrimeiro.id) return;
    persistirUsuariosAtivos(
      (usuariosAtivos || []).filter((u) => String(u.id) !== String(usuarioId))
    );
  }

  useEffect(() => {
    if (featureFlags.useApiUsuarios) {
      void recarregarUsuariosApi();
      return undefined;
    }
    const basePrimeiro = Array.isArray(agendaUsuarios) && agendaUsuarios[0] ? agendaUsuarios[0] : null;
    if (!basePrimeiro) return;
    const ids = new Set((usuariosAtivos || []).map((u) => u.id));
    if (ids.has(basePrimeiro.id)) return;
    persistirUsuariosAtivos([...(usuariosAtivos || []), criarUsuarioRegistroMinimo(basePrimeiro)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (featureFlags.useApiUsuarios) return;
    const sync = () => setUsuariosAtivosState(getUsuariosAtivos());
    window.addEventListener('vilareal:usuarios-agenda-atualizados', sync);
    return () => window.removeEventListener('vilareal:usuarios-agenda-atualizados', sync);
  }, [featureFlags.useApiUsuarios]);

  useEffect(() => {
    if (!modalIncluir) {
      setModalIncluirBusca({ termo: '', resultados: [], loading: false, erro: '' });
    }
  }, [modalIncluir]);

  const primeira = featureFlags.useApiUsuarios
    ? (usuariosAtivos?.[0] ? { id: usuariosAtivos[0].id, nome: usuariosAtivos[0].nome } : null)
    : agendaUsuarios?.[0];
  const resto = featureFlags.useApiUsuarios
    ? (usuariosAtivos || []).slice(1).map((u) => ({ id: u.id, nome: u.nome }))
    : Array.isArray(agendaUsuarios)
      ? agendaUsuarios.slice(1)
      : [];

  const usuariosAtivosFiltrados = useMemo(() => {
    const termo = buscaUsuariosAtivos.trim().toLowerCase();
    const lista = usuariosAtivos || [];
    if (!termo) return lista;
    return lista.filter((u) => {
      const ex = getNomeExibicaoUsuario(u).toLowerCase();
      const nome = String(u.nome || '').toLowerCase();
      const nomePessoa = String(u.nomePessoa || '').toLowerCase();
      const id = String(u.id || '').toLowerCase();
      const login = String(u.login || '').toLowerCase();
      return (
        ex.includes(termo) ||
        nome.includes(termo) ||
        nomePessoa.includes(termo) ||
        id.includes(termo) ||
        login.includes(termo)
      );
    });
  }, [usuariosAtivos, buscaUsuariosAtivos]);

  const mapaPorId = new Map((usuariosAtivos || []).map((u) => [String(u.id), u]));

  /** Coluna da agenda já tem usuário persistido (id da coluna ou slotAgendaId), mesmo se o id do usuário foi renomeado. */
  function slotAgendaTemUsuarioPersistido(ag) {
    if (!ag?.id) return false;
    const slot = String(ag.id);
    return (usuariosAtivos || []).some(
      (u) => String(u.id) === slot || String(u.slotAgendaId || '') === slot
    );
  }

  function usuarioMesclado(ag) {
    const slot = String(ag.id);
    const porSlot = (usuariosAtivos || []).find((u) => String(u.slotAgendaId || '') === slot);
    if (porSlot) return porSlot;
    return mapaPorId.get(slot) || criarUsuarioRegistroMinimo(ag);
  }

  function abrirModalIncluir(ag, opts = {}) {
    if (!ag?.id) return;
    if (slotAgendaTemUsuarioPersistido(ag)) return;
    const uMesclado = usuarioMesclado(ag);
    const preNum =
      uMesclado?.numeroPessoa != null && Number.isFinite(Number(uMesclado.numeroPessoa))
        ? String(Number(uMesclado.numeroPessoa))
        : '';
    setModalIncluirBusca({ termo: '', resultados: [], loading: false, erro: '' });
    setModalIncluir({
      ag: { id: String(ag.id), nome: String(ag.nome ?? '').trim() || String(ag.id) },
      origemCloneId: '',
      numeroPessoa: preNum,
      apelido: '',
      clearSlotId: opts.clearSlotId != null && opts.clearSlotId !== '' ? String(opts.clearSlotId) : null,
    });
  }

  async function executarBuscaPessoaCadastroIncluir() {
    const termo = modalIncluirBusca.termo.trim();
    if (!termo) {
      setModalIncluirBusca((s) => ({
        ...s,
        erro: 'Digite um nome ou CPF/CNPJ para buscar.',
        resultados: [],
      }));
      return;
    }
    setModalIncluirBusca((s) => ({ ...s, loading: true, erro: '' }));
    try {
      const rows = await pesquisarPessoasParaVinculoUsuario(termo, 40);
      setModalIncluirBusca((s) => ({
        ...s,
        loading: false,
        resultados: rows,
        erro:
          rows.length === 0
            ? 'Nenhuma pessoa encontrada. Tente outro nome ou outro documento.'
            : '',
      }));
    } catch (e) {
      setModalIncluirBusca((s) => ({
        ...s,
        loading: false,
        resultados: [],
        erro: e?.message || 'Erro ao consultar o Cadastro de Pessoas.',
      }));
    }
  }

  async function confirmarInclusaoModal() {
    if (!modalIncluir?.ag?.id) return;
    const { ag, origemCloneId, clearSlotId, numeroPessoa: numeroPessoaStr } = modalIncluir;
    const np = String(numeroPessoaStr ?? '').replace(/\D/g, '');
    if (!np) {
      window.alert(
        'Informe o nº da pessoa já cadastrada em Cadastro de Pessoas. Não é possível incluir usuário sem esse vínculo.'
      );
      return;
    }
    const n = Number(np);
    if (!Number.isFinite(n) || n < 1) {
      window.alert('Número de pessoa inválido.');
      return;
    }
    const pessoa = await obterPessoaParaVinculoUsuario(n);
    if (!pessoa) {
      window.alert(
        `Não existe pessoa com o nº ${n} no cadastro. Cadastre a pessoa em Cadastro de Pessoas antes de criar o usuário.`
      );
      return;
    }
    const duplicadoPessoa = (usuariosAtivos || []).find((u) => Number(u.numeroPessoa) === n);
    if (duplicadoPessoa) {
      window.alert(
        `O nº ${n} já está vinculado ao usuário "${getNomeExibicaoUsuario(duplicadoPessoa)}". Escolha outra pessoa.`
      );
      return;
    }
    const apelidoInformado = String(modalIncluir.apelido ?? '').trim();
    if (!apelidoInformado) {
      window.alert('Informe o apelido (nome de exibição no sistema). É obrigatório ao cadastrar usuário.');
      return;
    }
    const nomeOficial = String(pessoa.nome ?? '').trim() || ag.nome;
    const novo = criarUsuarioRegistroMinimo({ id: ag.id, nome: nomeOficial });
    novo.numeroPessoa = n;
    novo.nome = nomeOficial;
    novo.apelido = apelidoInformado;
    if (featureFlags.useApiUsuarios) {
      try {
        await salvarUsuario({
          ...novo,
          nome: nomeOficial,
          apelido: apelidoInformado,
          login: normalizarNomeParaId(ag.nome) || `usuario_${Date.now()}`,
          senhaHash: 'sem-hash-definido',
          ativo: true,
        });
        await recarregarUsuariosApi();
      } catch (e) {
        window.alert(e?.message || 'Não foi possível incluir o usuário na API.');
        return;
      }
    } else {
      const next = [...(usuariosAtivos || []), novo];
      if (!persistirUsuariosAtivos(next)) return;
    }

    const origem = String(origemCloneId || '').trim();
    if (origem && !featureFlags.useApiUsuarios) {
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

    if (clearSlotId) {
      setSlotsCustom((prev) => prev.filter((r) => r.id !== clearSlotId));
    }
    setModalIncluir(null);
  }

  async function salvarDadosUsuario(atualizado) {
    if (featureFlags.useApiUsuarios) {
      const { idAnterior: _idAnt, slotAgendaId: _slot, ...payload } = atualizado;
      await salvarUsuario(payload);
      await recarregarUsuariosApi();
      return;
    }
    const idAntigo =
      atualizado.idAnterior != null ? String(atualizado.idAnterior).trim() : String(atualizado.id ?? '').trim();
    const { idAnterior: _drop, ...raw } = atualizado;
    const idNovo = String(raw.id ?? '').trim();
    const nomeSalvo = String(raw.nome ?? '').trim() || idNovo;
    const np = raw.numeroPessoa;
    const numeroPessoaNorm =
      np != null && String(np).trim() !== '' && Number.isFinite(Number(np)) ? Number(np) : null;
    const slotStr = raw.slotAgendaId != null ? String(raw.slotAgendaId).trim() : '';
    const slotAgendaFinal = slotStr || (idAntigo !== idNovo ? idAntigo : idNovo);
    const rest = {
      id: idNovo,
      nome: nomeSalvo,
      numeroPessoa: numeroPessoaNorm,
      apelido: String(raw.apelido ?? '').trim(),
      login: String(raw.login ?? '').trim().toLowerCase(),
      senhaHash: String(raw.senhaHash ?? ''),
      slotAgendaId: slotAgendaFinal,
    };
    const atual = getUsuariosAtivos();
    if (idAntigo !== idNovo) {
      if (atual.some((u) => String(u.id) === idNovo)) {
        throw new Error('Já existe usuário com este ID.');
      }
      migrarUsuarioIdLocal(idAntigo, idNovo);
    }
    const next = atual.some((x) => String(x.id) === idAntigo)
      ? atual.map((x) => (String(x.id) === idAntigo ? rest : x))
      : [...atual, rest];
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
    const { ativo, ocultarExcluir } = opts;
    const u = usuarioMesclado(ag);
    const exibir = getNomeExibicaoUsuario(u);
    const temPessoa = u.numeroPessoa != null && Number.isFinite(Number(u.numeroPessoa));
    const nomeCompletoCadastroPessoa = String(u.nomePessoa ?? u.nome ?? '').trim();
    return (
      <div
        key={u.id}
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-900">{exibir}</span>
            <span className="text-xs text-slate-500 font-mono">id: {u.id}</span>
          </div>
          <div className="flex flex-col gap-1 max-w-md">
            <label htmlFor={`apelido-inline-${u.id}`} className="text-xs font-medium text-slate-700">
              Apelido <span className="text-slate-500 font-normal">(como aparece no sistema)</span>
            </label>
            <input
              id={`apelido-inline-${u.id}`}
              key={`apelido-key-${u.id}-${String(u.apelido ?? '')}`}
              type="text"
              defaultValue={String(u.apelido ?? '')}
              disabled={featureFlags.useApiUsuarios}
              onBlur={(e) => {
                if (featureFlags.useApiUsuarios) return;
                const v = e.target.value.trim();
                if (v === String(u.apelido ?? '').trim()) return;
                const next = (usuariosAtivos || []).map((row) =>
                  String(row.id) === String(u.id) ? { ...row, apelido: v } : row
                );
                persistirUsuariosAtivos(next);
              }}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-600"
              placeholder="Ex.: Karla"
            />
            {featureFlags.useApiUsuarios ? (
              <p className="text-[11px] text-slate-500">Com API ativa, edite o apelido em <strong>Dados</strong>.</p>
            ) : null}
          </div>
          {nomeCompletoCadastroPessoa ? (
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-700">Nome no Cadastro de Pessoas</span>{' '}
              {nomeCompletoCadastroPessoa}
            </p>
          ) : null}
          {temPessoa ? (
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-700">Pessoa nº</span> {u.numeroPessoa}
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
              {!ocultarExcluir ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (featureFlags.useApiUsuarios) {
                      try {
                        await alternarUsuarioAtivo(u.id, false);
                        await recarregarUsuariosApi();
                      } catch (e) {
                        window.alert(e?.message || 'Erro ao inativar usuário.');
                      }
                      return;
                    }
                    excluirUsuario(u.id);
                  }}
                  disabled={!ativo}
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Excluir
                </button>
              ) : null}
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
              O <strong>apelido</strong> é o único nome de usuário mostrado no sistema (Agenda, histórico de processos,
              menu, etc.); o nome civil fica só no cadastro da pessoa. Login e senha servem para o acesso futuro.
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
        {featureFlags.useApiUsuarios ? (
          <>
            {erroCarregamento ? (
              <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">
                {erroCarregamento}
              </div>
            ) : null}
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-base font-semibold text-slate-800">Usuários do sistema</h2>
              <p className="mt-1 text-xs text-slate-600">
                Listagem paginada (mesmo padrão do relatório de pessoas). A agenda e pendências continuam usando o espelho
                completo de usuários ativos carregado em segundo plano.
              </p>
            </div>
            <div className="p-4">
              <UsuariosListaApiPaginada
                refreshKey={listaUsuariosApiRefreshTick}
                onAposMutacao={recarregarUsuariosApi}
                onAbrirDados={setDadosModalUsuario}
                onAbrirPermissoes={setPermModalUsuario}
                onNovoUsuario={() =>
                  abrirModalIncluir({ id: `novo-${Date.now()}`, nome: 'Novo usuário' })
                }
              />
            </div>
          </>
        ) : (
          <>
            {loading ? (
              <div className="px-4 py-3 text-sm text-slate-600 border-b border-slate-200">
                Carregando usuários...
              </div>
            ) : null}
            {erroCarregamento ? (
              <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">
                {erroCarregamento}
              </div>
            ) : null}
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-base font-semibold text-slate-800">Usuários do sistema</h2>
              <p className="mt-1 text-xs text-slate-600">
                O primeiro usuário (master) permanece sempre ativo. Use <strong>Acrescentar usuário</strong> na seção de
                usuários adicionais para incluir quantos precisar — não há limite. Nos slots fixos da agenda, use{' '}
                <strong>Incluir</strong> e preencha <strong>Dados</strong> (pessoa, apelido, login). Usuários fora dos
                slots aceitam nomes personalizados para gerar o id.
              </p>
            </div>

            <div className="p-4">
              <div className="space-y-4 max-w-4xl">
                {primeira ? (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600">
                      Usuário master / base (sempre ativo)
                    </label>
                    {linhaUsuario(primeira, {
                      ativo: true,
                      mostrarIncluirExcluir: false,
                      ocultarExcluir: true,
                    })}
                  </div>
                ) : null}

                {resto.map((ag) => {
                  const ativo = slotAgendaTemUsuarioPersistido(ag);
                  return linhaUsuario(ag, { ativo, mostrarIncluirExcluir: true });
                })}

                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <p className="text-xs font-medium text-slate-600 pt-0.5">
                      Usuários adicionais (fora dos slots fixos da agenda)
                    </p>
                    <button
                      type="button"
                      onClick={() => adicionarLinhaUsuarioExtra()}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100"
                    >
                      <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                      Acrescentar usuário
                    </button>
                  </div>
                  {slotsCustom.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Nenhum campo em aberto. Use <strong>Acrescentar usuário</strong> para incluir um novo cadastro.
                    </p>
                  ) : null}
                  <div className="max-h-[min(50vh,22rem)] overflow-y-auto overflow-x-hidden pr-1 space-y-4 [scrollbar-gutter:stable]">
                    {slotsCustom.map((row) => {
                      const val = row.nome;
                      const idSlot = normalizarNomeParaId(val);
                      const agSlot = idSlot && val.trim() ? { id: idSlot, nome: String(val).trim() } : null;
                      const ativo = agSlot ? slotAgendaTemUsuarioPersistido(agSlot) : false;
                      const uSlot = agSlot ? usuarioMesclado(agSlot) : null;
                      return (
                        <div key={row.id} className="space-y-2">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSlotsCustom((prev) =>
                                  prev.map((r) => (r.id === row.id ? { ...r, nome: v } : r))
                                );
                              }}
                              className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                              placeholder="Nome para gerar o id do usuário (ex.: Novo estagiário)"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!val.trim()) return;
                                  if (!idSlot) return;
                                  if (ativo) return;
                                  abrirModalIncluir(
                                    { id: idSlot, nome: String(val || '').trim() },
                                    { clearSlotId: row.id }
                                  );
                                }}
                                disabled={!val.trim() || !!ativo}
                                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                              >
                                Incluir
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (ativo && idSlot) excluirUsuario(idSlot);
                                  setSlotsCustom((prev) => prev.filter((r) => r.id !== row.id));
                                }}
                                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                              >
                                Excluir linha
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
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium text-slate-700 mb-2">Usuários ativos no momento</p>
              <div className="relative mb-2">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={buscaUsuariosAtivos}
                  onChange={(e) => setBuscaUsuariosAtivos(e.target.value)}
                  placeholder="Buscar por nome, apelido, id ou login…"
                  className="w-full rounded border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400"
                  aria-label="Buscar entre usuários ativos"
                />
              </div>
              <div className="max-h-[min(40vh,16rem)] overflow-y-auto overflow-x-hidden rounded border border-slate-200 bg-white [scrollbar-gutter:stable]">
                {(usuariosAtivos || []).length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-500">—</p>
                ) : usuariosAtivosFiltrados.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-500">Nenhum usuário corresponde à busca.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {usuariosAtivosFiltrados.map((u) => (
                      <li key={String(u.id)} className="px-3 py-2 text-xs text-slate-700">
                        <span className="font-medium text-slate-800">{getNomeExibicaoUsuario(u)}</span>
                        <span className="text-slate-500 font-mono"> · id: {u.id}</span>
                        {u.login ? (
                          <span className="block text-slate-500 mt-0.5">
                            login: <span className="font-mono text-slate-600">{u.login}</span>
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
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
        podeEditarIdUsuario={
          !featureFlags.useApiUsuarios &&
          dadosModalUsuario &&
          String(dadosModalUsuario.id) !== String(agendaUsuarios?.[0]?.id)
        }
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
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3 space-y-2">
                <label htmlFor="incluir-busca-pessoa" className="block text-xs font-medium text-slate-700">
                  Buscar no Cadastro de Pessoas
                </label>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Digite parte do <strong className="font-medium text-slate-600">nome</strong> ou o{' '}
                  <strong className="font-medium text-slate-600">CPF/CNPJ</strong> (só números ou com pontuação).
                  Se o texto tiver letras, a busca é por nome; se for só dígitos (3 ou mais), por documento.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="incluir-busca-pessoa"
                    type="search"
                    value={modalIncluirBusca.termo}
                    onChange={(e) =>
                      setModalIncluirBusca((s) => ({ ...s, termo: e.target.value, erro: '' }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void executarBuscaPessoaCadastroIncluir();
                      }
                    }}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                    placeholder="Ex.: Maria Silva ou 529.982.247-25"
                    autoComplete="off"
                    disabled={modalIncluirBusca.loading}
                  />
                  <button
                    type="button"
                    onClick={() => void executarBuscaPessoaCadastroIncluir()}
                    disabled={modalIncluirBusca.loading}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-500 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 shrink-0"
                  >
                    <Search className="h-4 w-4" aria-hidden />
                    {modalIncluirBusca.loading ? 'Buscando…' : 'Buscar'}
                  </button>
                </div>
                {modalIncluirBusca.erro ? (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                    {modalIncluirBusca.erro}
                  </p>
                ) : null}
                {modalIncluirBusca.resultados.length > 0 ? (
                  <div className="mt-1">
                    <p className="text-[11px] font-medium text-slate-600 mb-1">Resultados — clique para preencher o nº</p>
                    <ul className="max-h-36 overflow-y-auto rounded border border-slate-200 bg-white divide-y divide-slate-100 [scrollbar-gutter:stable]">
                      {modalIncluirBusca.resultados.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="w-full text-left px-2.5 py-2 text-xs hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-inset"
                            onClick={() =>
                              setModalIncluir((m) =>
                                m ? { ...m, numeroPessoa: String(p.id) } : m
                              )
                            }
                          >
                            <span className="font-mono text-slate-600">nº {p.id}</span>
                            <span className="text-slate-400 mx-1">·</span>
                            <span className="font-medium text-slate-800">{p.nome}</span>
                            {p.cpf ? (
                              <span className="block text-slate-500 mt-0.5 font-mono">
                                {formatarCpfCnpjLista(p.cpf)}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div>
                <label htmlFor="incluir-numero-pessoa" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Nº da pessoa no Cadastro de Pessoas <span className="text-red-600">*</span>
                </label>
                <input
                  id="incluir-numero-pessoa"
                  type="text"
                  inputMode="numeric"
                  value={modalIncluir.numeroPessoa}
                  onChange={(e) =>
                    setModalIncluir((m) =>
                      m ? { ...m, numeroPessoa: e.target.value.replace(/\D/g, '') } : m
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  placeholder="Mesmo número exibido no cadastro da pessoa"
                  autoComplete="off"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  O usuário só pode ser criado se essa pessoa já existir em{' '}
                  <Link to="/clientes/lista" className="text-indigo-600 underline">
                    Cadastro de Pessoas
                  </Link>
                  . Use a busca acima ou informe o número manualmente.
                </p>
              </div>
              <div>
                <label htmlFor="incluir-apelido" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Apelido <span className="text-red-600">*</span>
                </label>
                <input
                  id="incluir-apelido"
                  type="text"
                  value={modalIncluir.apelido ?? ''}
                  onChange={(e) =>
                    setModalIncluir((m) => (m ? { ...m, apelido: e.target.value } : m))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  placeholder="Como o nome aparece na Agenda e nas telas (ex.: Karla)"
                  autoComplete="off"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Obrigatório. É o único nome de usuário exibido no sistema, além do login para acesso.
                </p>
              </div>
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
                onClick={() => void confirmarInclusaoModal()}
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
