import { useCallback, useEffect, useState } from 'react';
import { Bell, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import {
  copiarDestinatariosCanais,
  destinatariosVazio,
  normalizarDestinatariosParaSalvar,
  validarDestinatariosAntesSalvar,
} from '../../domain/destinatariosNotificacao.js';
import {
  getDestinatariosProcesso,
  putDestinatariosProcesso,
  removerDestinatariosProcesso,
} from '../../repositories/notificacaoRepository.js';
import {
  processosBtnGhost,
  processosBtnIndigo,
  processosBtnOutlineIndigo,
  processosBtnSecondary,
} from '../processos/ProcessosAdminLayout.jsx';
import { DestinatariosEditor } from './DestinatariosEditor.jsx';

/**
 * Destinatários adicionais do processo (união com os padrões globais na notificação).
 * @param {{ processoApiId?: number|string|null }} props
 */
export function DestinatariosProcessoSecao({ processoApiId }) {
  const procId = Number(processoApiId);
  const habilitado = Number.isFinite(procId) && procId > 0;

  const [adicionais, setAdicionais] = useState(destinatariosVazio);
  const [temAdicionais, setTemAdicionais] = useState(false);
  const [draft, setDraft] = useState(destinatariosVazio);
  const [editando, setEditando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async () => {
    if (!habilitado) {
      setAdicionais(destinatariosVazio());
      setTemAdicionais(false);
      setDraft(destinatariosVazio());
      setEditando(false);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const dto = await getDestinatariosProcesso(procId);
      const extras = copiarDestinatariosCanais(dto?.override);
      setAdicionais(extras);
      setTemAdicionais(Boolean(dto?.personalizado));
      setDraft(extras);
      setEditando(false);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar destinatários adicionais.');
    } finally {
      setCarregando(false);
    }
  }, [habilitado, procId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  if (!habilitado) {
    return null;
  }

  const editorValor = editando ? draft : adicionais;
  const editorReadOnly = !editando;
  const vazio =
    (!adicionais.email?.length && !adicionais.whatsapp?.length) && !editando;

  function iniciarEdicao() {
    setDraft(copiarDestinatariosCanais(adicionais));
    setEditando(true);
    setErro('');
  }

  function cancelarEdicao() {
    setEditando(false);
    setErro('');
    setDraft(copiarDestinatariosCanais(adicionais));
  }

  async function salvar() {
    const { ok, erros } = validarDestinatariosAntesSalvar(draft);
    if (!ok) {
      setErro(erros.join(' '));
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const body = normalizarDestinatariosParaSalvar(draft);
      await putDestinatariosProcesso(procId, body);
      setEditando(false);
      await recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar destinatários adicionais.');
    } finally {
      setSalvando(false);
    }
  }

  async function removerAdicionais() {
    const ok = window.confirm(
      'Remover todos os destinatários adicionais deste processo?\n\nAs notificações continuarão indo apenas para os padrões globais (Configurações no painel).',
    );
    if (!ok) return;
    setSalvando(true);
    setErro('');
    try {
      await removerDestinatariosProcesso(procId);
      setEditando(false);
      await recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao remover adicionais.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section
      className="rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-[#0d1018]/80 px-3 py-3"
      aria-labelledby="destinatarios-adicionais-titulo"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3
          id="destinatarios-adicionais-titulo"
          className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"
        >
          <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden />
          Destinatários adicionais deste processo
          {temAdicionais ? (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200">
              <Sparkles className="w-3 h-3" aria-hidden />
              Configurado
            </span>
          ) : null}
        </h3>
        {!editando ? (
          <button
            type="button"
            className={processosBtnOutlineIndigo}
            disabled={carregando || salvando}
            onClick={iniciarEdicao}
          >
            {vazio ? 'Adicionar' : 'Editar'}
          </button>
        ) : null}
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
        E-mails e WhatsApp listados aqui são somados aos destinatários padrão do escritório (em
        «Configurações» no painel Consultas periódicas). Não substituem o padrão.
      </p>

      {erro ? (
        <p className="mb-2 text-xs text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/30 px-2 py-1.5">
          {erro}
        </p>
      ) : null}

      {carregando ? (
        <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 py-2">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Carregando…
        </p>
      ) : (
        <>
          {vazio && !editando ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Nenhum adicional — apenas os padrões globais recebem alertas deste processo.
            </p>
          ) : null}
          <DestinatariosEditor
            value={editorValor}
            onChange={editorReadOnly ? undefined : setDraft}
            readOnly={editorReadOnly}
          />
          {editando ? (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                className={processosBtnIndigo}
                disabled={salvando}
                onClick={() => void salvar()}
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
                Salvar adicionais
              </button>
              <button
                type="button"
                className={processosBtnSecondary}
                disabled={salvando}
                onClick={cancelarEdicao}
              >
                Cancelar
              </button>
            </div>
          ) : temAdicionais ? (
            <div className="mt-2">
              <button
                type="button"
                className={processosBtnGhost}
                disabled={salvando}
                onClick={() => void removerAdicionais()}
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden />
                Remover adicionais deste processo
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
