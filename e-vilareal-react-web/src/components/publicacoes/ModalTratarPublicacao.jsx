import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Loader2, Sparkles, X } from 'lucide-react';
import { featureFlags } from '../../config/featureFlags.js';
import { normalizarDataBr } from '../../data/processosHistoricoData.js';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';
import {
  buscarSugestaoPrazoPublicacao,
  tratarPublicacao,
} from '../../repositories/publicacoesRepository.js';

const TIPOS = [
  {
    value: 'INFORMATIVO',
    label: 'Apenas informa um andamento',
    descricao: 'Registra o tratamento sem prazo nem mudança de fase.',
  },
  {
    value: 'TERCEIRO',
    label: 'Obrigação de terceiro — acompanhar',
    descricao: 'Acompanhar prazo de terceiro (ex.: perito, réu).',
  },
  {
    value: 'CUMPRIR_AGORA',
    label: 'Cumprir agora — petição aguardando protocolo',
    descricao: 'Move o processo para fase de protocolo/movimentação.',
  },
  {
    value: 'CUMPRIR_DEPOIS',
    label: 'Cumprir depois — agendar prazo',
    descricao: 'Agenda prazo fatal e lembrete na agenda.',
  },
];

function mascararDigitosDataBr(valor) {
  const digits = String(valor ?? '').replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

function dataBrValida(valor) {
  const norm = normalizarDataBr(valor);
  return /^\d{2}\/\d{2}\/\d{4}$/.test(norm);
}

function textoTeorPublicacao(row) {
  const teor = String(row?.teorIntegral || row?.teor || '').trim();
  if (teor) return teor;
  return String(row?.resumoPublicacao || '').trim();
}

function numeroCnjLinha(row) {
  return String(row?.processoCnjNormalizado || row?.numero_processo_cnj || row?.numeroProcessoEncontrado || '').trim();
}

function nomeClienteLinha(row) {
  return String(row?.cliente || row?.titularNome || '').trim();
}

function montarResumoDicaJulia(dica, sugestao) {
  const partes = [];
  const acao = String(dica?.acaoSugerida || '').trim();
  if (acao) {
    const curta = acao.split(/[.—]/)[0].trim().toLowerCase();
    partes.push(curta || acao.toLowerCase());
  }
  const fatal = String(dica?.prazoDataReal || sugestao?.dataFatal || '').trim();
  if (fatal) partes.push(`fatal ${fatal}`);
  const prov = String(dica?.providenciaCliente || '').trim();
  if (prov) partes.push(prov.toLowerCase());
  return partes.join(' · ');
}

function inferirTipoDaDicaJulia(dica) {
  const texto = [
    dica?.acaoSugerida,
    dica?.providenciaCliente,
    dica?.classificacao,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (texto.includes('protocolo') || texto.includes('peti')) return 'CUMPRIR_AGORA';
  if (texto.includes('terceiro') || texto.includes('acompanhar')) return 'TERCEIRO';
  if (texto.includes('inform') && !dica?.prazoDataReal) return 'INFORMATIVO';
  return 'CUMPRIR_DEPOIS';
}

/**
 * Modal reutilizável para tratar publicação via POST /api/publicacoes/{id}/tratar.
 * @param {object|null} publicacao — linha da listagem (row)
 * @param {() => void} onClose
 * @param {(result: object, publicacao: object) => void} [onTratado]
 */
export function ModalTratarPublicacao({ publicacao, onClose, onTratado }) {
  const aberto = publicacao != null;
  const pubId = publicacao?._apiId ?? publicacao?.id;

  const [tipo, setTipo] = useState('CUMPRIR_DEPOIS');
  const [dataFatal, setDataFatal] = useState('');
  const [observacaoFase, setObservacaoFase] = useState('');
  const [contatarCliente, setContatarCliente] = useState(false);
  const [sugestao, setSugestao] = useState(null);
  const [carregandoSugestao, setCarregandoSugestao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useCloseOnEscape(aberto, onClose, { enabled: !salvando });

  useEffect(() => {
    if (!aberto || !pubId) return undefined;
    setTipo('CUMPRIR_DEPOIS');
    setDataFatal('');
    setObservacaoFase('');
    setContatarCliente(false);
    setSugestao(null);
    setErro('');
    if (!featureFlags.useApiPublicacoes) {
      setErro('Ative VITE_USE_API_PUBLICACOES para tratar publicações na API.');
      return undefined;
    }
    let cancelado = false;
    setCarregandoSugestao(true);
    void buscarSugestaoPrazoPublicacao(pubId)
      .then((s) => {
        if (cancelado) return;
        setSugestao(s);
        if (s?.dataFatal) setDataFatal(s.dataFatal);
      })
      .catch((e) => {
        if (cancelado) return;
        setErro(e?.message || 'Não foi possível carregar a sugestão de prazo.');
      })
      .finally(() => {
        if (!cancelado) setCarregandoSugestao(false);
      });
    return () => {
      cancelado = true;
    };
  }, [aberto, pubId]);

  const exigePrazo = tipo === 'TERCEIRO' || tipo === 'CUMPRIR_DEPOIS';
  const exigeObservacao = exigePrazo;
  const mostraContatarCliente = tipo === 'CUMPRIR_DEPOIS';
  const labelPrazo = tipo === 'TERCEIRO' ? 'Prazo (verificar autos)' : 'Prazo fatal';

  const podeConfirmar = useMemo(() => {
    if (salvando || carregandoSugestao || !featureFlags.useApiPublicacoes) return false;
    if (exigePrazo && !dataBrValida(dataFatal)) return false;
    if (exigeObservacao && !String(observacaoFase ?? '').trim()) return false;
    return true;
  }, [salvando, carregandoSugestao, exigePrazo, exigeObservacao, dataFatal, observacaoFase]);

  const aplicarDicaJulia = useCallback(() => {
    const dica = sugestao?.dicaJulia;
    if (!dica) return;
    setTipo(inferirTipoDaDicaJulia(dica));
    const fatal = String(dica.prazoDataReal || sugestao?.dataFatal || '').trim();
    if (fatal) setDataFatal(fatal);
    const obs = String(dica.providenciaCliente || dica.acaoSugerida || dica.resumo || '').trim();
    if (obs) setObservacaoFase(obs);
    const prov = String(dica.providenciaCliente || '').toLowerCase();
    if (prov.includes('cliente') || prov.includes('informar')) {
      setContatarCliente(true);
    }
  }, [sugestao]);

  async function handleConfirmar(e) {
    e.preventDefault();
    if (!podeConfirmar || !pubId) return;
    setSalvando(true);
    setErro('');
    try {
      const result = await tratarPublicacao(pubId, {
        tipo,
        dataFatal: exigePrazo ? normalizarDataBr(dataFatal) : null,
        observacaoFase: String(observacaoFase ?? '').trim() || null,
        contatarCliente: mostraContatarCliente && contatarCliente ? true : null,
      });
      onTratado?.(result ?? {}, publicacao);
      onClose();
    } catch (err) {
      setErro(err?.message || 'Não foi possível tratar a publicação.');
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return null;

  const cnj = numeroCnjLinha(publicacao);
  const cliente = nomeClienteLinha(publicacao);
  const teor = textoTeorPublicacao(publicacao);
  const dicaJulia = sugestao?.dicaJulia;
  const resumoJulia = dicaJulia ? montarResumoDicaJulia(dicaJulia, sugestao) : '';
  const explicacaoPrazo = String(sugestao?.explicacao || '').trim();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-tratar-publicacao-titulo"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-xl shrink-0">
          <div className="min-w-0">
            <h2 id="modal-tratar-publicacao-titulo" className="text-lg font-semibold text-slate-900">
              Tratar publicação
            </h2>
            <p className="text-sm text-slate-600 truncate mt-0.5">
              {cnj || '—'}
              {cliente ? ` · ${cliente}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="p-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirmar} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Teor da publicação
              </label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 max-h-36 overflow-y-auto px-3 py-2.5 text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                {teor || '—'}
              </div>
            </div>

            {carregandoSugestao && (
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                Carregando sugestão de prazo…
              </div>
            )}

            {dicaJulia && resumoJulia && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
                <p className="text-sm text-sky-950 flex items-start gap-2 min-w-0">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-sky-700" aria-hidden />
                  <span>
                    <span className="font-medium">Júlia sugeriu:</span> {resumoJulia}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={aplicarDicaJulia}
                  className="shrink-0 px-3 py-1 rounded border border-sky-300 bg-white text-xs font-medium text-sky-800 hover:bg-sky-100"
                >
                  Usar
                </button>
              </div>
            )}

            <fieldset>
              <legend className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                O que esta publicação exige?
              </legend>
              <div className="space-y-2">
                {TIPOS.map((op) => {
                  const sel = tipo === op.value;
                  return (
                    <label
                      key={op.value}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                        sel
                          ? 'border-sky-400 bg-sky-50/80 ring-1 ring-sky-200'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="tipo-tratar-publicacao"
                        value={op.value}
                        checked={sel}
                        onChange={() => setTipo(op.value)}
                        className="mt-1 text-sky-600"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900">{op.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{op.descricao}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {exigePrazo && (
              <div>
                <label htmlFor="tratar-pub-data-fatal" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {labelPrazo}
                  <span className="text-red-600"> *</span>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[10rem] max-w-xs">
                    <Calendar
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                      aria-hidden
                    />
                    <input
                      id="tratar-pub-data-fatal"
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="dd/mm/aaaa"
                      value={dataFatal}
                      onChange={(e) => setDataFatal(mascararDigitosDataBr(e.target.value))}
                      onBlur={() => {
                        const norm = normalizarDataBr(dataFatal);
                        if (norm && /^\d{2}\/\d{2}\/\d{4}$/.test(norm)) setDataFatal(norm);
                      }}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                  {explicacaoPrazo && (
                    <p className="text-xs text-slate-500 flex-1 min-w-[12rem]">
                      Identificado: {explicacaoPrazo.replace(/^Identificado:\s*/i, '')}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="tratar-pub-obs-fase" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Observação de fase
                {exigeObservacao ? <span className="text-red-600"> *</span> : null}
              </label>
              <textarea
                id="tratar-pub-obs-fase"
                rows={3}
                value={observacaoFase}
                onChange={(e) => setObservacaoFase(e.target.value)}
                placeholder="Breve relato do que deve ser feito…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-y min-h-[4.5rem] focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>

            {mostraContatarCliente && (
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contatarCliente}
                  onChange={(e) => setContatarCliente(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600"
                />
                Contatar cliente (cria tarefa)
              </label>
            )}

            {erro && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{erro}</div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!podeConfirmar}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-700 text-white text-sm font-medium hover:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
              Tratar publicação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
