import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, RefreshCw, Send, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from '../financeiro/shared/ConfirmDialog.jsx';
import { useWhatsAppToast } from './WhatsAppToast.jsx';
import { useWhatsAppTemplates } from './hooks/useWhatsAppTemplates.js';
import {
  createWhatsAppTemplate,
  deleteWhatsAppTemplate,
} from '../../repositories/whatsappRepository.js';
import {
  detectTemplateParameters,
  fillTemplatePreview,
  isValidTemplateName,
} from '../../utils/whatsappTemplateUtils.js';
import { processosBtnPrimary, processosBtnSecondary, processosInputClass } from '../processos/ProcessosAdminLayout.jsx';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';

const REFRESH_MS = 30_000;

function statusBadgeClass(status) {
  const s = String(status ?? '').toUpperCase();
  if (s === 'APPROVED') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (s === 'PENDING') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  }
  if (s === 'REJECTED') {
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function highlightParams(text) {
  if (!text) return '—';
  const parts = String(text).split(/(\{\{\d+\}\})/g);
  return parts.map((part, i) =>
    /^\{\{\d+\}\}$/.test(part) ? (
      <span key={i} className="font-semibold text-emerald-700 dark:text-emerald-300">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function TemplateCard({ template, onUse, onDelete }) {
  const status = String(template.status ?? '').toUpperCase();
  const isRejected = status === 'REJECTED';
  const isApproved = status === 'APPROVED';

  return (
    <article
      className={`rounded-xl border p-4 shadow-sm ${
        isRejected
          ? 'border-red-200 bg-red-50/40 opacity-80 dark:border-red-900/40 dark:bg-red-950/20'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 font-mono text-sm">{template.value}</h3>
          <div className="flex flex-wrap gap-2 mt-1">
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusBadgeClass(status)}`}>
              {status || '—'}
            </span>
            {template.category ? (
              <span className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {template.category}
              </span>
            ) : null}
            <span className="text-[10px] text-slate-500">
              {template.params?.length ?? 0} parâmetro{(template.params?.length ?? 0) !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {isApproved ? (
            <button
              type="button"
              onClick={() => onUse(template.value)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Send className="w-3.5 h-3.5" aria-hidden />
              Usar
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onDelete(template.value)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden />
            Deletar
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
        {highlightParams(template.bodyText)}
      </p>
    </article>
  );
}

function CreateTemplateModal({ open, onClose, onCreated }) {
  const toast = useWhatsAppToast();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('UTILITY');
  const [bodyText, setBodyText] = useState('');
  const [exampleValues, setExampleValues] = useState([]);
  const [saving, setSaving] = useState(false);

  useCloseOnEscape(open, onClose, { enabled: !saving });

  const paramIndices = useMemo(() => detectTemplateParameters(bodyText), [bodyText]);
  const preview = useMemo(
    () => fillTemplatePreview(bodyText, exampleValues),
    [bodyText, exampleValues],
  );

  useEffect(() => {
    if (!open) {
      setName('');
      setCategory('UTILITY');
      setBodyText('');
      setExampleValues([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    setExampleValues((prev) => {
      const next = [...prev];
      while (next.length < paramIndices.length) next.push('');
      return next.slice(0, paramIndices.length);
    });
  }, [paramIndices.length]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!isValidTemplateName(trimmedName)) {
      toast.error('Nome inválido: use apenas letras minúsculas, números e underscore.');
      return;
    }
    if (!bodyText.trim()) {
      toast.error('Informe o corpo da mensagem.');
      return;
    }
    if (exampleValues.length !== paramIndices.length) {
      toast.error('Preencha os valores de exemplo para todos os parâmetros.');
      return;
    }
    if (paramIndices.length > 0 && exampleValues.some((v) => !String(v ?? '').trim())) {
      toast.error('Todos os valores de exemplo são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      await createWhatsAppTemplate(
        trimmedName,
        category,
        bodyText.trim(),
        exampleValues.map((v) => String(v ?? '').trim()),
      );
      toast.success('Template criado! Aguardando aprovação da Meta.');
      onCreated?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Falha ao criar template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Novo template</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nome do template</label>
            <input
              type="text"
              className={processosInputClass}
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="aviso_pagamento"
            />
            <p className="text-[11px] text-slate-500 mt-1">Use apenas letras minúsculas, números e _ (ex: aviso_pagamento)</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Categoria</label>
            <select className={processosInputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="UTILITY">Utility</option>
              <option value="MARKETING">Marketing</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">Utility tem aprovação mais rápida e custo menor</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Corpo da mensagem</label>
            <textarea
              className={`${processosInputClass} min-h-[120px] resize-y`}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Olá {{1}}, bem-vindo ao escritório Villa Real…"
            />
            <p className="text-[11px] text-slate-500 mt-1">Use {'{{1}}'}, {'{{2}}'}, {'{{3}}'} para parâmetros variáveis</p>
          </div>
          {paramIndices.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/80 dark:bg-slate-800/40">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Valores de exemplo</p>
              {paramIndices.map((index, i) => (
                <div key={index}>
                  <label className="block text-xs text-slate-500 mb-1">{`Exemplo para {{${index}}}:`}</label>
                  <input
                    type="text"
                    className={processosInputClass}
                    value={exampleValues[i] ?? ''}
                    onChange={(e) => {
                      const next = [...exampleValues];
                      next[i] = e.target.value;
                      setExampleValues(next);
                    }}
                    placeholder={index === 1 ? 'João Silva' : 'Valor de exemplo'}
                  />
                </div>
              ))}
            </div>
          ) : null}
          {bodyText.trim() ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300 mb-1">
                Preview
              </p>
              <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{preview}</p>
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={processosBtnSecondary}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} className={processosBtnPrimary}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Criar template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function WhatsAppTemplates() {
  const navigate = useNavigate();
  const toast = useWhatsAppToast();
  const { allTemplates, loading, error, reload } = useWhatsAppTemplates({ autoRefreshMs: REFRESH_MS });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteName, setDeleteName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { approved, pending, rejected, other } = useMemo(() => {
    const a = [];
    const p = [];
    const r = [];
    const o = [];
    for (const t of allTemplates) {
      const s = String(t.status ?? '').toUpperCase();
      if (s === 'APPROVED') a.push(t);
      else if (s === 'PENDING') p.push(t);
      else if (s === 'REJECTED') r.push(t);
      else o.push(t);
    }
    return { approved: a, pending: p, rejected: r, other: o };
  }, [allTemplates]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteName) return;
    setDeleting(true);
    try {
      await deleteWhatsAppTemplate(deleteName);
      toast.success('Template deletado.');
      setDeleteName('');
      await reload();
    } catch (err) {
      toast.error(err?.message || 'Falha ao deletar template.');
    } finally {
      setDeleting(false);
    }
  };

  const renderSection = (title, items) => {
    if (!items.length) return null;
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((t) => (
            <TemplateCard
              key={t.id || t.value}
              template={t}
              onUse={(name) => navigate('/whatsapp/enviar', { state: { templateName: name } })}
              onDelete={setDeleteName}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Templates de mensagem</h2>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie templates aprovados pela Meta Business.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className={processosBtnSecondary}
          >
            {refreshing || loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Atualizar
          </button>
          <button type="button" onClick={() => setModalOpen(true)} className={processosBtnPrimary}>
            <Plus className="w-4 h-4" />
            Novo template
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
          {error} — exibindo fallback local quando aplicável.
        </p>
      ) : null}

      {loading && allTemplates.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Carregando templates…
        </div>
      ) : allTemplates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-10 text-center text-sm text-slate-500">
          Nenhum template encontrado na Meta. Crie um novo template para começar.
        </div>
      ) : (
        <div className="space-y-8">
          {renderSection('Aprovados', approved)}
          {renderSection('Aguardando aprovação', pending)}
          {renderSection('Rejeitados', rejected)}
          {renderSection('Outros', other)}
        </div>
      )}

      <CreateTemplateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => reload()}
      />

      <ConfirmDialog
        open={Boolean(deleteName)}
        title="Deletar template"
        message={`Remover o template "${deleteName}" da Meta? Esta ação não pode ser desfeita.`}
        confirmLabel={deleting ? 'Deletando…' : 'Deletar'}
        danger
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteName('')}
      />
    </div>
  );
}
