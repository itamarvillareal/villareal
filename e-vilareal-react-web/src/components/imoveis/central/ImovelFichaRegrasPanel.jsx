import { useEffect, useState } from 'react';
import { Loader2, Pencil, Save } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import { ConfirmDialog } from '../../financeiro/shared/ConfirmDialog.jsx';
import {
  atualizarContratoRegrasApi,
  atualizarProprioClienteApi,
  listarContratosLocacaoImovelApi,
  obterProprioClientePorCodigoApi,
} from '../../../repositories/imoveisRepository.js';

function CampoNumero({ label, value, onChange, min = 1, max = 31, disabled }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm tabular-nums disabled:opacity-50"
      />
    </label>
  );
}

/**
 * Ficha editável de regras do contrato + flag imóvel próprio (cliente.proprio).
 * @param {{ item: object | null, onAtualizado?: () => void }} props
 */
export function ImovelFichaRegrasPanel({ item, onAtualizado }) {
  const [contrato, setContrato] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const [diaVencimento, setDiaVencimento] = useState('');
  const [diaRepasse, setDiaRepasse] = useState('');
  const [taxaAdmin, setTaxaAdmin] = useState('');
  const [proprio, setProprio] = useState(false);
  const [clienteId, setClienteId] = useState(null);
  const [editando, setEditando] = useState(false);
  const [confirmarSalvar, setConfirmarSalvar] = useState(false);

  useEffect(() => {
    if (!featureFlags.useApiImoveis || !item?.imovelId) {
      setContrato(null);
      return undefined;
    }
    let ativo = true;
    setCarregando(true);
    setErro('');
    Promise.all([
      listarContratosLocacaoImovelApi(item.imovelId),
      item.codigoCliente ? obterProprioClientePorCodigoApi(item.codigoCliente) : Promise.resolve(null),
    ])
      .then(([contratos, proprioInfo]) => {
        if (!ativo) return;
        const vigente =
          (Array.isArray(contratos) ? contratos : []).find(
            (c) => String(c.status).toUpperCase() === 'VIGENTE',
          ) ||
          (Array.isArray(contratos) ? contratos[0] : null);
        setContrato(vigente || null);
        setDiaVencimento(vigente?.diaVencimentoAluguel != null ? String(vigente.diaVencimentoAluguel) : '');
        setDiaRepasse(vigente?.diaRepasse != null ? String(vigente.diaRepasse) : '');
        setTaxaAdmin(
          vigente?.taxaAdministracaoPercent != null
            ? String(vigente.taxaAdministracaoPercent)
            : item.taxaAdministracaoPercent != null
              ? String(item.taxaAdministracaoPercent)
              : '',
        );
        const prop =
          proprioInfo?.proprio != null
            ? Boolean(proprioInfo.proprio)
            : Boolean(item.repasseInterno);
        setProprio(prop);
        setClienteId(proprioInfo?.clienteId ?? null);
      })
      .catch((e) => {
        if (ativo) setErro(e?.message || 'Falha ao carregar regras do imóvel.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [item?.imovelId, item?.codigoCliente, item?.repasseInterno, item?.taxaAdministracaoPercent]);

  useEffect(() => {
    if (!sucesso) return undefined;
    const t = window.setTimeout(() => setSucesso(''), 4000);
    return () => window.clearTimeout(t);
  }, [sucesso]);

  async function salvar() {
    if (!contrato?.id || !item?.imovelId) return;
    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      await atualizarContratoRegrasApi(contrato.id, {
        imovelId: item.imovelId,
        diaVencimentoAluguel: Number(diaVencimento) || null,
        diaRepasse: Number(diaRepasse) || null,
        taxaAdministracaoPercent: Number(String(taxaAdmin).replace(',', '.')) || null,
        contratoBase: contrato,
      });
      if (clienteId != null) {
        await atualizarProprioClienteApi(clienteId, proprio);
      }
      setSucesso('Regras atualizadas.');
      setEditando(false);
      onAtualizado?.();
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar as regras.');
    } finally {
      setSalvando(false);
      setConfirmarSalvar(false);
    }
  }

  if (!item?.contratoId && !contrato) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 p-4 text-sm text-slate-500">
        Sem contrato vigente — cadastre locação para editar regras de vencimento e repasse.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Regras do imóvel</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Vencimento, repasse, taxa de administração e flag imóvel próprio (cliente.proprio).
          </p>
        </div>
        {!editando ? (
          <button
            type="button"
            onClick={() => setEditando(true)}
            disabled={carregando || !contrato}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden />
            Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                setDiaVencimento(contrato?.diaVencimentoAluguel != null ? String(contrato.diaVencimentoAluguel) : '');
                setDiaRepasse(contrato?.diaRepasse != null ? String(contrato.diaRepasse) : '');
                setTaxaAdmin(
                  contrato?.taxaAdministracaoPercent != null ? String(contrato.taxaAdministracaoPercent) : '',
                );
              }}
              disabled={salvando}
              className="text-xs px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setConfirmarSalvar(true)}
              disabled={salvando}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-50"
            >
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Save className="w-3.5 h-3.5" aria-hidden />}
              Salvar
            </button>
          </div>
        )}
      </div>

      {carregando ? <p className="text-sm text-slate-500">Carregando regras…</p> : null}
      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
      {sucesso ? <p className="text-sm text-emerald-700">{sucesso}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CampoNumero
          label="Dia vencimento aluguel"
          value={diaVencimento}
          onChange={setDiaVencimento}
          disabled={!editando || salvando}
        />
        <CampoNumero
          label="Dia repasse"
          value={diaRepasse}
          onChange={setDiaRepasse}
          disabled={!editando || salvando}
        />
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
          Taxa adm. (%)
          <input
            type="text"
            inputMode="decimal"
            value={taxaAdmin}
            disabled={!editando || salvando}
            onChange={(e) => setTaxaAdmin(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm tabular-nums disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
          Imóvel próprio
          <span className="inline-flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              checked={proprio}
              disabled={!editando || salvando || clienteId == null}
              onChange={(e) => setProprio(e.target.checked)}
              className="rounded border-slate-400 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
            />
            <span className="text-sm text-slate-800 dark:text-slate-200">
              {proprio ? 'Próprio (repasse interno)' : 'Terceiro (repasse no banco)'}
            </span>
          </span>
          {clienteId == null ? (
            <span className="text-[10px] text-amber-700 dark:text-amber-300">
              Sem cliente vinculado — flag só leitura via visão geral.
            </span>
          ) : null}
        </label>
      </div>

      <ConfirmDialog
        open={confirmarSalvar}
        title="Confirmar alteração das regras?"
        message="As mudanças afetam vencimento, repasse, taxa e o tipo de repasse (próprio/terceiro) deste imóvel."
        confirmLabel="Salvar"
        onConfirm={() => void salvar()}
        onCancel={() => setConfirmarSalvar(false)}
      />
    </div>
  );
}
