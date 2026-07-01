import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleDollarSign, FileSignature, Loader2, MessageCircle, Pencil, RefreshCw } from 'lucide-react';
import {
  buscarContratoHonorariosProcesso,
  salvarContratoHonorariosProcesso,
} from '../../repositories/documentosRepository.js';
import { ContratoHonorariosClausula3Modal } from '../../pages/documentos/components/ContratoHonorariosClausula3Modal.jsx';
import {
  ANTECEDENCIAS_WHATSAPP_HONORARIOS,
  TIPOS_REMUNERACAO,
  TIPO_REMUNERACAO_VALOR_FIXO,
  clausula3DadosParaForm,
  estadoInicialClausula3,
  formatarDataBR,
  formatarMoedaBRL,
  parcelamentoAtivo,
  resumirParcelasHonorarios,
  whatsappCobrancaInicial,
  whatsappCobrancaParaApi,
  whatsappCobrancaParaForm,
} from '../../pages/documentos/contratoHonorariosClausula3.js';
import { formatPhoneDisplay } from '../../utils/whatsappFormat.js';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900';

function rotuloTipoRemuneracao(tipo) {
  return TIPOS_REMUNERACAO.find((t) => t.id === tipo)?.label ?? tipo ?? '—';
}

function rotuloAntecedencia(valor) {
  return ANTECEDENCIAS_WHATSAPP_HONORARIOS.find((a) => a.value === valor)?.label ?? valor;
}

function statusParcelaBadge(pago) {
  return pago
    ? 'bg-emerald-100 text-emerald-800'
    : 'bg-amber-100 text-amber-900';
}

/**
 * Hub de remuneração por processo: parcelas, recebíveis e cobrança WhatsApp no vencimento.
 */
export function ProcessoRemuneracaoSecao({
  processoApiId,
  codigoCliente,
  numeroInterno,
  pessoaIdContratante,
  onAbrirGerarContrato,
}) {
  const [carregando, setCarregando] = useState(false);
  const [salvandoWhatsapp, setSalvandoWhatsapp] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [contrato, setContrato] = useState(null);
  const [whatsappForm, setWhatsappForm] = useState(whatsappCobrancaInicial());
  const [modalAberto, setModalAberto] = useState(false);

  const resumo = contrato?.resumo ?? null;
  const clausula3Form = useMemo(
    () =>
      contrato?.clausula3Dados
        ? clausula3DadosParaForm(contrato.clausula3Dados, resumo?.dataContrato)
        : estadoInicialClausula3(),
    [contrato, resumo?.dataContrato],
  );

  const totaisParcelas = useMemo(
    () => resumirParcelasHonorarios(resumo?.parcelas),
    [resumo?.parcelas],
  );

  const carregar = useCallback(async () => {
    const pid = Number(processoApiId);
    if (!Number.isFinite(pid) || pid <= 0) {
      setContrato(null);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const salvo = await buscarContratoHonorariosProcesso(pid);
      setContrato(salvo);
      setWhatsappForm(whatsappCobrancaParaForm(salvo?.whatsappCobranca));
    } catch (e) {
      if (String(e?.message || '').includes('404')) {
        setContrato(null);
        setWhatsappForm(whatsappCobrancaInicial());
      } else {
        setErro(e?.message || 'Falha ao carregar remuneração.');
      }
    } finally {
      setCarregando(false);
    }
  }, [processoApiId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!sucesso) return undefined;
    const t = window.setTimeout(() => setSucesso(''), 6000);
    return () => window.clearTimeout(t);
  }, [sucesso]);

  const montarPayloadSalvar = (clausula3Dados, whatsappOverride) => {
    const pessoaId = Number(resumo?.pessoaId ?? pessoaIdContratante);
    if (!Number.isFinite(pessoaId) || pessoaId <= 0) {
      throw new Error('Vincule a parte cliente ao processo antes de salvar a remuneração.');
    }
    return {
      pessoaId,
      processoId: Number(processoApiId),
      codigoCliente: codigoCliente || undefined,
      numeroInterno: numeroInterno != null && numeroInterno !== '' ? Number(numeroInterno) : undefined,
      objetoContrato: resumo?.objetoContrato ?? undefined,
      clausula3Dados,
      formaAssinatura: contrato?.formaAssinatura ?? 'duas_vias',
      whatsappCobranca: whatsappCobrancaParaApi(whatsappOverride ?? whatsappForm),
    };
  };

  const handleSalvarRemuneracao = async ({ dados }) => {
    const payload = montarPayloadSalvar(dados);
    const salvo = await salvarContratoHonorariosProcesso(processoApiId, payload);
    setContrato(salvo);
    setWhatsappForm(whatsappCobrancaParaForm(salvo?.whatsappCobranca));
    if (dados?.gerarRecebiveis) {
      setSucesso('Remuneração salva. Recebíveis atualizados no financeiro.');
    } else {
      setSucesso('Remuneração salva.');
    }
    setErro('');
    return true;
  };

  const handleSalvarWhatsapp = async () => {
    if (!contrato?.clausula3Dados) {
      setErro('Configure a remuneração antes de ativar o WhatsApp.');
      return;
    }
    setSalvandoWhatsapp(true);
    setErro('');
    try {
      const payload = montarPayloadSalvar(contrato.clausula3Dados, whatsappForm);
      const salvo = await salvarContratoHonorariosProcesso(processoApiId, payload);
      setContrato(salvo);
      setWhatsappForm(whatsappCobrancaParaForm(salvo?.whatsappCobranca));
      setSucesso('Configuração WhatsApp salva.');
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar WhatsApp.');
    } finally {
      setSalvandoWhatsapp(false);
    }
  };

  const formInicialModal = useMemo(() => {
    if (contrato?.clausula3Dados) return clausula3Form;
    return {
      ...estadoInicialClausula3(),
      temParcelamento: true,
      gerarRecebiveis: true,
      tipoRemuneracao: TIPO_REMUNERACAO_VALOR_FIXO,
    };
  }, [contrato, clausula3Form]);

  if (!(Number(processoApiId) > 0)) {
    return (
      <p className="text-sm text-slate-500">
        Salve o processo na API para configurar remuneração e recebíveis.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-indigo-600" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-800">Remuneração do processo</h3>
          {carregando ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden /> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => void carregar()}
            disabled={carregando}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Atualizar
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            onClick={() => setModalAberto(true)}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {resumo ? 'Editar remuneração' : 'Configurar remuneração'}
          </button>
          {resumo && onAbrirGerarContrato ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-800 hover:bg-indigo-100"
              onClick={() => onAbrirGerarContrato()}
            >
              <FileSignature className="h-3.5 w-3.5" aria-hidden />
              Gerar contrato PDF
            </button>
          ) : null}
        </div>
      </div>

      {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
      {sucesso ? <p className="text-sm text-emerald-700">{sucesso}</p> : null}

      {!resumo && !carregando ? (
        <p className="text-sm text-slate-600">
          Nenhuma remuneração cadastrada. Use <strong>Configurar remuneração</strong> para definir parcelas
          mensais, gerar recebíveis e (opcionalmente) lembrete WhatsApp no vencimento.
        </p>
      ) : null}

      {resumo ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-xs text-slate-500">Tipo</p>
              <p className="font-medium text-slate-800">{rotuloTipoRemuneracao(resumo.tipoRemuneracao)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-xs text-slate-500">Contrato</p>
              <p className="font-medium text-slate-800 tabular-nums">
                {totaisParcelas.total > 0
                  ? formatarMoedaBRL(totaisParcelas.total)
                  : resumo.valorFixo != null
                    ? formatarMoedaBRL(resumo.valorFixo)
                    : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-xs text-emerald-700">Recebido</p>
              <p className="font-medium text-emerald-900 tabular-nums">{formatarMoedaBRL(totaisParcelas.recebido)}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-xs text-amber-800">Pendente</p>
              <p className="font-medium text-amber-950 tabular-nums">{formatarMoedaBRL(totaisParcelas.pendente)}</p>
            </div>
          </div>

          {parcelamentoAtivo(clausula3Form) && resumo.parcelas?.length ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Parcela</th>
                    <th className="px-3 py-2 font-medium">Vencimento</th>
                    <th className="px-3 py-2 font-medium text-right">Valor</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.parcelas.map((p) => (
                    <tr key={p.id ?? p.numeroParcela} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        {p.numeroParcela}/{resumo.parcelas.length}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatarDataBR(p.dataVencimento)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatarMoedaBRL(p.valor)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${statusParcelaBadge(p.pagamentoPago)}`}
                        >
                          {p.pagamentoPago ? 'Recebido' : p.pagamentoStatus || 'Em aberto'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}

      <section className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden />
          <h4 className="text-sm font-semibold text-slate-800">Cobrança WhatsApp no vencimento</h4>
        </div>
        <p className="text-xs text-slate-600">
          Envia lembrete automático no horário de <strong>Brasília</strong>. Telefone principal: pessoa vinculada
          ao processo. Horários extras abaixo (opcional).
        </p>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={whatsappForm.ativo}
            onChange={(e) => setWhatsappForm((f) => ({ ...f, ativo: e.target.checked }))}
            disabled={!resumo}
          />
          <span>
            <span className="block font-medium">Ativar lembrete no vencimento</span>
            <span className="text-slate-600">Template atualizacao_processo — disparo automático pelo sistema.</span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Horário (Brasília)</span>
            <input
              type="time"
              className={inputClass}
              value={whatsappForm.horarioEnvio}
              onChange={(e) => setWhatsappForm((f) => ({ ...f, horarioEnvio: e.target.value }))}
              disabled={!resumo}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Quando enviar</span>
            <select
              className={inputClass}
              value={whatsappForm.antecedencia}
              onChange={(e) => setWhatsappForm((f) => ({ ...f, antecedencia: e.target.value }))}
              disabled={!resumo}
            >
              {ANTECEDENCIAS_WHATSAPP_HONORARIOS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Telefones extras (opcional)</span>
          <textarea
            rows={2}
            className={inputClass}
            placeholder="Um número por linha, com DDD"
            value={whatsappForm.telefonesExtrasTexto}
            onChange={(e) => setWhatsappForm((f) => ({ ...f, telefonesExtrasTexto: e.target.value }))}
            disabled={!resumo}
          />
          {whatsappForm.telefonesExtrasTexto ? (
            <span className="mt-1 block text-xs text-slate-500">
              {String(whatsappForm.telefonesExtrasTexto)
                .split(/[\n,;]+/)
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => formatPhoneDisplay(t.replace(/\D/g, '').startsWith('55') ? t.replace(/\D/g, '') : `55${t.replace(/\D/g, '')}`))
                .join(' · ')}
            </span>
          ) : null}
        </label>

        {resumo && whatsappForm.ativo ? (
          <p className="text-xs text-emerald-800">
            Próximo envio: {rotuloAntecedencia(whatsappForm.antecedencia)} às {whatsappForm.horarioEnvio} (horário
            de Brasília).
          </p>
        ) : null}

        <button
          type="button"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          onClick={() => void handleSalvarWhatsapp()}
          disabled={!resumo || salvandoWhatsapp}
        >
          {salvandoWhatsapp ? (
            <>
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
              Salvando…
            </>
          ) : (
            'Salvar WhatsApp'
          )}
        </button>
      </section>

      <ContratoHonorariosClausula3Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        initialForm={formInicialModal}
        processoApiId={processoApiId}
        pessoaId={resumo?.pessoaId ?? pessoaIdContratante}
        onApply={handleSalvarRemuneracao}
      />
    </div>
  );
}
