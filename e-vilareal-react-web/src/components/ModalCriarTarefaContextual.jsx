import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, ListTodo } from 'lucide-react';
import { featureFlags } from '../config/featureFlags.js';
import { getUsuariosAtivos } from '../data/agendaPersistenciaData.js';
import { getNomeExibicaoUsuario } from '../data/usuarioDisplayHelpers.js';
import { buscarClientePorCodigo } from '../repositories/processosRepository.js';
import { criarTarefaOperacional } from '../repositories/tarefasOperacionaisRepository.js';

const MSG_SUCESSO =
  'Tarefa criada com sucesso. Ela aparecerá no board de Pendências após atualizar a lista (ou ao abrir a tela).';

/**
 * Modal leve: cria tarefa operacional com vínculos opcionais (ação explícita do usuário).
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {object|null} context — retorno de `buildContextFrom*` em `tarefasContextualPayload.js`
 * @param {(payload?: object) => void} [onCreated] — após sucesso na API (resposta opcional)
 */
export function ModalCriarTarefaContextual({ open, onClose, context, onCreated }) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState('NORMAL');
  const [dataLimite, setDataLimite] = useState('');
  const [responsavelUsuarioId, setResponsavelUsuarioId] = useState('');
  const [clienteIdResolvido, setClienteIdResolvido] = useState(null);
  const [resolvendoCliente, setResolvendoCliente] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (!open || !context) return;
    setTitulo(String(context.tituloInicial ?? ''));
    setDescricao(String(context.descricaoInicial ?? ''));
    setPrioridade('NORMAL');
    setDataLimite(context.dataLimiteInicial ? String(context.dataLimiteInicial) : '');
    setResponsavelUsuarioId('');
    setClienteIdResolvido(null);
    setResolvendoCliente(false);
    setErro('');
    setSucesso(false);
  }, [open, context]);

  useEffect(() => {
    const cod = String(context?.codigoCliente ?? '').trim();
    if (!open || !cod) {
      setResolvendoCliente(false);
      setClienteIdResolvido(null);
      return;
    }
    const jaTemCliente =
      context?.clienteId != null && Number.isFinite(Number(context.clienteId)) && Number(context.clienteId) > 0;
    if (jaTemCliente) {
      setResolvendoCliente(false);
      setClienteIdResolvido(null);
      return;
    }
    if (!featureFlags.useApiProcessos) {
      setResolvendoCliente(false);
      setClienteIdResolvido(null);
      return;
    }
    let ativo = true;
    setResolvendoCliente(true);
    void buscarClientePorCodigo(cod).then((c) => {
      if (!ativo) return;
      setClienteIdResolvido(c?.id ?? null);
      setResolvendoCliente(false);
    });
    return () => {
      ativo = false;
    };
  }, [open, context?.codigoCliente, context?.clienteId]);

  const preview = useMemo(() => {
    if (!context) return null;
    const pid =
      context.processoId != null && Number.isFinite(Number(context.processoId)) && Number(context.processoId) > 0
        ? Number(context.processoId)
        : null;
    const cidDireto =
      context.clienteId != null && Number.isFinite(Number(context.clienteId)) && Number(context.clienteId) > 0
        ? Number(context.clienteId)
        : null;
    const cidFallback =
      clienteIdResolvido != null && Number.isFinite(Number(clienteIdResolvido)) && Number(clienteIdResolvido) > 0
        ? Number(clienteIdResolvido)
        : null;
    const cidEfetivo = cidDireto ?? cidFallback;
    const clienteOrigemLabel = cidDireto
      ? context.kind === 'publicacao'
        ? 'publicação (API)'
        : 'processo (API)'
      : cidFallback
        ? 'código do cliente (API)'
        : null;
    const pub =
      context.publicacaoId != null && Number.isFinite(Number(context.publicacaoId)) && Number(context.publicacaoId) > 0
        ? Number(context.publicacaoId)
        : null;
    const prazo =
      context.processoPrazoId != null &&
      Number.isFinite(Number(context.processoPrazoId)) &&
      Number(context.processoPrazoId) > 0
        ? Number(context.processoPrazoId)
        : null;
    const dl = String(dataLimite ?? '').trim();
    return {
      processoId: pid,
      clienteId: cidEfetivo,
      clienteOrigemLabel,
      publicacaoId: pub,
      processoPrazoId: prazo,
      dataLimite: dl || null,
    };
  }, [context, clienteIdResolvido, dataLimite]);

  async function handleSalvar(e) {
    e.preventDefault();
    if (!featureFlags.useApiTarefas) {
      setErro('Ative VITE_USE_API_TAREFAS para criar tarefas na API.');
      return;
    }
    const t = String(titulo ?? '').trim();
    if (!t) {
      setErro('Informe o título.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const body = {
        titulo: t,
        descricao: String(descricao ?? '').trim() || null,
        origem: 'MANUAL',
        prioridade: prioridade || 'NORMAL',
      };
      const rid = String(responsavelUsuarioId ?? '').trim();
      if (rid) body.responsavelUsuarioId = Number(rid);

      if (preview?.processoId) body.processoId = preview.processoId;
      if (preview?.clienteId) body.clienteId = preview.clienteId;
      if (preview?.publicacaoId) body.publicacaoId = preview.publicacaoId;
      if (preview?.processoPrazoId) body.processoPrazoId = preview.processoPrazoId;

      if (preview?.dataLimite) body.dataLimite = preview.dataLimite;

      const resp = await criarTarefaOperacional(body);
      if (resp == null && !featureFlags.useApiTarefas) {
        setErro('API de tarefas indisponível.');
        return;
      }
      try {
        window.dispatchEvent(new CustomEvent('vilareal:tarefas-criada', { detail: { kind: context?.kind } }));
      } catch {
        /* ignore */
      }
      setSucesso(true);
      onCreated?.(resp ?? body);
    } catch (err) {
      setErro(err?.message || 'Não foi possível criar a tarefa. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (!open || !context) return null;

  const usuarios = getUsuariosAtivos() || [];
  const origem = context.sourceLabel || 'Contexto';
  const ehPrazoFatal = context.kind === 'processo_prazo';
  const legadoTexto = context.apenasTextoContextual === true;

  function linhaVinculo(label, valor, enviado) {
    return (
      <li className="flex flex-wrap gap-x-1 justify-between">
        <span>{label}</span>
        <span className={enviado ? 'text-emerald-800 dark:text-emerald-200 font-medium' : 'text-slate-400'}>
          {enviado ? valor : 'não enviado'}
        </span>
      </li>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141c2c] shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ListTodo className="w-4 h-4 shrink-0" />
            Nova tarefa
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSalvar} className="p-4 space-y-3 text-sm">
          <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-black/25 px-3 py-2 text-[11px] space-y-2">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-200">Origem</span>
              <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                {origem}
                {ehPrazoFatal ? ' · data limite sugerida a partir do prazo fatal' : ''}
              </p>
            </div>
            {legadoTexto ? (
              <p className="text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-500/30 rounded px-2 py-1.5">
                Modo somente texto: nenhum vínculo estruturado (processo/publicação/cliente) será enviado — apenas título,
                descrição e campos opcionais abaixo. O bloco de descrição traz o contexto para referência.
              </p>
            ) : null}
            {context.aviso ? (
              <p className="text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 rounded px-2 py-1.5">
                {context.aviso}
              </p>
            ) : null}
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-200">Vínculos na API</span>
              <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5 mb-1">
                Campos enviados em <code className="text-[10px]">POST /api/tarefas</code> quando houver id válido. Título e
                descrição são sempre texto livre.
              </p>
              {resolvendoCliente && String(context.codigoCliente ?? '').trim() && !context.clienteId ? (
                <p className="text-[10px] text-slate-500 mb-1">Resolvendo cliente pelo código…</p>
              ) : null}
              <ul className="space-y-0.5 text-slate-600 dark:text-slate-400">
                {linhaVinculo('Processo', preview?.processoId != null ? `#${preview.processoId}` : '—', preview?.processoId != null)}
                {linhaVinculo(
                  'Cliente',
                  preview?.clienteId != null
                    ? `#${preview.clienteId}${preview?.clienteOrigemLabel ? ` (${preview.clienteOrigemLabel})` : ''}`
                    : '—',
                  preview?.clienteId != null
                )}
                {linhaVinculo('Publicação', preview?.publicacaoId != null ? `#${preview.publicacaoId}` : '—', preview?.publicacaoId != null)}
                {linhaVinculo(
                  'Prazo processual',
                  preview?.processoPrazoId != null ? `#${preview.processoPrazoId}` : '— (não disponível na UI)',
                  preview?.processoPrazoId != null
                )}
                {linhaVinculo('Data limite', preview?.dataLimite || '—', Boolean(preview?.dataLimite))}
              </ul>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Título</span>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Descrição</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={5}
              className="mt-0.5 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2 resize-y min-h-[100px]"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Responsável</span>
              {featureFlags.useApiTarefas && !featureFlags.useApiUsuarios ? (
                <p className="mt-0.5 mb-1 text-[10px] leading-snug text-slate-600 dark:text-slate-400">
                  Com a API de usuários desligada, esta lista vem do cadastro local do navegador. Os IDs podem não existir no
                  servidor — para homologação (F1–F5), prefira deixar <strong className="font-medium">(opcional)</strong> salvo
                  que você confira o ID no banco.
                </p>
              ) : null}
              <select
                value={responsavelUsuarioId}
                onChange={(e) => setResponsavelUsuarioId(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2"
              >
                <option value="">(opcional)</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {getNomeExibicaoUsuario(u)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Prioridade</span>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2"
              >
                <option value="BAIXA">Baixa</option>
                <option value="NORMAL">Normal</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Data limite</span>
            <input
              type="date"
              value={dataLimite}
              onChange={(e) => setDataLimite(e.target.value)}
              className="mt-0.5 w-full max-w-[12rem] rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2"
            />
          </label>

          {erro ? <p className="text-xs text-red-600 dark:text-red-400">{erro}</p> : null}
          {sucesso ? <p className="text-xs text-emerald-700 dark:text-emerald-300">{MSG_SUCESSO}</p> : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/15 text-sm"
            >
              {sucesso ? 'Fechar' : 'Cancelar'}
            </button>
            {!sucesso ? (
              <button
                type="submit"
                disabled={salvando || resolvendoCliente}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Salvar tarefa
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
