import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { normalizarDataBr } from '../data/processosHistoricoData.js';
import { resolverAliasHojeEmTexto } from '../services/hjDateAliasService.js';
import { getColaboradoresHumanosAtivos } from '../data/agendaPersistenciaData.js';
import {
  salvarAgendamentoLoteLinhas,
  salvarAgendamentoLoteLinhasLocal,
  listarLotesAgenda,
  obterLoteAgenda,
  cancelarLoteAgenda,
} from '../repositories/agendaRepository.js';
import { criarLoteRefAgenda } from '../domain/agendaLoteRef.js';
import { getNomeExibicaoUsuario } from '../data/usuarioDisplayHelpers.js';
import { featureFlags } from '../config/featureFlags.js';
import { useCloseOnEscape } from '../hooks/useCloseOnEscape.js';
import { AgendaLotesPainel } from './AgendaLotesPainel.jsx';
import {
  QTD_LINHAS_AGENDAMENTO_LOTE,
  TIPOS_SEQUENCIA_AGENDA_LOTE,
  ajustarFimDeSemanaParaSegunda,
  aplicarDatasNasLinhas,
  criarLinhasAgendamentoLoteVazias,
  diaSemanaExtensoAgendaLote,
  gerarDatasSequenciaAgendaLote,
  marcarUltimoAgendamentoNasLinhas,
} from '../utils/agendaLoteSequencia.js';

function hojeBr() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function formatarHoraAudienciaInput(valor) {
  const digits = String(valor ?? '').replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length === 3) return `${digits.slice(0, 2)}:${digits.slice(2, 3)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function normalizarHoraAudiencia(valor) {
  const digits = String(valor ?? '').replace(/\D/g, '');
  if (!digits) return '';
  let hhDigits = '';
  let mmDigits = '';
  if (digits.length <= 2) {
    hhDigits = digits.padStart(2, '0').slice(0, 2);
    mmDigits = '00';
  } else if (digits.length === 3) {
    hhDigits = digits.slice(0, 2);
    mmDigits = `${digits.slice(2, 3)}0`;
  } else {
    hhDigits = digits.slice(0, 2);
    mmDigits = digits.slice(2, 4);
  }
  const hh = Number(hhDigits);
  const mm = Number(mmDigits);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '';
  if (hh < 0 || hh > 23) return '';
  if (mm < 0 || mm > 59) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * @param {{
 *   aberto: boolean,
 *   onFechar: () => void,
 *   valoresIniciais?: { texto?: string, dataBr?: string, hora?: string },
 *   processo?: { codigoCliente?: string|number, numeroInterno?: string|number, processoId?: string|number, numeroProcessoNovo?: string },
 *   loteRefEdicao?: string|null,
 *   origemApi?: string,
 *   onSalvo?: (resultado: object) => void,
 *   zIndexClass?: string,
 * }} props
 */
export function ModalAgendamentoLoteAgenda({
  aberto,
  onFechar,
  valoresIniciais = null,
  processo = null,
  loteRefEdicao = null,
  origemApi = 'agenda-em-lote',
  onSalvo = null,
  zIndexClass = 'z-50',
}) {
  const colaboradores = useMemo(() => getColaboradoresHumanosAtivos() || [], [aberto]);
  const [linhas, setLinhas] = useState(() => criarLinhasAgendamentoLoteVazias());
  const [textoBase, setTextoBase] = useState('');
  const [horaPadrao, setHoraPadrao] = useState('');
  const [usuariosSelecionados, setUsuariosSelecionados] = useState(() => new Set());
  const [modalSequenciaAberto, setModalSequenciaAberto] = useState(false);
  const [tipoSequencia, setTipoSequencia] = useState('diaria');
  const [info, setInfo] = useState('');
  const [loteRefAtual, setLoteRefAtual] = useState('');
  const [lotesSalvos, setLotesSalvos] = useState([]);
  const [carregandoLote, setCarregandoLote] = useState(false);

  const iniciarFormularioNovo = useCallback(() => {
    const dataInicial = ajustarFimDeSemanaParaSegunda(normalizarDataBr(valoresIniciais?.dataBr) || hojeBr());
    const horaInicial = normalizarHoraAudiencia(valoresIniciais?.hora) || '';
    const textoInicial = String(valoresIniciais?.texto ?? '').trim();
    const linhasIniciais = criarLinhasAgendamentoLoteVazias();
    linhasIniciais[0] = { dataBr: dataInicial, hora: horaInicial, informacao: textoInicial };
    setLoteRefAtual('');
    setLinhas(linhasIniciais);
    setTextoBase(textoInicial);
    setHoraPadrao(horaInicial);
    setUsuariosSelecionados(new Set((getColaboradoresHumanosAtivos() || []).map((u) => String(u.id))));
    setTipoSequencia('diaria');
    setModalSequenciaAberto(false);
    setInfo('');
  }, [valoresIniciais]);

  const carregarLoteNoFormulario = useCallback(async (loteRef) => {
    const id = String(loteRef ?? '').trim();
    if (!id) return;
    setCarregandoLote(true);
    try {
      const det = await obterLoteAgenda(id);
      if (!det) {
        setInfo('Lote não encontrado.');
        return;
      }
      const linhasApi = Array.isArray(det.linhas) ? det.linhas : [];
      const base = criarLinhasAgendamentoLoteVazias();
      linhasApi.forEach((l, idx) => {
        if (idx < QTD_LINHAS_AGENDAMENTO_LOTE) {
          base[idx] = {
            dataBr: String(l?.dataBr ?? ''),
            hora: String(l?.hora ?? '').slice(0, 5),
            informacao: String(l?.informacao ?? ''),
          };
        }
      });
      setLoteRefAtual(id);
      setLinhas(marcarUltimoAgendamentoNasLinhas(base));
      setTextoBase(String(det.textoBase ?? '').trim());
      setHoraPadrao(String(det.horaPadrao ?? '').trim());
      const ids = (Array.isArray(det.usuarioIds) ? det.usuarioIds : []).map((x) => String(x)).filter(Boolean);
      setUsuariosSelecionados(new Set(ids.length ? ids : (getColaboradoresHumanosAtivos() || []).map((u) => String(u.id))));
      setInfo(`Lote carregado para edição (${linhasApi.length} data(s)).`);
    } finally {
      setCarregandoLote(false);
    }
  }, []);

  useCloseOnEscape(aberto && !modalSequenciaAberto, onFechar);
  useCloseOnEscape(modalSequenciaAberto, () => setModalSequenciaAberto(false));

  useEffect(() => {
    if (!aberto) return;
    void (async () => {
      const lista = await listarLotesAgenda();
      setLotesSalvos(lista);
      const editar = String(loteRefEdicao ?? '').trim();
      if (editar) {
        await carregarLoteNoFormulario(editar);
      } else {
        iniciarFormularioNovo();
      }
    })();
  }, [aberto, loteRefEdicao, carregarLoteNoFormulario, iniciarFormularioNovo]);

  const aplicarSequencia = useCallback(() => {
    const dataBase =
      normalizarDataBr(linhas[0]?.dataBr) ||
      normalizarDataBr(valoresIniciais?.dataBr) ||
      hojeBr();
    const datas = gerarDatasSequenciaAgendaLote({ dataBaseBr: dataBase, tipoSequencia });
    const novas = aplicarDatasNasLinhas(linhas, datas, {
      hora: horaPadrao,
      textoBase,
    });
    const horaRef = String(novas[0]?.hora ?? '').trim() || horaPadrao;
    const textoRef = String(novas[0]?.informacao ?? '')
      .trim()
      .replace(/\s*—\s*Último agendamento\s*$/i, '')
      .trim();
    if (horaRef) setHoraPadrao(horaRef);
    if (textoRef) setTextoBase(textoRef);
    setLinhas(marcarUltimoAgendamentoNasLinhas(novas));
    setModalSequenciaAberto(false);
    setInfo('');
  }, [linhas, horaPadrao, textoBase, tipoSequencia, valoresIniciais?.dataBr]);

  const atualizarLinha = useCallback((idx, patch) => {
    setLinhas((prev) => {
      const next = prev.map((l, i) => (i === idx ? { ...l, ...patch } : l));
      return marcarUltimoAgendamentoNasLinhas(next);
    });
  }, []);

  const normalizarDataLinha = useCallback(
    (idx) => {
      const bruta = String(linhas[idx]?.dataBr ?? '').trim();
      if (!bruta) return;
      const norm = normalizarDataBr(bruta);
      if (!norm || !/^\d{2}\/\d{2}\/\d{4}$/.test(norm)) return;
      atualizarLinha(idx, { dataBr: ajustarFimDeSemanaParaSegunda(norm) });
    },
    [atualizarLinha, linhas]
  );

  const selecionarTodosUsuarios = useCallback(
    (marcar) => {
      if (marcar) {
        setUsuariosSelecionados(new Set(colaboradores.map((u) => String(u.id))));
      } else {
        setUsuariosSelecionados(new Set());
      }
    },
    [colaboradores]
  );

  const toggleUsuario = useCallback((id) => {
    setUsuariosSelecionados((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const cancelarLotePorRef = useCallback(
    async (loteRef) => {
      const id = String(loteRef ?? '').trim();
      if (!id) return;
      const lote = lotesSalvos.find((x) => String(x.loteRef) === id);
      const titulo = String(lote?.textoBase ?? '').trim() || 'este lote';
      if (
        !window.confirm(
          `Cancelar os compromissos futuros do lote «${titulo}»?\n\nAgendamentos com data passada serão mantidos.`
        )
      ) {
        return;
      }
      const r = await cancelarLoteAgenda(id);
      if (!r?.ok) {
        setInfo('Não foi possível cancelar o lote.');
        return;
      }
      setInfo(
        `${r.removidos ?? 0} compromisso(s) futuro(s) removido(s). Agendamentos passados foram mantidos.`
      );
      setLotesSalvos(await listarLotesAgenda());
      if (String(loteRefAtual ?? '') === id) {
        const det = await obterLoteAgenda(id);
        if (!det) iniciarFormularioNovo();
        else await carregarLoteNoFormulario(id);
      }
      onSalvo?.({ ok: true, cancelado: true, loteRef: id, removidos: r.removidos ?? 0 });
    },
    [carregarLoteNoFormulario, iniciarFormularioNovo, loteRefAtual, lotesSalvos, onSalvo]
  );

  const cancelarLoteAtual = useCallback(async () => {
    const id = String(loteRefAtual ?? '').trim();
    if (!id) {
      setInfo('Nenhum lote selecionado para cancelar.');
      return;
    }
    await cancelarLotePorRef(id);
  }, [cancelarLotePorRef, loteRefAtual]);

  const salvar = useCallback(async () => {
    const linhasValidas = linhas
      .map((l) => ({
        dataBr: normalizarDataBr(l.dataBr),
        hora: normalizarHoraAudiencia(l.hora),
        informacao: String(l.informacao ?? '').trim(),
      }))
      .filter((l) => l.dataBr && l.informacao);

    if (linhasValidas.length === 0) {
      setInfo('Informe ao menos uma linha com data e informação.');
      return;
    }

    const idsSelecionados = Array.from(usuariosSelecionados);
    if (idsSelecionados.length === 0) {
      setInfo('Selecione ao menos um usuário em «Agendar em:».');
      return;
    }

    const temProcesso =
      processo?.codigoCliente != null &&
      processo?.numeroInterno != null &&
      String(processo.codigoCliente).trim() !== '' &&
      String(processo.numeroInterno).trim() !== '';

    const loteId = String(loteRefAtual ?? '').trim() || criarLoteRefAgenda();
    const substituir = !!String(loteRefAtual ?? '').trim();

    if (featureFlags.useApiAgenda) {
      try {
        const resultado = await salvarAgendamentoLoteLinhas({
          linhas: linhasValidas,
          usuarioIds: idsSelecionados,
          codigoCliente: temProcesso ? processo.codigoCliente : null,
          numeroInterno: temProcesso ? processo.numeroInterno : null,
          loteRef: loteId,
          textoBase,
          horaPadrao,
          substituirLoteExistente: substituir,
        });
        if (!resultado?.ok) {
          if (resultado?.reason === 'sem-linhas-futuras') {
            setInfo('Não há datas futuras para alterar. Agendamentos passados não são modificados.');
            return;
          }
          setInfo('Não foi possível salvar o agendamento na API.');
          return;
        }
        setInfo(
          `Agendamento salvo: ${resultado.criados} compromisso(s), ${resultado.ocorrencias} data(s), ${resultado.usuarios} usuário(s).`
        );
        onSalvo?.(resultado);
      } catch {
        setInfo('Erro ao salvar agendamento na API.');
        return;
      }
      window.setTimeout(onFechar, 700);
      return;
    }

    const usuariosAlvo = colaboradores.filter((u) => usuariosSelecionados.has(String(u.id)));
    if (usuariosAlvo.length === 0) {
      setInfo('Selecione usuários válidos para agendar.');
      return;
    }

    const resultado = await salvarAgendamentoLoteLinhasLocal({
      linhas: linhasValidas,
      usuarios: usuariosAlvo,
      processoId: temProcesso ? String(processo?.processoId ?? processo?.numeroInterno ?? '') : '',
      clienteId: temProcesso ? String(processo?.codigoCliente ?? '') : '',
      numeroProcessoNovo: temProcesso ? String(processo?.numeroProcessoNovo ?? '') : '',
      loteRef: loteId,
      textoBase,
      horaPadrao,
      substituirLoteExistente: substituir,
    });

    if (!resultado?.ok) {
      if (resultado?.reason === 'sem-linhas-futuras') {
        setInfo('Não há datas futuras para alterar. Agendamentos passados não são modificados.');
        return;
      }
      setInfo('Não foi possível salvar o agendamento em lote.');
      return;
    }

    setInfo(
      `Agendamento ${substituir ? 'atualizado' : 'criado'}: ${resultado.inseridos} item(ns), ${resultado.ocorrencias} data(s), ${resultado.usuarios} usuário(s).`
    );
    onSalvo?.(resultado);
    window.setTimeout(onFechar, 700);
  }, [colaboradores, horaPadrao, linhas, loteRefAtual, onFechar, onSalvo, processo, textoBase, usuariosSelecionados]);

  if (!aberto) return null;

  const zSequencia = zIndexClass === 'z-[70]' ? 'z-[80]' : 'z-[60]';

  return (
    <>
      <div
        className={`fixed inset-0 ${zIndexClass} flex items-stretch justify-center bg-black/50 p-0 md:items-center md:p-4`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-agenda-lote-titulo"
        onClick={onFechar}
      >
        <div
          className="flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border border-slate-200 bg-[#ece9d8] shadow-xl md:h-auto md:max-h-[92vh] md:max-w-5xl md:rounded-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-400 bg-gradient-to-r from-[#0054e3] to-[#3a6ea5] px-3 py-2 text-white md:px-4">
            <button
              type="button"
              className="flex min-h-10 min-w-10 items-center justify-center rounded border border-white/30 bg-white/10 hover:bg-white/20 md:hidden"
              aria-label="Voltar"
              onClick={onFechar}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <h2 id="modal-agenda-lote-titulo" className="min-w-0 flex-1 text-sm font-bold tracking-wide">
              {loteRefAtual ? 'Editar lote' : 'Agendar em Lote'}
              {carregandoLote ? '…' : ''}
            </h2>
            <button
              type="button"
              className="flex min-h-10 min-w-10 items-center justify-center rounded border border-white/30 bg-white/10 hover:bg-white/20"
              aria-label="Fechar"
              onClick={onFechar}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:flex-row">
            <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded border border-slate-400 bg-[#f5f5f5]">
              <div className="border-b border-slate-400 bg-[#dcdcdc] px-2 py-1 text-xs font-semibold text-slate-800">
                Informações
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,0.55fr)_minmax(0,1.4fr)] gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  <span>Data</span>
                  <span className="w-[7.5rem] text-center">Dia</span>
                  <span>Hora</span>
                  <span>Informação</span>
                </div>
                <div className="space-y-1">
                  {linhas.map((linha, idx) => (
                    <div
                      key={`lote-linha-${idx}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,0.55fr)_minmax(0,1.4fr)] items-center gap-1"
                    >
                      <input
                        type="text"
                        value={linha.dataBr}
                        onChange={(e) => {
                          const v = e.target.value;
                          atualizarLinha(idx, { dataBr: resolverAliasHojeEmTexto(v, 'br') ?? v });
                        }}
                        onBlur={() => normalizarDataLinha(idx)}
                        placeholder="dd/mm/aaaa"
                        className="w-full rounded border border-slate-400 bg-white px-1.5 py-1 text-xs"
                        aria-label={`Data linha ${idx + 1}`}
                      />
                      <span
                        className="w-[7.5rem] truncate text-center text-[11px] text-slate-700"
                        title={diaSemanaExtensoAgendaLote(linha.dataBr)}
                      >
                        {diaSemanaExtensoAgendaLote(linha.dataBr)}
                      </span>
                      <input
                        type="text"
                        value={linha.hora}
                        onChange={(e) => atualizarLinha(idx, { hora: formatarHoraAudienciaInput(e.target.value) })}
                        onBlur={() => {
                          const norm = normalizarHoraAudiencia(linha.hora);
                          if (norm) atualizarLinha(idx, { hora: norm });
                        }}
                        placeholder="hh:mm"
                        className="w-full rounded border border-slate-400 bg-white px-1.5 py-1 text-xs"
                        aria-label={`Hora linha ${idx + 1}`}
                      />
                      <input
                        type="text"
                        value={linha.informacao}
                        onChange={(e) => atualizarLinha(idx, { informacao: e.target.value })}
                        className="w-full rounded border border-slate-400 bg-white px-1.5 py-1 text-xs"
                        aria-label={`Informação linha ${idx + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="flex w-full shrink-0 flex-col gap-3 md:w-56">
              <AgendaLotesPainel
                compacto
                lotes={lotesSalvos}
                loteAtivo={loteRefAtual}
                onNovo={iniciarFormularioNovo}
                onEditar={(ref) => void carregarLoteNoFormulario(ref)}
                onCancelar={(ref) => void cancelarLotePorRef(ref)}
              />

              <section className="rounded border border-slate-400 bg-[#f5f5f5]">
                <div className="border-b border-slate-400 bg-[#dcdcdc] px-2 py-1 text-xs font-semibold text-slate-800">
                  Usuários
                </div>
                <div className="space-y-2 p-2">
                  <p className="text-[11px] font-semibold text-slate-700">Agendar em:</p>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {colaboradores.map((u) => {
                      const id = String(u.id);
                      const nome = getNomeExibicaoUsuario(u) || id;
                      return (
                        <label key={id} className="flex cursor-pointer items-center gap-2 text-xs text-slate-800">
                          <input
                            type="checkbox"
                            checked={usuariosSelecionados.has(id)}
                            onChange={() => toggleUsuario(id)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="truncate">{nome}</span>
                        </label>
                      );
                    })}
                    {colaboradores.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhum colaborador ativo.</p>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="rounded border border-slate-400 bg-[#f5f5f5]">
                <div className="border-b border-slate-400 bg-[#dcdcdc] px-2 py-1 text-xs font-semibold text-slate-800">
                  Opções
                </div>
                <div className="space-y-2 p-2">
                  <div className="flex flex-wrap gap-2">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                      <input
                        type="radio"
                        name="agenda-lote-usuarios-todos"
                        checked={usuariosSelecionados.size === colaboradores.length && colaboradores.length > 0}
                        onChange={() => selecionarTodosUsuarios(true)}
                      />
                      Todos
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                      <input
                        type="radio"
                        name="agenda-lote-usuarios-todos"
                        checked={usuariosSelecionados.size === 0}
                        onChange={() => selecionarTodosUsuarios(false)}
                      />
                      Nenhum
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalSequenciaAberto(true)}
                    className="w-full rounded border border-slate-500 bg-[#e8e8e8] px-2 py-1.5 text-xs font-medium text-slate-800 hover:bg-white"
                  >
                    Sequência…
                  </button>
                </div>
              </section>

              <div className="rounded border border-slate-300 bg-white/80 p-2 text-[10px] leading-relaxed text-slate-600">
                <p>
                  Use <strong>Sequência</strong> para preencher as {QTD_LINHAS_AGENDAMENTO_LOTE} datas (diária, semanal,
                  mensal ou anual). Fins de semana vão para a segunda-feira seguinte. Ajuste manualmente se precisar.
                </p>
              </div>
            </aside>
          </div>

          <div className="shrink-0 border-t border-slate-400 bg-[#ece9d8] px-3 py-2">
            <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">Texto base (informação)</label>
                <input
                  type="text"
                  value={textoBase}
                  onChange={(e) => setTextoBase(e.target.value)}
                  className="w-full rounded border border-slate-400 bg-white px-2 py-1 text-xs"
                  placeholder="Texto aplicado ao gerar sequência…"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-700">Hora padrão</label>
                <input
                  type="text"
                  value={horaPadrao}
                  onChange={(e) => setHoraPadrao(formatarHoraAudienciaInput(e.target.value))}
                  onBlur={() => setHoraPadrao(normalizarHoraAudiencia(horaPadrao) || '')}
                  placeholder="hh:mm"
                  className="w-full rounded border border-slate-400 bg-white px-2 py-1 text-xs"
                />
              </div>
            </div>
            {info ? (
              <div className="mb-2 rounded border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs text-blue-800">
                {info}
              </div>
            ) : null}
            <div className="flex justify-center gap-2">
              {loteRefAtual ? (
                <button
                  type="button"
                  onClick={() => void cancelarLoteAtual()}
                  className="min-h-9 rounded border border-rose-500 bg-white px-4 py-1.5 text-sm text-rose-700 hover:bg-rose-50"
                >
                  Cancelar lote
                </button>
              ) : null}
              <button
                type="button"
                onClick={onFechar}
                className="min-h-9 rounded border border-slate-500 bg-[#e8e8e8] px-6 py-1.5 text-sm text-slate-800 hover:bg-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void salvar()}
                className="min-h-9 min-w-[120px] rounded border border-slate-600 bg-[#e8e8e8] px-8 py-1.5 text-sm font-semibold text-slate-900 hover:bg-white"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalSequenciaAberto ? (
        <div
          className={`fixed inset-0 ${zSequencia} flex items-center justify-center bg-black/40 p-4`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-sequencia-lote-titulo"
          onClick={() => setModalSequenciaAberto(false)}
        >
          <div
            className="w-full max-w-xs rounded border border-slate-400 bg-[#ece9d8] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              id="modal-sequencia-lote-titulo"
              className="border-b border-slate-400 bg-[#dcdcdc] px-3 py-2 text-xs font-semibold text-slate-800"
            >
              Selecione o Tipo de Sequência…
            </div>
            <div className="space-y-2 p-4">
              {TIPOS_SEQUENCIA_AGENDA_LOTE.map((tipo) => (
                <label key={tipo.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                  <input
                    type="radio"
                    name="tipo-sequencia-lote"
                    value={tipo.id}
                    checked={tipoSequencia === tipo.id}
                    onChange={() => setTipoSequencia(tipo.id)}
                  />
                  {tipo.label}
                </label>
              ))}
            </div>
            <div className="flex justify-center border-t border-slate-400 px-3 py-3">
              <button
                type="button"
                onClick={aplicarSequencia}
                className="min-w-[100px] rounded border border-slate-600 bg-[#e8e8e8] px-6 py-1.5 text-sm font-semibold hover:bg-white"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
