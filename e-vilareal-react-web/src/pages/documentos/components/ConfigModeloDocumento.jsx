import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarClientesIndiceCadastro } from '../../../repositories/clientesRepository.js';
import {
  buscarProcessoPorChaveNatural,
  listarProcessosResumoPorCodigoCliente,
} from '../../../repositories/processosRepository.js';
import { Field } from '../../../components/ui/Field.jsx';
import { ENDERECAMENTOS } from '../constants.js';
import { fieldErrorClass, inputClass } from '../documentosStyles.js';
import { resolveEnderecamento } from './DadosProcesso.jsx';
import { inferirEnderecamento, formatarCidadeEstado, formatarLocalData } from '../../../helpers/documentoHelper.js';
import { pad8 } from './configModeloDocumentoState.js';

/**
 * Seletor de cliente/processo + campos de cabeçalho do documento (modo modelo).
 */
export function ConfigModeloDocumento({ values, onChange, errors = {}, onProcessoCarregado }) {
  const [clientes, setClientes] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [carregandoClientes, setCarregandoClientes] = useState(true);
  const [carregandoProcessos, setCarregandoProcessos] = useState(false);

  useEffect(() => {
    let cancel = false;
    setCarregandoClientes(true);
    listarClientesIndiceCadastro()
      .then((list) => {
        if (!cancel) setClientes(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancel) setClientes([]);
      })
      .finally(() => {
        if (!cancel) setCarregandoClientes(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const cod = pad8(values.codigoCliente);
    if (!values.codigoCliente) {
      setProcessos([]);
      return;
    }
    let cancel = false;
    setCarregandoProcessos(true);
    listarProcessosResumoPorCodigoCliente(cod)
      .then((list) => {
        if (!cancel) setProcessos(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancel) setProcessos([]);
      })
      .finally(() => {
        if (!cancel) setCarregandoProcessos(false);
      });
    return () => {
      cancel = true;
    };
  }, [values.codigoCliente]);

  const carregarProcesso = useCallback(
    async (codigoCliente, numeroInterno) => {
      const proc = await buscarProcessoPorChaveNatural(codigoCliente, numeroInterno);
      if (!proc) return null;
      onProcessoCarregado?.(proc);
      const end = inferirEnderecamento(proc.competencia, proc.cidade, proc.uf || proc.estado);
      const matchEnd = ENDERECAMENTOS.find((e) => e === end);
      onChange({
        numeroProcesso: proc.numeroCnj || proc.numeroProcessoNovo || proc.numeroProcessoAntigo || '',
        valorCausa: proc.valorCausa != null ? String(proc.valorCausa) : values.valorCausa,
        enderecamentoSelect: matchEnd || (end ? '__outro__' : values.enderecamentoSelect),
        enderecamentoOutro: matchEnd ? '' : end || values.enderecamentoOutro,
        cidadeEstado: formatarLocalData(formatarCidadeEstado(proc.cidade, proc.uf || proc.estado)),
      });
      return proc;
    },
    [onChange, onProcessoCarregado, values.enderecamentoOutro, values.enderecamentoSelect, values.valorCausa],
  );

  const aoMudarProcesso = (numeroInterno) => {
    onChange({ numeroInterno });
    if (values.codigoCliente && numeroInterno !== '') {
      void carregarProcesso(pad8(values.codigoCliente), Number(numeroInterno));
    }
  };

  const usarOutro = values.enderecamentoSelect === '__outro__';

  const clientesOrdenados = useMemo(
    () => [...clientes].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo))),
    [clientes],
  );

  return (
    <div className="space-y-4">
      <Field label="Cliente *">
        <select
          className={inputClass}
          value={values.codigoCliente}
          disabled={carregandoClientes}
          onChange={(e) => onChange({ codigoCliente: e.target.value, numeroInterno: '' })}
        >
          <option value="">{carregandoClientes ? 'Carregando…' : 'Selecione o cliente…'}</option>
          {clientesOrdenados.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.codigo} — {c.nomeRazao || 'Sem nome'}
            </option>
          ))}
        </select>
        {errors.codigoCliente ? <p className={fieldErrorClass}>{errors.codigoCliente}</p> : null}
      </Field>

      <Field label="Processo *">
        <select
          className={inputClass}
          value={values.numeroInterno}
          disabled={!values.codigoCliente || carregandoProcessos}
          onChange={(e) => aoMudarProcesso(e.target.value)}
        >
          <option value="">
            {!values.codigoCliente
              ? 'Selecione o cliente primeiro'
              : carregandoProcessos
                ? 'Carregando processos…'
                : 'Selecione o processo…'}
          </option>
          {processos.map((p) => (
            <option key={p.id ?? `${p.numeroInterno}`} value={String(p.numeroInterno ?? '')}>
              Proc. {p.numeroInterno}
              {p.numeroCnj ? ` — ${p.numeroCnj}` : ''}
              {p.naturezaAcao ? ` (${p.naturezaAcao})` : ''}
            </option>
          ))}
        </select>
        {errors.numeroInterno ? <p className={fieldErrorClass}>{errors.numeroInterno}</p> : null}
      </Field>

      <Field label="Endereçamento *">
        <select
          className={inputClass}
          value={values.enderecamentoSelect}
          onChange={(e) => onChange({ enderecamentoSelect: e.target.value })}
        >
          <option value="">Selecione o juízo…</option>
          {ENDERECAMENTOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
          <option value="__outro__">Outro (digitar)</option>
        </select>
        {errors.enderecamento ? <p className={fieldErrorClass}>{errors.enderecamento}</p> : null}
      </Field>

      {usarOutro ? (
        <Field label="Endereçamento (texto livre) *">
          <textarea
            className={inputClass}
            rows={2}
            value={values.enderecamentoOutro}
            onChange={(e) => onChange({ enderecamentoOutro: e.target.value })}
            placeholder="MERITÍSSIMO JUÍZO…"
          />
        </Field>
      ) : null}

      <Field label="Número do processo (opcional)">
        <input
          className={inputClass}
          value={values.numeroProcesso}
          onChange={(e) => onChange({ numeroProcesso: e.target.value })}
        />
      </Field>

      <Field label="Valor da causa">
        <input
          className={inputClass}
          value={values.valorCausa}
          onChange={(e) => onChange({ valorCausa: e.target.value })}
          placeholder="Ex.: 15000,00"
        />
      </Field>

      <Field label="Data do documento">
        <input
          type="date"
          className={inputClass}
          value={values.dataDocumento}
          onChange={(e) => onChange({ dataDocumento: e.target.value })}
        />
      </Field>

      <Field label="Local (cidade/estado)">
        <input
          className={inputClass}
          value={values.cidadeEstado}
          onChange={(e) => onChange({ cidadeEstado: e.target.value })}
        />
      </Field>
    </div>
  );
}
