import { useState, useMemo, useEffect, useRef } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  agendaUsuarios,
  agendaDataEsquerda,
  agendaDataDireita,
  agendaEventosTerça,
  agendaEventosQuarta,
  agendaCalendarioMarco2026,
} from '../data/mockData';
import {
  getEventosAgendaPersistidosPorData,
  getUsuariosAtivos,
  setUsuariosAtivos,
  salvarCamposEventoAgendaPersistido,
  criarNovoCompromissoAgendaPersistido,
  listarTodosCompromissosAgendaMes,
  normalizarStatusCurtoAgenda,
  ordenarListaEventosAgenda,
} from '../data/agendaPersistenciaData';
import { buscarProcessoUnicoNaBasePorTextoAgenda } from '../data/processosHistoricoData';

/** Retorna string DD/MM/YYYY para dia/mês/ano */
function dataStr(dia, mes, ano) {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function parseDataBrCompleta(str) {
  const s = String(str ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  if (mm < 1 || mm > 12) return null;
  const maxDia = new Date(yyyy, mm, 0).getDate();
  if (dd < 1 || dd > maxDia) return null;
  return { dd, mm, yyyy };
}

/** Ex.: "10/03/2026 (ter)" */
function rotuloDataComDiaSemana(dataBr) {
  const p = parseDataBrCompleta(dataBr);
  if (!p) return String(dataBr ?? '');
  const dt = new Date(p.yyyy, p.mm - 1, p.dd);
  const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  return `${dataBr} (${dias[dt.getDay()] ?? '—'})`;
}

/** Remove acentos e minúsculas para busca insensível a maiúsculas/acentos. */
function normalizarParaBuscaPalavraChave(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/**
 * "instrução" / "instrucao" → vermelho;
 * "conciliação" / "sessão de julgamento" (e variantes sem acento) → amarelo.
 * Se instrução e amarelo aparecerem, instrução tem prioridade.
 */
function temaPorTextoCompromisso(texto) {
  const n = normalizarParaBuscaPalavraChave(texto);
  if (n.includes('instrucao')) return 'instrucao';
  if (n.includes('conciliacao') || n.includes('sessao de julgamento')) return 'conciliacao';
  return null;
}

/** Classes para o bloco de descrição no modal (duplo clique). */
function classesTemaDescricaoModal(texto) {
  const t = temaPorTextoCompromisso(texto);
  if (t === 'instrucao') {
    return 'text-sm whitespace-pre-wrap rounded px-2 py-2 bg-red-600 text-white border border-red-700';
  }
  if (t === 'conciliacao') {
    return 'text-sm whitespace-pre-wrap rounded px-2 py-2 bg-yellow-300 text-black border border-yellow-600';
  }
  return 'text-sm text-slate-800 whitespace-pre-wrap';
}

/** Campo de texto clicável para editar (hora ou descrição). */
function EditableTextCell({
  texto,
  onSalvar,
  multiline = false,
  align = 'left',
  maxLen = 2000,
  temaPorPalavraChave = false,
  /** Duplo clique (2º clique): abre detalhe / processo — não entra em edição. */
  onDuploClique = null,
}) {
  const original = String(texto ?? '');
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(original);
  const inputRef = useRef(null);
  const cancelouRef = useRef(false);

  useEffect(() => {
    if (!editando) setValor(original);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original]);

  useEffect(() => {
    if (!editando) return;
    const el = inputRef.current;
    if (!el) return;
    try {
      el.focus();
      if (!multiline) el.select?.();
    } catch {
      // ignore
    }
  }, [editando, multiline]);

  function salvarSeMudou() {
    const novo = String(valor ?? '').slice(0, maxLen);
    if (novo === original) {
      setEditando(false);
      return;
    }
    onSalvar?.(novo);
    setEditando(false);
  }

  const alignClass = align === 'right' ? 'text-right' : 'text-left';
  const inputAlign = align === 'right' ? 'text-right' : 'text-left';

  const textoParaTema = temaPorPalavraChave ? String(editando ? valor : original) : '';
  const tema = temaPorPalavraChave ? temaPorTextoCompromisso(textoParaTema) : null;
  const classesTemaInput =
    tema === 'instrucao'
      ? 'bg-red-600 text-white border-red-700 focus:ring-red-400 placeholder:text-red-200'
      : tema === 'conciliacao'
        ? 'bg-yellow-300 text-black border-yellow-600 focus:ring-yellow-600 placeholder:text-yellow-900/60'
        : 'bg-white text-gray-900 border-slate-300 focus:ring-blue-500';
  const classesTemaLeitura =
    tema === 'instrucao'
      ? 'bg-red-600 text-white border border-red-700 rounded px-1.5 py-1'
      : tema === 'conciliacao'
        ? 'bg-yellow-300 text-black border border-yellow-600 rounded px-1.5 py-1'
        : 'text-gray-800';

  return (
    <div
      className="min-w-0 w-full"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {editando ? (
        multiline ? (
          <textarea
            ref={inputRef}
            value={valor}
            onChange={(e) => setValor(e.target.value.slice(0, maxLen))}
            onDoubleClick={(e) => e.stopPropagation()}
            onBlur={() => {
              if (cancelouRef.current) {
                cancelouRef.current = false;
                setEditando(false);
                return;
              }
              salvarSeMudou();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelouRef.current = true;
                setValor(original);
                setEditando(false);
              }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                salvarSeMudou();
              }
            }}
            rows={3}
            className={`w-full px-1.5 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-y min-h-[3rem] ${inputAlign} ${classesTemaInput}`}
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={valor}
            onChange={(e) => setValor(e.target.value.slice(0, maxLen))}
            onDoubleClick={(e) => e.stopPropagation()}
            onBlur={() => {
              if (cancelouRef.current) {
                cancelouRef.current = false;
                setEditando(false);
                return;
              }
              salvarSeMudou();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                salvarSeMudou();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelouRef.current = true;
                setValor(original);
                setEditando(false);
              }
            }}
            className={`w-full px-1.5 py-1 text-sm border rounded focus:outline-none focus:ring-1 ${inputAlign} ${classesTemaInput}`}
            placeholder=""
            maxLength={maxLen}
          />
        )
      ) : (
        <div
          className={`${classesTemaLeitura} ${multiline ? 'text-sm whitespace-pre-wrap break-words' : 'text-sm truncate'} block w-full cursor-text select-none ${alignClass} ${multiline ? 'min-h-[1.25rem]' : ''}`}
          style={multiline ? undefined : { minHeight: '18px' }}
          onClick={(e) => {
            e.stopPropagation();
            if (onDuploClique && e.detail === 2) {
              e.preventDefault();
              setEditando(false);
              onDuploClique();
              return;
            }
            setEditando(true);
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          title={original}
        >
          {original || '\u00A0'}
        </div>
      )}
    </div>
  );
}

/** Status: apenas em branco ou "OK" (persistência normaliza outros valores). */
function StatusCurtoCell({ evento, onSalvar }) {
  const valor = normalizarStatusCurtoAgenda(evento?.statusCurto);
  return (
    <div className="w-[92px] flex items-center justify-end pr-1" onClick={(e) => e.stopPropagation()}>
      <select
        value={valor}
        onChange={(e) => onSalvar?.(e.target.value === 'OK' ? 'OK' : '')}
        onDoubleClick={(e) => e.stopPropagation()}
        title="Status: em branco ou OK"
        className="w-full min-w-0 max-w-[6rem] px-1 py-1 text-sm text-right border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        aria-label="Status do compromisso"
      >
        <option value=""> </option>
        <option value="OK">OK</option>
      </select>
    </div>
  );
}

function ColunaDia({
  dataLabel,
  eventos,
  onDuploCliqueEvento,
  dataBrStr,
  onSalvarCampos,
  usuarioAgendaId,
  onPersistenciaAlterada,
}) {
  /** Última linha (novo compromisso): id criado até liberar após salvar hora/descrição. */
  const pendingNovaLinhaIdRef = useRef(null);
  const [novaLinhaBump, setNovaLinhaBump] = useState(0);

  useEffect(() => {
    pendingNovaLinhaIdRef.current = null;
    setNovaLinhaBump((n) => n + 1);
  }, [dataBrStr, usuarioAgendaId]);

  function salvarLinhaVazia(patch) {
    if (!dataBrStr) return;
    const uid = String(usuarioAgendaId ?? '');
    const pendingId = pendingNovaLinhaIdRef.current;
    if (pendingId) {
      onSalvarCampos?.({ id: pendingId, usuarioId: uid }, patch);
      const atualizaHoraOuDesc = patch.hora !== undefined || patch.descricao !== undefined;
      if (atualizaHoraOuDesc) {
        pendingNovaLinhaIdRef.current = null;
        setNovaLinhaBump((n) => n + 1);
      }
      return;
    }
    const r = criarNovoCompromissoAgendaPersistido({ dataBr: dataBrStr, usuarioId: uid, patch });
    if (r.ok && r.id) {
      pendingNovaLinhaIdRef.current = r.id;
      setNovaLinhaBump((n) => n + 1);
      onPersistenciaAlterada?.();
    }
  }

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col border border-gray-300 rounded bg-white overflow-hidden">
      <div className="px-2 py-2 shrink-0 bg-gray-100 border-b border-gray-300 text-base font-medium text-gray-800">
        {dataLabel}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1.5">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-[96px] px-2 py-1.5 text-left text-xs font-semibold text-gray-600">Hora</th>
              <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600">Descrição</th>
              <th className="w-[92px] px-1 py-1.5 text-right text-xs font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((ev) => (
              <tr
                key={ev.id}
                className={`border-b border-gray-100 min-h-[42px] overflow-hidden ${
                  ev.destaque ? 'bg-amber-100' : ''
                }`}
                onDoubleClick={() => onDuploCliqueEvento?.(ev)}
              >
                <td className="w-[96px] px-2 py-1.5 align-top text-sm">
                  <EditableTextCell
                    texto={ev.hora ?? ''}
                    align="left"
                    maxLen={12}
                    onDuploClique={() => onDuploCliqueEvento?.(ev)}
                    onSalvar={(novo) => {
                      if (!dataBrStr) return;
                      onSalvarCampos?.(ev, { hora: novo });
                    }}
                  />
                </td>
                <td className="px-2 py-1.5 align-top text-sm min-w-0">
                  <EditableTextCell
                    texto={ev.descricao ?? ''}
                    multiline
                    align="left"
                    maxLen={2000}
                    temaPorPalavraChave
                    onDuploClique={() => onDuploCliqueEvento?.(ev)}
                    onSalvar={(novo) => {
                      if (!dataBrStr) return;
                      onSalvarCampos?.(ev, { descricao: novo });
                    }}
                  />
                </td>
                <td className="w-[92px] px-0 py-1.5 align-top text-right">
                  <StatusCurtoCell
                    evento={ev}
                    onSalvar={(novo) => {
                      if (!dataBrStr) return;
                      onSalvarCampos?.(ev, { statusCurto: novo });
                    }}
                  />
                </td>
              </tr>
            ))}
            <tr
              key={`linha-nova-${novaLinhaBump}`}
              className="border-b border-gray-100 min-h-[42px] overflow-hidden bg-slate-50/50"
            >
              <td className="w-[96px] px-2 py-1.5 align-top text-sm">
                <EditableTextCell
                  texto=""
                  align="left"
                  maxLen={12}
                  onSalvar={(novo) => salvarLinhaVazia({ hora: novo })}
                />
              </td>
              <td className="px-2 py-1.5 align-top text-sm min-w-0">
                <EditableTextCell
                  texto=""
                  multiline
                  align="left"
                  maxLen={2000}
                  temaPorPalavraChave
                  onSalvar={(novo) => salvarLinhaVazia({ descricao: novo })}
                />
              </td>
              <td className="w-[92px] px-0 py-1.5 align-top text-right">
                <StatusCurtoCell
                  evento={{ statusCurto: '' }}
                  onSalvar={(novo) => salvarLinhaVazia({ statusCurto: novo })}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PainelCalendario({
  mesAtual,
  anoAtual,
  setMesAtual,
  setAnoAtual,
  diaSelecionado,
  setDiaSelecionado,
  usuarioSelecionado,
  setUsuarioSelecionado,
  nomeGrupo = 'painel',
  usuariosSistema,
  onAbrirUsuariosSistema,
}) {
  const n = new Date();
  const hojeReal = { dd: n.getDate(), mm: n.getMonth() + 1, yyyy: n.getFullYear() };
  const maxDiaNoMes = new Date(anoAtual, mesAtual, 0).getDate();
  const dias = Array.from({ length: maxDiaNoMes }, (_, i) => i + 1);
  const primeiroDiaSemana = new Date(anoAtual, mesAtual - 1, 1).getDay();
  const nomeMesAtual = MESES[mesAtual - 1] ?? '';
  const dataSelecionadaStr = dataStr(diaSelecionado, mesAtual, anoAtual);

  const [textoDataCompleta, setTextoDataCompleta] = useState(dataSelecionadaStr);

  useEffect(() => {
    setTextoDataCompleta(dataSelecionadaStr);
  }, [dataSelecionadaStr]);

  useEffect(() => {
    const max = new Date(anoAtual, mesAtual, 0).getDate();
    if (diaSelecionado > max) setDiaSelecionado(max);
  }, [mesAtual, anoAtual, diaSelecionado, setDiaSelecionado]);

  function parseDataCompleta(str) {
    const s = String(str ?? '').trim();
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (!m) return null;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
    if (mm < 1 || mm > 12) return null;
    const maxDia = new Date(yyyy, mm, 0).getDate();
    if (dd < 1 || dd > maxDia) return null;
    return { dd, mm, yyyy };
  }

  function formatDataCompleta({ dd, mm, yyyy }) {
    return `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`;
  }

  function aplicarTextoData() {
    const parsed = parseDataCompleta(textoDataCompleta);
    if (!parsed) {
      // Mantém o valor sincronizado com o que já está sendo exibido.
      setTextoDataCompleta(dataSelecionadaStr);
      return;
    }
    const normalizada = formatDataCompleta(parsed);
    setTextoDataCompleta(normalizada);
    setAnoAtual(parsed.yyyy);
    setMesAtual(parsed.mm);
    setDiaSelecionado(parsed.dd);
  }

  function irParaDataDeHoje() {
    const agora = new Date();
    setAnoAtual(agora.getFullYear());
    setMesAtual(agora.getMonth() + 1);
    setDiaSelecionado(agora.getDate());
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col gap-4 p-4 bg-gray-100 border border-gray-300 rounded-lg overflow-y-auto">
      <div className="border border-gray-300 rounded-lg p-3 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => {
              if (mesAtual <= 1) { setMesAtual(12); setAnoAtual((a) => a - 1); }
              else setMesAtual((m) => m - 1);
            }}
            className="p-1.5 rounded hover:bg-gray-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium capitalize">
            {nomeMesAtual} {anoAtual}
          </span>
          <button
            type="button"
            onClick={() => {
              if (mesAtual >= 12) { setMesAtual(1); setAnoAtual((a) => a + 1); }
              else setMesAtual((m) => m + 1);
            }}
            className="p-1.5 rounded hover:bg-gray-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-xs">
          {agendaCalendarioMarco2026.diasSemana.map((d) => (
            <div key={d} className="text-center font-medium text-gray-600 py-0.5">
              {d}
            </div>
          ))}
          {Array.from({ length: primeiroDiaSemana }).map((_, i) => (
            <div key={`v-${i}`} />
          ))}
          {dias.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDiaSelecionado(d)}
              className={`py-1 rounded text-xs ${
                d === diaSelecionado
                  ? 'bg-blue-600 text-white font-medium'
                  : mesAtual === hojeReal.mm && anoAtual === hojeReal.yyyy && d === hojeReal.dd
                    ? 'bg-blue-400 text-white'
                    : 'hover:bg-gray-200 text-gray-800'
              }`}
            >
              {String(d).padStart(2, '0')}
            </button>
          ))}
        </div>
        <p
          className="text-xs text-gray-500 mt-2 cursor-pointer select-none hover:text-gray-700 hover:underline"
          title="Duplo clique para ir à data de hoje no calendário"
          onDoubleClick={(e) => {
            e.preventDefault();
            irParaDataDeHoje();
          }}
        >
          Hoje: {dataStr(hojeReal.dd, hojeReal.mm, hojeReal.yyyy)}
        </p>
      </div>

      <div className="border border-gray-300 rounded-lg p-3 bg-white shadow-sm">
        <div className="text-sm font-medium text-gray-700 mb-2">Data completa</div>
        <input
          type="text"
          inputMode="numeric"
          value={textoDataCompleta}
          onChange={(e) => setTextoDataCompleta(e.target.value)}
          onBlur={aplicarTextoData}
          onKeyDown={(e) => {
            if (e.key === 'Enter') aplicarTextoData();
          }}
          placeholder="dd/mm/aaaa"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        />
      </div>

      <div>
        <div className="text-sm font-medium text-gray-700 mb-0.5">Usuário</div>
        <p className="text-[11px] text-gray-500 mb-1.5 leading-snug">
          Agenda por pessoa — mesmos cadastros ativos da tela <strong className="font-medium text-gray-600">Usuários</strong>.
        </p>
        <div className="space-y-1">
          {usuariosSistema.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name={`usuario-${nomeGrupo}`}
                value={u.id}
                checked={usuarioSelecionado === u.id}
                onChange={() => setUsuarioSelecionado(u.id)}
                className="text-blue-600"
              />
              {u.nome}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <button type="button" className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-200">
          Pesquisar
        </button>
        <button
          type="button"
          onClick={() => onAbrirUsuariosSistema?.()}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-200"
          title="Cadastro de pessoas da agenda (mesma lista da tela Usuários)"
        >
          Usuários
        </button>
      </div>
    </aside>
  );
}

export function Agenda() {
  const location = useLocation();
  const navigate = useNavigate();
  const [usuarioEsquerda, setUsuarioEsquerda] = useState('itamar');
  const [usuarioDireita, setUsuarioDireita] = useState('itamar');
  const [mesEsquerda, setMesEsquerda] = useState(3);
  const [anoEsquerda, setAnoEsquerda] = useState(2026);
  const [diaEsquerda, setDiaEsquerda] = useState(agendaCalendarioMarco2026.diaSelecionado ?? 10);
  const [mesDireita, setMesDireita] = useState(3);
  const [anoDireita, setAnoDireita] = useState(2026);
  const [diaDireita, setDiaDireita] = useState(11);
  const [eventoModal, setEventoModal] = useState(null);
  const [modalAgendaMensal, setModalAgendaMensal] = useState(false);
  const [agendaStatusNonce, setAgendaStatusNonce] = useState(0);
  const [usuariosAtivos, setUsuariosAtivosState] = useState(() => getUsuariosAtivos());

  /** Lista de pessoas = mesma da tela Usuários (localStorage); sincroniza ao salvar ou ao voltar à Agenda. */
  useEffect(() => {
    const sync = () => setUsuariosAtivosState(getUsuariosAtivos());
    sync();
    window.addEventListener('vilareal:usuarios-agenda-atualizados', sync);
    return () => window.removeEventListener('vilareal:usuarios-agenda-atualizados', sync);
  }, []);

  useEffect(() => {
    if (location.pathname === '/agenda') {
      setUsuariosAtivosState(getUsuariosAtivos());
    }
  }, [location.pathname]);

  useEffect(() => {
    // Caso o usuário exclua o usuário atualmente selecionado, mantém seleção válida.
    const ids = new Set((usuariosAtivos || []).map((u) => u.id));
    const primeiraUsuarioId = Array.isArray(usuariosAtivos) && usuariosAtivos.length > 0 ? usuariosAtivos[0].id : 'itamar';

    if (!ids.has(usuarioEsquerda)) setUsuarioEsquerda(primeiraUsuarioId);
    if (!ids.has(usuarioDireita)) setUsuarioDireita(primeiraUsuarioId);
  }, [usuariosAtivos, usuarioEsquerda, usuarioDireita]);

  function persistirUsuariosAtivos(next) {
    setUsuariosAtivosState(next);
    setUsuariosAtivos(next);
  }

  /** Duplo clique no compromisso: se houver um único nº de processo reconhecido na base, abre Processos. */
  function aoDuploCliqueCompromisso(ev) {
    const texto = `${ev.descricao ?? ''}\n${ev.hora ?? ''}`;
    const found = buscarProcessoUnicoNaBasePorTextoAgenda(texto);
    if (found) {
      navigate('/processos', { state: { codCliente: found.codCliente, proc: String(found.proc) } });
      return;
    }
    setEventoModal(ev);
  }

  useEffect(() => {
    // Mantém o 1o usuário base ativo (no print ele aparece sem botões).
    const basePrimeiro = Array.isArray(agendaUsuarios) && agendaUsuarios[0] ? agendaUsuarios[0] : null;
    if (!basePrimeiro) return;
    const ids = new Set((usuariosAtivos || []).map((u) => u.id));
    if (ids.has(basePrimeiro.id)) return;
    persistirUsuariosAtivos([...(usuariosAtivos || []), basePrimeiro]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Se vier uma data via navegação (Processos -> duplo clique em Data), posiciona o painel nela.
  useEffect(() => {
    const raw = location.state && typeof location.state === 'object' ? location.state.agendaData : null;
    if (!raw) return;
    const parsed = parseDataBrCompleta(raw);
    if (!parsed) return;

    setDiaEsquerda(parsed.dd);
    setMesEsquerda(parsed.mm);
    setAnoEsquerda(parsed.yyyy);

    const dt = new Date(parsed.yyyy, parsed.mm - 1, parsed.dd);
    dt.setDate(dt.getDate() + 1);
    setDiaDireita(dt.getDate());
    setMesDireita(dt.getMonth() + 1);
    setAnoDireita(dt.getFullYear());
  }, [location.key, location.state]);

  const dataEsquerdaStr = dataStr(diaEsquerda, mesEsquerda, anoEsquerda);
  const dataDireitaStr = dataStr(diaDireita, mesDireita, anoDireita);

  // Recalcula ao mudar `agendaStatusNonce` (salvando statusCurto no localStorage).
  const eventosPersistidosEsquerda = getEventosAgendaPersistidosPorData(dataEsquerdaStr);
  const eventosPersistidosDireita = getEventosAgendaPersistidosPorData(dataDireitaStr);

  const eventosEsquerda = useMemo(
    () => {
      const base = dataEsquerdaStr === agendaDataEsquerda ? agendaEventosTerça : [];
      const persisted = (Array.isArray(eventosPersistidosEsquerda) ? eventosPersistidosEsquerda : []).filter((ev) => {
        if (!ev) return false;
        if (ev.usuarioId == null || String(ev.usuarioId) === '') return true;
        return String(ev.usuarioId) === String(usuarioEsquerda);
      });

      const merged = new Map();
      for (const ev of base) merged.set(String(ev.id), { ...ev, statusCurto: normalizarStatusCurtoAgenda(ev.statusCurto) });
      for (const ev of persisted) {
        const key = String(ev.id);
        const prev = merged.get(key) || {};
        merged.set(key, {
          ...prev,
          ...ev,
          statusCurto: normalizarStatusCurtoAgenda(ev.statusCurto ?? prev.statusCurto ?? ''),
        });
      }
      return ordenarListaEventosAgenda(Array.from(merged.values()));
    },
    [dataEsquerdaStr, eventosPersistidosEsquerda, usuarioEsquerda, agendaStatusNonce]
  );
  const eventosDireita = useMemo(
    () => {
      const base = dataDireitaStr === agendaDataDireita ? agendaEventosQuarta : [];
      const persisted = (Array.isArray(eventosPersistidosDireita) ? eventosPersistidosDireita : []).filter((ev) => {
        if (!ev) return false;
        if (ev.usuarioId == null || String(ev.usuarioId) === '') return true;
        return String(ev.usuarioId) === String(usuarioDireita);
      });

      const merged = new Map();
      for (const ev of base) merged.set(String(ev.id), { ...ev, statusCurto: normalizarStatusCurtoAgenda(ev.statusCurto) });
      for (const ev of persisted) {
        const key = String(ev.id);
        const prev = merged.get(key) || {};
        merged.set(key, {
          ...prev,
          ...ev,
          statusCurto: normalizarStatusCurtoAgenda(ev.statusCurto ?? prev.statusCurto ?? ''),
        });
      }
      return ordenarListaEventosAgenda(Array.from(merged.values()));
    },
    [dataDireitaStr, eventosPersistidosDireita, usuarioDireita, agendaStatusNonce]
  );

  const relatorioAgendaMensal = useMemo(
    () =>
      listarTodosCompromissosAgendaMes({
        ano: anoEsquerda,
        mes: mesEsquerda,
        usuarioId: usuarioEsquerda,
      }),
    [anoEsquerda, mesEsquerda, usuarioEsquerda, agendaStatusNonce]
  );

  const nomeUsuarioAgenda = useMemo(() => {
    const u = (usuariosAtivos || []).find((x) => String(x.id) === String(usuarioEsquerda));
    return u?.nome ?? usuarioEsquerda ?? '—';
  }, [usuariosAtivos, usuarioEsquerda]);

  const tituloMesRelatorio = `${MESES[mesEsquerda - 1] ?? ''} de ${anoEsquerda}`;
  const totalCompromissosMensal = useMemo(
    () => relatorioAgendaMensal.diasComEventos.reduce((acc, d) => acc + d.eventos.length, 0),
    [relatorioAgendaMensal]
  );

  return (
    <div className="flex flex-1 min-h-0 p-4 gap-4 overflow-hidden">
      {/* Painel esquerdo: Calendário + Usuário + Botões */}
      <PainelCalendario
        mesAtual={mesEsquerda}
        anoAtual={anoEsquerda}
        setMesAtual={setMesEsquerda}
        setAnoAtual={setAnoEsquerda}
        diaSelecionado={diaEsquerda}
        setDiaSelecionado={setDiaEsquerda}
        usuarioSelecionado={usuarioEsquerda}
        setUsuarioSelecionado={setUsuarioEsquerda}
        nomeGrupo="esquerda"
        usuariosSistema={usuariosAtivos}
        onAbrirUsuariosSistema={() => navigate('/usuarios')}
      />

      {/* Área central: duas colunas de compromissos (simétricas) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">Agenda</h1>
          <button
            type="button"
            onClick={() => setModalAgendaMensal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium shadow-sm hover:bg-slate-50"
            title="Relatório de todos os compromissos do mês (usuário do calendário esquerdo)"
          >
            <CalendarDays className="w-4 h-4 text-slate-600" aria-hidden />
            Agenda mensal
          </button>
        </div>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <ColunaDia
            dataLabel={`${dataEsquerdaStr} — Compromissos do dia`}
            eventos={eventosEsquerda}
            onDuploCliqueEvento={aoDuploCliqueCompromisso}
            dataBrStr={dataEsquerdaStr}
            usuarioAgendaId={usuarioEsquerda}
            onPersistenciaAlterada={() => setAgendaStatusNonce((n) => n + 1)}
            onSalvarCampos={(ev, patch) => {
              salvarCamposEventoAgendaPersistido({
                dataBr: dataEsquerdaStr,
                evento: ev,
                patch,
              });
              setAgendaStatusNonce((n) => n + 1);
            }}
          />
          <ColunaDia
            dataLabel={`${dataDireitaStr} — Próximo dia`}
            eventos={eventosDireita}
            onDuploCliqueEvento={aoDuploCliqueCompromisso}
            dataBrStr={dataDireitaStr}
            usuarioAgendaId={usuarioDireita}
            onPersistenciaAlterada={() => setAgendaStatusNonce((n) => n + 1)}
            onSalvarCampos={(ev, patch) => {
              salvarCamposEventoAgendaPersistido({
                dataBr: dataDireitaStr,
                evento: ev,
                patch,
              });
              setAgendaStatusNonce((n) => n + 1);
            }}
          />
        </div>
      </div>

      {/* Painel direito: Calendário + Usuário + Botões (espelho do esquerdo) */}
      <PainelCalendario
        mesAtual={mesDireita}
        anoAtual={anoDireita}
        setMesAtual={setMesDireita}
        setAnoAtual={setAnoDireita}
        diaSelecionado={diaDireita}
        setDiaSelecionado={setDiaDireita}
        usuarioSelecionado={usuarioDireita}
        setUsuarioSelecionado={setUsuarioDireita}
        nomeGrupo="direita"
        usuariosSistema={usuariosAtivos}
        onAbrirUsuariosSistema={() => navigate('/usuarios')}
      />

      {modalAgendaMensal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agenda-mensal-titulo"
          onClick={() => setModalAgendaMensal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 shrink-0">
              <div>
                <h2 id="agenda-mensal-titulo" className="text-base font-semibold text-slate-800">
                  Agenda completa — {tituloMesRelatorio}
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  Usuário: <span className="font-medium text-slate-800">{nomeUsuarioAgenda}</span>
                  {' · '}
                  {relatorioAgendaMensal.diasComEventos.length} dia(s) com compromisso
                  {' · '}
                  {totalCompromissosMensal} compromisso(s)
                </p>
              </div>
              <button
                type="button"
                className="p-2 rounded text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
                onClick={() => setModalAgendaMensal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0">
              {relatorioAgendaMensal.diasComEventos.length === 0 ? (
                <p className="text-sm text-slate-600 py-6 text-center">
                  Nenhum compromisso neste mês para este usuário.
                </p>
              ) : (
                <div className="space-y-6">
                  {relatorioAgendaMensal.diasComEventos.map(({ dataBr, eventos }) => (
                    <section key={dataBr} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 text-sm font-semibold text-slate-800">
                        {rotuloDataComDiaSemana(dataBr)}
                        <span className="font-normal text-slate-600 ml-2">
                          ({eventos.length} {eventos.length === 1 ? 'compromisso' : 'compromissos'})
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse min-w-[520px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left px-3 py-2 font-medium text-slate-700 w-[88px]">Hora</th>
                              <th className="text-left px-3 py-2 font-medium text-slate-700">Descrição</th>
                              <th className="text-right px-3 py-2 font-medium text-slate-700 w-[72px]">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {eventos.map((ev) => (
                              <tr key={`${dataBr}-${ev.id}`} className="border-b border-slate-100 last:border-0">
                                <td className="px-3 py-2 align-top text-slate-800 whitespace-nowrap">
                                  {ev.hora ? ev.hora : '—'}
                                </td>
                                <td className="px-3 py-2 align-top text-slate-800 whitespace-pre-wrap break-words">
                                  {ev.descricao ? ev.descricao : '—'}
                                </td>
                                <td className="px-3 py-2 align-top text-right text-slate-800">
                                  {normalizarStatusCurtoAgenda(ev.statusCurto) === 'OK' ? 'OK' : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900"
                onClick={() => setModalAgendaMensal(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {eventoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setEventoModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-800">
                Texto completo do compromisso
              </h2>
              <button
                type="button"
                className="p-2 rounded text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
                onClick={() => setEventoModal(null)}
              >
                OK
              </button>
            </div>
            <div className="px-4 py-4 overflow-y-auto">
              <div className="space-y-2">
                {eventoModal.hora ? (
                  <div className="text-sm text-slate-700">
                    <span className="font-medium">Hora:</span> {eventoModal.hora}
                  </div>
                ) : null}
                {eventoModal.descricao ? (
                  <div className={classesTemaDescricaoModal(eventoModal.descricao)}>{eventoModal.descricao}</div>
                ) : null}
                {eventoModal.status ? (
                  <div className="text-sm text-slate-700">
                    <span className="font-medium">Status:</span> {eventoModal.status}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
                onClick={() => setEventoModal(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
