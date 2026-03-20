import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
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
} from '../data/agendaPersistenciaData';

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

function ColunaDia({ dataLabel, eventos, vazias = 8, onDuploCliqueEvento }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col border border-gray-300 rounded bg-white overflow-hidden">
      <div className="px-2 py-1.5 bg-gray-100 border-b border-gray-300 text-sm font-medium text-gray-800">
        {dataLabel}
      </div>
      <div className="flex-1 overflow-auto p-1">
        <table className="w-full table-fixed border-collapse">
          <tbody>
            {eventos.map((ev) => (
              <tr
                key={ev.id}
                className={`border-b border-gray-100 min-h-[34px] overflow-hidden ${
                  ev.destaque ? 'bg-amber-100' : ''
                }`}
                onDoubleClick={() => onDuploCliqueEvento?.(ev)}
              >
                <td className="w-[90px] px-2 py-1 align-middle text-[0.60rem]">
                  <span className="block truncate w-full text-gray-600 font-medium whitespace-nowrap">
                    {ev.hora ? ev.hora : ''}
                  </span>
                </td>
                <td className="px-2 py-1 align-middle text-[0.60rem]">
                  <span className="text-gray-800 truncate block w-full" title={ev.descricao}>
                    {ev.descricao}
                  </span>
                </td>
                <td className="w-[140px] px-2 py-1 align-middle text-right">
                  <span
                    className="text-gray-700 text-[0.54rem] font-medium truncate block w-full"
                    title={ev.status ?? (ev.destaque ? 'Destaque' : '')}
                  >
                    {ev.status ?? (ev.destaque ? 'Destaque' : '')}
                  </span>
                </td>
              </tr>
            ))}
            {Array.from({ length: vazias }).map((_, i) => (
              <tr key={`vazio-${i}`} className="border-b border-gray-100 min-h-[34px] overflow-hidden">
                <td className="w-[90px] px-2 py-1 align-middle text-[0.60rem]">
                  <span className="block truncate w-full text-transparent">__</span>
                </td>
                <td className="px-2 py-1 align-middle text-[0.60rem]">
                  <span className="block w-full text-transparent">__</span>
                </td>
                <td className="w-[140px] px-2 py-1 align-middle text-right">
                  <span className="block w-full text-transparent">__</span>
                </td>
              </tr>
            ))}
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
  const hoje = agendaCalendarioMarco2026.hoje ?? 10;
  const primeiroDiaSemana = 0;
  const dias = Array.from({ length: 31 }, (_, i) => i + 1);
  const nomeMesAtual = MESES[mesAtual - 1] ?? '';
  const dataSelecionadaStr = dataStr(diaSelecionado, mesAtual, anoAtual);

  const [textoDataCompleta, setTextoDataCompleta] = useState(dataSelecionadaStr);

  useEffect(() => {
    setTextoDataCompleta(dataSelecionadaStr);
  }, [dataSelecionadaStr]);

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
                  : d === hoje
                    ? 'bg-blue-400 text-white'
                    : 'hover:bg-gray-200 text-gray-800'
              }`}
            >
              {String(d).padStart(2, '0')}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Hoje: {dataStr(hoje, mesAtual, anoAtual)}
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
        <div className="text-sm font-medium text-gray-700 mb-1">Usuário:</div>
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
        >
          Opções
        </button>
      </div>
    </aside>
  );
}

export function Agenda() {
  const location = useLocation();
  const [usuarioEsquerda, setUsuarioEsquerda] = useState('itamar');
  const [usuarioDireita, setUsuarioDireita] = useState('itamar');
  const [mesEsquerda, setMesEsquerda] = useState(3);
  const [anoEsquerda, setAnoEsquerda] = useState(2026);
  const [diaEsquerda, setDiaEsquerda] = useState(agendaCalendarioMarco2026.diaSelecionado ?? 10);
  const [mesDireita, setMesDireita] = useState(3);
  const [anoDireita, setAnoDireita] = useState(2026);
  const [diaDireita, setDiaDireita] = useState(11);
  const [eventoModal, setEventoModal] = useState(null);
  const [usuariosAtivos, setUsuariosAtivosState] = useState(() => getUsuariosAtivos());
  const [modalUsuariosSistemaAberto, setModalUsuariosSistemaAberto] = useState(false);
  const [slotsCustom, setSlotsCustom] = useState(['', '']);

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

  function normalizarNomeParaId(nome) {
    return String(nome || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
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

  const eventosPersistidosEsquerda = useMemo(
    () => getEventosAgendaPersistidosPorData(dataEsquerdaStr),
    [dataEsquerdaStr]
  );
  const eventosPersistidosDireita = useMemo(
    () => getEventosAgendaPersistidosPorData(dataDireitaStr),
    [dataDireitaStr]
  );

  const eventosEsquerda = useMemo(
    () => [
      ...(dataEsquerdaStr === agendaDataEsquerda ? agendaEventosTerça : []),
      ...eventosPersistidosEsquerda,
    ],
    [dataEsquerdaStr, eventosPersistidosEsquerda]
  );
  const eventosDireita = useMemo(
    () => [
      ...(dataDireitaStr === agendaDataDireita ? agendaEventosQuarta : []),
      ...eventosPersistidosDireita,
    ],
    [dataDireitaStr, eventosPersistidosDireita]
  );

  return (
    <div className="flex flex-1 min-h-0 p-4 gap-4 overflow-hidden">
      {/*
        Modal "Usuários do Sistema"
        - Objetivo: configurar quais usuários do agenda estão ativos (para o agendamento "para todos").
        - Layout: semelhante ao print (inputs + botões Incluir/Excluir e botão OK).
      */}
      {modalUsuariosSistemaAberto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setModalUsuariosSistemaAberto(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-semibold text-slate-800">Usuários do Sistema</h2>
              <button
                type="button"
                className="p-2 rounded text-slate-600 hover:bg-slate-100"
                onClick={() => setModalUsuariosSistemaAberto(false)}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {(() => {
                const idsAtivos = new Set((usuariosAtivos || []).map((u) => u.id));
                const primeira = agendaUsuarios?.[0];
                const resto = Array.isArray(agendaUsuarios) ? agendaUsuarios.slice(1) : [];

                return (
                  <div className="space-y-3">
                    {primeira ? (
                      <div className="grid grid-cols-1 gap-2">
                        <input
                          type="text"
                          value={primeira.nome}
                          readOnly
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-slate-50"
                        />
                      </div>
                    ) : null}

                    {resto.map((u) => {
                      const ativo = idsAtivos.has(u.id);
                      return (
                        <div key={u.id} className="grid grid-cols-[1fr_120px_120px] gap-3 items-center">
                          <input
                            type="text"
                            value={u.nome}
                            readOnly
                            className="px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => incluirUsuario(u)}
                            disabled={ativo}
                            className="px-3 py-2 rounded border border-slate-300 bg-white text-sm hover:bg-slate-50 disabled:opacity-50"
                          >
                            Incluir
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirUsuario(u.id)}
                            disabled={!ativo}
                            className="px-3 py-2 rounded border border-slate-300 bg-white text-sm hover:bg-slate-50 disabled:opacity-50"
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
                        <div key={`custom-${idx}`} className="grid grid-cols-[1fr_120px_120px] gap-3 items-center">
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => {
                              const next = [...slotsCustom];
                              next[idx] = e.target.value;
                              setSlotsCustom(next);
                            }}
                            className="px-3 py-2 border border-slate-300 rounded text-sm"
                            placeholder="(vazio)"
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
                            className="px-3 py-2 rounded border border-slate-300 bg-white text-sm hover:bg-slate-50 disabled:opacity-50"
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
                            className="px-3 py-2 rounded border border-slate-300 bg-white text-sm hover:bg-slate-50 disabled:opacity-50"
                          >
                            Excluir
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="px-4 py-3 border-t border-slate-200 flex justify-center bg-slate-50">
              <button
                type="button"
                onClick={() => setModalUsuariosSistemaAberto(false)}
                className="px-12 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

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
        onAbrirUsuariosSistema={() => setModalUsuariosSistemaAberto(true)}
      />

      {/* Área central: duas colunas de compromissos (simétricas) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
        <h1 className="text-xl font-semibold text-gray-800 text-center py-2 border-b border-gray-200">
          Agenda
        </h1>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <ColunaDia
            dataLabel={`${dataEsquerdaStr} — Compromissos do dia`}
            eventos={eventosEsquerda}
            vazias={12}
            onDuploCliqueEvento={(ev) => setEventoModal(ev)}
          />
          <ColunaDia
            dataLabel={`${dataDireitaStr} — Próximo dia`}
            eventos={eventosDireita}
            vazias={12}
            onDuploCliqueEvento={(ev) => setEventoModal(ev)}
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
        onAbrirUsuariosSistema={() => setModalUsuariosSistemaAberto(true)}
      />

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
                  <div className="text-sm text-slate-800 whitespace-pre-wrap">
                    {eventoModal.descricao}
                  </div>
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
