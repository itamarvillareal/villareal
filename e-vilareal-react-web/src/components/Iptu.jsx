import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { carregarImovelCadastro } from '../repositories/imoveisRepository.js';
import {
  listarAnuaisDoImovel,
  upsertAnual,
  recalcularParcelas,
  listarParcelas,
  marcarParcelaPaga,
  cancelarParcela,
  listarConsultasDebito,
  registrarConsultaDebito,
} from '../repositories/iptuRepository.js';
import { featureFlags } from '../config/featureFlags.js';
import { Field } from './ui/Field.jsx';
import { resolverAliasHojeEmTexto } from '../services/hjDateAliasService.js';

const inputClass =
  'w-full rounded-lg border border-slate-300/90 dark:border-white/[0.12] bg-white/95 dark:bg-[#0f141c]/90 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50';
const btnPrimary =
  'inline-flex items-center justify-center rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-[#151d2c] dark:text-slate-100 dark:hover:bg-white/5';
const sectionHeading = 'text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300';

function parseValorBrParaNumero(tx) {
  const s = String(tx ?? '').trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function formatNumeroMoedaBr(n) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function resumoCalculo(valorAnual, divMes = 30) {
  const v = Number(valorAnual);
  if (!Number.isFinite(v) || v <= 0) return { mensal: null, diario: null };
  const mensal = Math.round((v / 12) * 100) / 100;
  const diario = Math.round((mensal / divMes) * 10000) / 10000;
  return { mensal, diario };
}

export function Iptu() {
  const { imovelId: imovelIdParam } = useParams();
  const imovelId = Number(imovelIdParam);
  const [imovel, setImovel] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [valorTx, setValorTx] = useState('');
  const [obs, setObs] = useState('');
  const [anexoPath, setAnexoPath] = useState('');
  const [iptuAnualId, setIptuAnualId] = useState(null);
  const [parcelas, setParcelas] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [openVal, setOpenVal] = useState(true);
  const [openPar, setOpenPar] = useState(true);
  const [openCons, setOpenCons] = useState(true);
  const [pagaId, setPagaId] = useState(null);
  const [pagaData, setPagaData] = useState('');
  const [novaCons, setNovaCons] = useState(false);
  const [cData, setCData] = useState('');
  const [cDeb, setCDeb] = useState(false);
  const [cValor, setCValor] = useState('');
  const [cObs, setCObs] = useState('');

  const anosCombo = useMemo(() => {
    const y = new Date().getFullYear();
    const out = [];
    for (let a = y - 5; a <= y + 1; a += 1) out.push(a);
    return out;
  }, []);

  const recarregarParcelas = useCallback(async () => {
    if (!Number.isFinite(imovelId) || imovelId < 1) return;
    const page = await listarParcelas({
      imovelId,
      ano,
      status: statusFiltro || undefined,
      page: 0,
      size: 100,
    });
    setParcelas(Array.isArray(page?.content) ? page.content : []);
  }, [imovelId, ano, statusFiltro]);

  const recarregarConsultas = useCallback(async () => {
    if (!Number.isFinite(imovelId) || imovelId < 1) return;
    const list = await listarConsultasDebito({ imovelId, limit: 80 });
    setConsultas(Array.isArray(list) ? list : []);
  }, [imovelId]);

  useEffect(() => {
    if (!featureFlags.useApiImoveis) {
      setLoadErr('Ative a API de imóveis (VITE_USE_API_IMOVEIS) para usar o IPTU.');
      return;
    }
    let ok = true;
    void (async () => {
      try {
        const r = await carregarImovelCadastro({ imovelId });
        if (!ok) return;
        if (r?.item) setImovel(r.item);
        else setLoadErr('Imóvel não encontrado.');
      } catch (e) {
        if (!ok) return;
        setLoadErr(e?.message || 'Falha ao carregar imóvel.');
      }
    })();
    return () => {
      ok = false;
    };
  }, [imovelId]);

  useEffect(() => {
    if (!featureFlags.useApiImoveis || !Number.isFinite(imovelId) || imovelId < 1) return;
    let ok = true;
    void (async () => {
      try {
        const anuais = await listarAnuaisDoImovel(imovelId, ano);
        if (!ok) return;
        const arr = Array.isArray(anuais) ? anuais : [];
        const hit = arr.find((a) => Number(a.anoReferencia) === ano) || arr[0];
        if (hit) {
          setIptuAnualId(hit.id);
          setValorTx(formatNumeroMoedaBr(hit.valorTotalAnual));
          setObs(String(hit.observacoes ?? ''));
          setAnexoPath(String(hit.anexoCarnePath ?? ''));
        } else {
          setIptuAnualId(null);
          setValorTx('');
          setObs('');
          setAnexoPath('');
        }
      } catch {
        if (!ok) return;
        setIptuAnualId(null);
      }
    })();
    return () => {
      ok = false;
    };
  }, [imovelId, ano]);

  useEffect(() => {
    void recarregarParcelas().catch(() => setParcelas([]));
  }, [recarregarParcelas]);

  useEffect(() => {
    void recarregarConsultas().catch(() => setConsultas([]));
  }, [recarregarConsultas]);

  const totalDevido = useMemo(
    () => parcelas.reduce((s, p) => s + (Number(p.valorCalculado) || 0), 0),
    [parcelas],
  );
  const { mensal, diario } = resumoCalculo(parseValorBrParaNumero(valorTx), 30);

  async function salvarEGerar() {
    setMsg('');
    setSaving(true);
    try {
      const valor = parseValorBrParaNumero(valorTx);
      if (valor == null || valor < 0) throw new Error('Informe o valor total anual válido.');
      const created = await upsertAnual({
        imovelId,
        anoReferencia: ano,
        valorTotalAnual: valor,
        observacoes: obs,
        anexoCarnePath: anexoPath || undefined,
      });
      setIptuAnualId(created?.id ?? null);
      await recalcularParcelas(created.id);
      setMsg('Valor anual salvo e parcelas geradas.');
      await recarregarParcelas();
    } catch (e) {
      setMsg(e?.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function onMarcarPaga() {
    if (!pagaId) return;
    const iso = dataBrParaIso(pagaData);
    if (!iso) {
      setMsg('Data de pagamento inválida (use dd/mm/aaaa ou hj).');
      return;
    }
    try {
      await marcarParcelaPaga(pagaId, { dataPagamento: iso });
      setPagaId(null);
      setPagaData('');
      await recarregarParcelas();
    } catch (e) {
      setMsg(e?.message || 'Erro ao marcar paga.');
    }
  }

  function dataBrParaIso(br) {
    const r = resolverAliasHojeEmTexto(String(br), 'iso');
    if (r) return r;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br).trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  }

  async function onCancelar(id) {
    const motivo = window.prompt('Motivo do cancelamento?');
    if (motivo == null) return;
    try {
      await cancelarParcela(id, motivo);
      await recarregarParcelas();
    } catch (e) {
      setMsg(e?.message || 'Erro ao cancelar.');
    }
  }

  async function onRegistrarConsulta() {
    setMsg('');
    try {
      await registrarConsultaDebito({
        imovelId,
        dataConsulta: cData,
        existeDebito: cDeb,
        valorDebito: cDeb ? cValor : undefined,
        observacoes: cObs,
      });
      setNovaCons(false);
      setCData('');
      setCDeb(false);
      setCValor('');
      setCObs('');
      await recarregarConsultas();
    } catch (e) {
      setMsg(e?.message || 'Erro ao registrar consulta.');
    }
  }

  if (!Number.isFinite(imovelId) || imovelId < 1) {
    return <p className="p-6 text-sm text-red-600">ID de imóvel inválido.</p>;
  }

  if (loadErr) {
    return <p className="p-6 text-sm text-red-600">{loadErr}</p>;
  }

  const np = imovel?.numeroPlanilhaColA ?? imovel?.imovelId;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-[#121826]/95">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Imóvel</p>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Planilha nº {np ?? '—'} — {imovel?.condominio || '—'} / {imovel?.unidade || '—'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Inscrição imobiliária: <span className="font-medium">{imovel?.inscricaoImobiliaria || '—'}</span>
            </p>
          </div>
          <Link to="/imoveis" className={btnSecondary}>
            Voltar ao imóvel
          </Link>
        </header>

        {msg ? <p className="text-sm text-amber-800 dark:text-amber-200">{msg}</p> : null}

        <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-[#121826]/95">
          <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setOpenVal(!openVal)}>
            {openVal ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <h2 className={sectionHeading}>Valor anual</h2>
          </button>
          {openVal ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Ano de referência">
                <select className={inputClass} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
                  {anosCombo.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valor total anual (R$)">
                <input className={inputClass} value={valorTx} onChange={(e) => setValorTx(e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="Observações" className="sm:col-span-2">
                <textarea className={`${inputClass} min-h-[5rem]`} value={obs} onChange={(e) => setObs(e.target.value)} />
              </Field>
              <Field label="Caminho do carnê (URL ou path)" className="sm:col-span-2">
                <input className={inputClass} value={anexoPath} onChange={(e) => setAnexoPath(e.target.value)} placeholder="Opcional" />
              </Field>
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} disabled={saving} onClick={() => void salvarEGerar()}>
                  Salvar e gerar parcelas
                </button>
              </div>
              <div className="sm:col-span-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-black/20 dark:text-slate-200">
                <p>
                  Valor mensal (anual ÷ 12): <strong>{mensal != null ? formatNumeroMoedaBr(mensal) : '—'}</strong>
                </p>
                <p>
                  Valor diário (mensal ÷ 30): <strong>{diario != null ? String(diario) : '—'}</strong>
                </p>
                <p>
                  Total das parcelas exibidas: <strong>{formatNumeroMoedaBr(totalDevido)}</strong>
                </p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-[#121826]/95">
          <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setOpenPar(!openPar)}>
            {openPar ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <h2 className={sectionHeading}>Parcelas</h2>
          </button>
          {openPar ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <label className="text-xs text-slate-600 dark:text-slate-400">Status</label>
                <select className={inputClass + ' max-w-xs'} value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="PAGO">Pago</option>
                  <option value="ATRASADO">Atrasado</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
                {iptuAnualId ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() =>
                      void recalcularParcelas(iptuAnualId)
                        .then(() => recarregarParcelas())
                        .catch((e) => setMsg(e?.message || 'Erro ao recalcular'))
                    }
                  >
                    Recalcular parcelas
                  </button>
                ) : null}
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-[#0f141c]">
                    <tr>
                      <th className="p-2">Competência</th>
                      <th className="p-2">Dias</th>
                      <th className="p-2">Valor</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Vencimento</th>
                      <th className="p-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelas.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100 dark:border-white/5">
                        <td className="p-2">{p.competenciaMes}</td>
                        <td className="p-2">{p.diasCobrados}</td>
                        <td className="p-2">{formatNumeroMoedaBr(p.valorCalculado)}</td>
                        <td className="p-2">
                          <span
                            className={`rounded px-2 py-0.5 font-medium ${
                              p.status === 'PAGO'
                                ? 'bg-emerald-100 text-emerald-900'
                                : p.status === 'ATRASADO'
                                  ? 'bg-red-100 text-red-900'
                                  : p.status === 'CANCELADO'
                                    ? 'bg-slate-200 text-slate-700'
                                    : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="p-2">{p.dataVencimento || '—'}</td>
                        <td className="p-2 space-x-1">
                          {p.status === 'PENDENTE' || p.status === 'ATRASADO' ? (
                            <>
                              <button type="button" className={btnSecondary + ' !py-1 !px-2 text-[11px]'} onClick={() => setPagaId(p.id)}>
                                Marcar paga
                              </button>
                              <button
                                type="button"
                                className={btnSecondary + ' !py-1 !px-2 text-[11px]'}
                                onClick={() => void onCancelar(p.id)}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagaId ? (
                <div className="flex flex-wrap items-end gap-2 rounded-lg border border-cyan-200 bg-cyan-50/50 p-3 dark:border-cyan-900/40 dark:bg-cyan-950/20">
                  <Field label="Data pagamento (dd/mm/aaaa ou hj)">
                    <input className={inputClass} value={pagaData} onChange={(e) => setPagaData(e.target.value)} />
                  </Field>
                  <button type="button" className={btnPrimary} onClick={() => void onMarcarPaga()}>
                    Confirmar
                  </button>
                  <button type="button" className={btnSecondary} onClick={() => setPagaId(null)}>
                    Fechar
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-[#121826]/95">
          <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setOpenCons(!openCons)}>
            {openCons ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <h2 className={sectionHeading}>Histórico de consultas de débito</h2>
          </button>
          {openCons ? (
            <div className="mt-4 space-y-3">
              <button type="button" className={btnSecondary} onClick={() => setNovaCons((v) => !v)}>
                {novaCons ? 'Fechar formulário' : 'Registrar nova consulta'}
              </button>
              {novaCons ? (
                <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10 sm:grid-cols-2">
                  <Field label="Data da consulta">
                    <input className={inputClass} value={cData} onChange={(e) => setCData(e.target.value)} placeholder="dd/mm/aaaa" />
                  </Field>
                  <Field label="Existe débito">
                    <select className={inputClass} value={cDeb ? 'sim' : 'nao'} onChange={(e) => setCDeb(e.target.value === 'sim')}>
                      <option value="nao">Não</option>
                      <option value="sim">Sim</option>
                    </select>
                  </Field>
                  {cDeb ? (
                    <Field label="Valor do débito">
                      <input className={inputClass} value={cValor} onChange={(e) => setCValor(e.target.value)} />
                    </Field>
                  ) : null}
                  <Field label="Observações" className="sm:col-span-2">
                    <textarea className={`${inputClass} min-h-[4rem]`} value={cObs} onChange={(e) => setCObs(e.target.value)} />
                  </Field>
                  <button type="button" className={btnPrimary} onClick={() => void onRegistrarConsulta()}>
                    Salvar consulta
                  </button>
                </div>
              ) : null}
              <ul className="space-y-2 text-sm">
                {consultas.map((c) => (
                  <li key={c.id} className="rounded border border-slate-100 p-2 dark:border-white/5">
                    <span className="font-medium">{c.dataConsulta}</span> — débito: {c.existeDebito ? 'sim' : 'não'}
                    {c.valorDebito != null ? ` — R$ ${c.valorDebito}` : ''}
                    {c.observacoes ? <p className="text-xs text-slate-600 dark:text-slate-400">{c.observacoes}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
