import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Loader2, Receipt, RefreshCw } from 'lucide-react';
import { listarContratosHonorarios } from '../../repositories/documentosRepository.js';
import { DocumentosSubmenu } from './components/DocumentosSubmenu.jsx';
import { btnSecondary, inputClass } from './documentosStyles.js';
import {
  calcularParcelasPreview,
  formatarDataBR,
  formatarMoedaBRL,
  TIPOS_REMUNERACAO,
} from './contratoHonorariosClausula3.js';

function resolverParcelasExibicao(contrato) {
  const parcelas = contrato.parcelas ?? [];
  if (parcelas.length > 0) return parcelas;

  const qtd = Number(contrato.quantidadeParcelas);
  const total = contrato.valorTotalParcelas ?? contrato.valorFixo;
  if (!Number.isFinite(qtd) || qtd <= 0 || total == null) return [];

  return calcularParcelasPreview({
    temParcelamento: true,
    quantidadeParcelas: String(qtd),
    valorTotalParcelas: total,
    valorFixo: total,
    primeiroVencimento: contrato.dataContrato || new Date().toISOString().slice(0, 10),
    intervaloParcelas: 'MENSAL',
  }).map((p) => ({
    numeroParcela: p.numero,
    valor: p.valor,
    dataVencimento: p.dataVencimento,
  }));
}

function rotuloRemuneracao(contrato) {
  const tipo = TIPOS_REMUNERACAO.find((t) => t.id === contrato.tipoRemuneracao);
  const base = tipo?.label ?? contrato.tipoRemuneracao ?? '—';
  const partes = [base];
  if (contrato.percentualProveito != null) {
    partes.push(`${contrato.percentualProveito}%`);
  }
  if (contrato.valorFixo != null) {
    partes.push(formatarMoedaBRL(contrato.valorFixo));
  }
  return partes.join(' · ');
}

function rotuloProcesso(contrato) {
  if (!contrato.processoId) return 'Sem processo';
  const cod = contrato.codigoCliente ?? '—';
  const num = contrato.numeroInterno != null ? contrato.numeroInterno : '—';
  return `${cod} / ${num}`;
}

function resumoRecebiveis(contrato) {
  if (!contrato.gerarRecebiveis) return 'Não gerados';
  const qtd = contrato.parcelas?.length ?? contrato.parcelasGeradas ?? 0;
  if (qtd === 0) return 'Marcado, sem parcelas';
  return `${qtd} parcela${qtd === 1 ? '' : 's'}`;
}

function DetalheContrato({ contrato }) {
  const parcelas = resolverParcelasExibicao(contrato);

  if (parcelas.length === 0) {
    return (
      <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/40">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {contrato.gerarRecebiveis
            ? 'Nenhuma parcela registrada. Verifique se o contrato estava vinculado a um processo com parcelamento configurado.'
            : 'Nenhuma parcela cadastrada neste contrato.'}
        </p>
      </div>
    );
  }

  const mostraPagamento = contrato.gerarRecebiveis || parcelas.some((p) => p.pagamentoId);

  return (
    <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/40">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Parcelas
        {contrato.formaPagamentoParcelas ? ` · ${contrato.formaPagamentoParcelas}` : ''}
        {contrato.valorTotalParcelas != null ? (
          <>
            {' '}
            · Total {formatarMoedaBRL(contrato.valorTotalParcelas)}
          </>
        ) : null}
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 font-medium">Parcela</th>
              <th className="px-3 py-2 font-medium">Valor</th>
              <th className="px-3 py-2 font-medium">Vencimento</th>
              {mostraPagamento ? <th className="px-3 py-2 font-medium">Pagamento</th> : null}
            </tr>
          </thead>
          <tbody>
            {parcelas.map((p) => (
              <tr key={p.id ?? p.numeroParcela} className="border-t border-slate-200 dark:border-slate-700">
                <td className="px-3 py-2">
                  {p.numeroParcela}/{parcelas.length}
                </td>
                <td className="px-3 py-2">{formatarMoedaBRL(p.valor)}</td>
                <td className="px-3 py-2">{formatarDataBR(p.dataVencimento)}</td>
                {mostraPagamento ? (
                  <td className="px-3 py-2">
                    {p.pagamentoId ? (
                      <Link
                        to="/pagamentos"
                        className="font-medium text-cyan-700 hover:underline dark:text-cyan-300"
                      >
                        #{p.pagamentoId}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ContratosHonorariosRecebiveis() {
  const [contratos, setContratos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({ de: '', ate: '' });
  const [expandidoId, setExpandidoId] = useState(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const params = {};
      if (filtros.de) params.de = filtros.de;
      if (filtros.ate) params.ate = filtros.ate;
      const lista = await listarContratosHonorarios(params);
      setContratos(Array.isArray(lista) ? lista : []);
    } catch (e) {
      setContratos([]);
      setErro(e?.message || 'Falha ao carregar contratos.');
    } finally {
      setCarregando(false);
    }
  }, [filtros.de, filtros.ate]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const totalRecebiveis = useMemo(
    () => contratos.reduce((acc, c) => acc + (c.parcelas?.length ?? c.parcelasGeradas ?? 0), 0),
    [contratos],
  );

  return (
    <div className="flex min-h-full min-h-0 flex-1 flex-col bg-gradient-to-br from-slate-100 via-cyan-50/30 to-slate-100 p-4 dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] md:p-6">
      <DocumentosSubmenu />

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-cyan-600 to-teal-700 p-2.5 text-white shadow-lg shadow-cyan-500/25 ring-1 ring-white/20">
            <Receipt className="h-7 w-7" aria-hidden />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-cyan-800 to-teal-800 bg-clip-text text-xl font-bold text-transparent dark:from-cyan-200 dark:to-teal-200">
              Recebíveis de contratos
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Contratação vigente por processo — alterações atualizam o relatório de recebíveis.
            </p>
          </div>
        </div>
        <button type="button" className={btnSecondary} onClick={() => void recarregar()} disabled={carregando}>
          <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} aria-hidden />
          Atualizar
        </button>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-300">De</span>
          <input
            type="date"
            className={`${inputClass} w-auto min-w-[10rem]`}
            value={filtros.de}
            onChange={(e) => setFiltros((f) => ({ ...f, de: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-300">Até</span>
          <input
            type="date"
            className={`${inputClass} w-auto min-w-[10rem]`}
            value={filtros.ate}
            onChange={(e) => setFiltros((f) => ({ ...f, ate: e.target.value }))}
          />
        </label>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {contratos.length} contrato{contratos.length === 1 ? '' : 's'}
          {totalRecebiveis > 0 ? ` · ${totalRecebiveis} recebível${totalRecebiveis === 1 ? '' : 'is'}` : ''}
        </p>
      </div>

      {erro ? (
        <div
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {erro}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        {carregando ? (
          <p className="flex items-center gap-2 p-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando contratos…
          </p>
        ) : contratos.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
            <p>Nenhum contrato de honorários encontrado.</p>
            <p className="mt-2">
              Gere um contrato em{' '}
              <Link to="/documentos/gerar" className="font-medium text-cyan-700 hover:underline dark:text-cyan-300">
                Gerar documento
              </Link>{' '}
              com a Cláusula 3ª configurada — o contrato aparecerá aqui após o PDF final.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {contratos.map((contrato) => {
              const aberto = expandidoId === contrato.id;
              return (
                <div key={contrato.id}>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    onClick={() => setExpandidoId(aberto ? null : contrato.id)}
                    aria-expanded={aberto}
                  >
                    <span className="min-w-[5.5rem] text-sm font-medium text-slate-800 dark:text-slate-100">
                      {formatarDataBR(contrato.dataContrato)}
                    </span>
                    <span className="min-w-[10rem] flex-1 text-sm text-slate-700 dark:text-slate-200">
                      {contrato.nomeContratante || '—'}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{rotuloProcesso(contrato)}</span>
                    <span className="hidden text-sm text-slate-600 dark:text-slate-300 md:inline">
                      {rotuloRemuneracao(contrato)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {resumoRecebiveis(contrato)}
                    </span>
                    {aberto ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    )}
                  </button>
                  {aberto ? <DetalheContrato contrato={contrato} /> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ContratosHonorariosRecebiveis;
