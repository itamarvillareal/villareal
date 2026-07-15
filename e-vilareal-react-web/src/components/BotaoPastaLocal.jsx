import { useCallback, useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import { padCliente } from '../data/processosDadosRelatorio.js';
import {
  abrirPastaClienteLocalOuFalhar,
  LocalHelperIndisponivelError,
  verificarLocalHelperAtivo,
} from '../services/abrirPastaLocalService.js';
import {
  MENSAGEM_LOCAL_HELPER_INDISPONIVEL,
  tituloBotaoPastaLocal,
} from '../services/abrirPastaLocalMessages.js';
import { processosBtnToolbarIndigo } from './processos/ProcessosAdminLayout.jsx';

const SECAO_BTN_BASE = [
  'inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
  'transition-all duration-150',
].join(' ');

const SECAO_INDIGO = {
  icon: 'text-indigo-600',
  repouso: 'border-slate-200 bg-white text-slate-800',
  hover: 'hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-md hover:-translate-y-px',
  focus: 'focus-visible:ring-indigo-500',
};

/**
 * @param {{
 *   codigoCliente: string|number,
 *   nomeCliente?: string,
 *   numeroInterno?: number|string|null,
 *   abrirPastaProcesso?: boolean,
 *   variant?: 'toolbar' | 'secao',
 *   disabled?: boolean,
 *   className?: string,
 *   onErro?: (message: string) => void,
 * }} props
 */
export function BotaoPastaLocal({
  codigoCliente,
  nomeCliente = '',
  numeroInterno = null,
  abrirPastaProcesso = true,
  variant = 'toolbar',
  disabled = false,
  className = '',
  onErro,
}) {
  const [abrindo, setAbrindo] = useState(false);
  const [helperAtivo, setHelperAtivo] = useState(null);
  const [baseClientes, setBaseClientes] = useState(null);

  useEffect(() => {
    let cancelado = false;
    void verificarLocalHelperAtivo().then((status) => {
      if (cancelado) return;
      setHelperAtivo(status.ativo);
      setBaseClientes(status.baseClientes);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const codigoInformado = String(codigoCliente ?? '').trim();
  const codigo = codigoInformado ? padCliente(codigoCliente) : '';
  const titulo = tituloBotaoPastaLocal({ ativo: helperAtivo, baseClientes });

  const handleClick = useCallback(async () => {
    if (!codigoInformado) {
      window.alert('Informe o código do cliente.');
      return;
    }
    setAbrindo(true);
    try {
      await abrirPastaClienteLocalOuFalhar({
        codigoCliente: cod,
        nomeCliente,
        numeroInterno,
        abrirPastaProcesso,
      });
      const status = await verificarLocalHelperAtivo();
      setHelperAtivo(status.ativo);
      setBaseClientes(status.baseClientes);
    } catch (err) {
      if (err instanceof LocalHelperIndisponivelError) {
        window.alert(MENSAGEM_LOCAL_HELPER_INDISPONIVEL);
        setHelperAtivo(false);
        return;
      }
      const msg = err?.message || 'Não foi possível abrir a pasta local.';
      onErro?.(msg);
      window.alert(msg);
    } finally {
      setAbrindo(false);
    }
  }, [abrirPastaProcesso, cod, codigoInformado, nomeCliente, numeroInterno, onErro]);

  const desabilitado = disabled || abrindo || !codigoInformado;
  const rotulo = abrindo ? 'Abrindo…' : 'Pasta local';

  if (variant === 'secao') {
    const cls = desabilitado
      ? `${SECAO_BTN_BASE} cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60 saturate-50`
      : `${SECAO_BTN_BASE} ${SECAO_INDIGO.repouso} ${SECAO_INDIGO.hover} ${SECAO_INDIGO.focus} ${className}`.trim();
    return (
      <button
        type="button"
        className={cls}
        disabled={desabilitado}
        onClick={() => void handleClick()}
        title={titulo}
      >
        <HardDrive className={`h-4 w-4 shrink-0 ${desabilitado ? '' : SECAO_INDIGO.icon}`} aria-hidden />
        {rotulo}
        {helperAtivo === false ? (
          <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            offline
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`${processosBtnToolbarIndigo} ${className}`.trim()}
      disabled={desabilitado}
      onClick={() => void handleClick()}
      title={titulo}
    >
      <HardDrive className="w-3.5 h-3.5" aria-hidden />
      {rotulo}
      {helperAtivo === false ? (
        <span className="rounded bg-amber-200/90 px-1 py-0.5 text-[9px] font-bold uppercase leading-none text-amber-950">
          off
        </span>
      ) : null}
    </button>
  );
}
