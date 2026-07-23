import { useCallback, useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import {
  abrirPastaPessoaLocalOuFalhar,
  LocalHelperIndisponivelError,
  verificarLocalHelperAtivo,
} from '../services/abrirPastaLocalService.js';
import {
  mensagemLocalHelperIndisponivel,
  tituloBotaoPastaLocalPessoa,
} from '../services/abrirPastaLocalMessages.js';
import { detectarSOUsuario } from '../utils/detectarSOUsuario.js';

/**
 * @param {{
 *   pessoaId: number|string,
 *   nomePessoa?: string,
 *   disabled?: boolean,
 *   className?: string,
 *   onErro?: (message: string) => void,
 * }} props
 */
export function BotaoPastaLocalPessoa({
  pessoaId,
  nomePessoa = '',
  disabled = false,
  className = '',
  onErro,
}) {
  const [abrindo, setAbrindo] = useState(false);
  const [helperAtivo, setHelperAtivo] = useState(null);

  useEffect(() => {
    let cancelado = false;
    const checar = () => {
      void verificarLocalHelperAtivo().then((status) => {
        if (cancelado) return;
        setHelperAtivo(status.ativo);
      });
    };
    checar();
    const onFocus = () => checar();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checar();
    });
    return () => {
      cancelado = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const idInformado = String(pessoaId ?? '').trim();
  const so = detectarSOUsuario();
  const titulo = tituloBotaoPastaLocalPessoa({ ativo: helperAtivo, so });

  const handleClick = useCallback(async () => {
    if (!idInformado) {
      window.alert('Salve a pessoa antes de abrir a pasta local.');
      return;
    }
    setAbrindo(true);
    try {
      await abrirPastaPessoaLocalOuFalhar({
        pessoaId: idInformado,
        nomePessoa,
      });
      const status = await verificarLocalHelperAtivo();
      setHelperAtivo(status.ativo);
    } catch (err) {
      if (err instanceof LocalHelperIndisponivelError) {
        window.alert(mensagemLocalHelperIndisponivel(so));
        setHelperAtivo(false);
        return;
      }
      const msg = err?.message || 'Não foi possível abrir a pasta local.';
      onErro?.(msg);
      window.alert(msg);
    } finally {
      setAbrindo(false);
    }
  }, [idInformado, nomePessoa, onErro, so]);

  const desabilitado = disabled || abrindo || !idInformado;
  const rotulo = abrindo ? 'Abrindo…' : 'Pasta local';

  return (
    <button
      type="button"
      className={
        `inline-flex shrink-0 items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs sm:text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 ` +
        `border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 ${className}`.trim()
      }
      disabled={desabilitado}
      onClick={() => void handleClick()}
      title={titulo}
    >
      <HardDrive className="w-4 h-4 shrink-0" aria-hidden />
      <span className="whitespace-nowrap">{rotulo}</span>
      {helperAtivo === false ? (
        <span className="rounded bg-amber-200/90 px-1 py-0.5 text-[9px] font-bold uppercase leading-none text-amber-950">
          off
        </span>
      ) : null}
    </button>
  );
}
