import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { imoveisBtnPrimary, imoveisBtnSecondary, imoveisInputClass } from '../imoveis/ImoveisAdminLayout.jsx';
import { DEMANDA_CATEGORIAS_OPTS, DEMANDA_STATUS_OPTS } from './demandasConstants.js';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';

const emptyForm = () => ({
  imovelId: '',
  clienteId: '',
  clienteNome: '',
  descricao: '',
  categoria: 'MANUTENCAO',
  fornecedorTexto: '',
  status: 'ABERTO',
  geraValorContabil: false,
  valorEstimado: '',
  pagoPeloEscritorio: false,
  reembolsavelCliente: false,
  prazoCumprimento: '',
  prazoFinalizacao: '',
  observacoes: '',
});

export function DemandaFormModal({ open, onClose, onSave, imoveis, initial }) {
  const [form, setForm] = useState(emptyForm);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useCloseOnEscape(open, onClose, { enabled: !salvando });

  useEffect(() => {
    if (!open) return;
    setErro('');
    if (initial) {
      setForm({
        imovelId: String(initial.imovelId ?? ''),
        clienteId: String(initial.clienteId ?? ''),
        clienteNome: initial.clienteNome ?? '',
        descricao: initial.descricao ?? '',
        categoria: initial.categoria ?? 'MANUTENCAO',
        fornecedorTexto: initial.fornecedorTexto ?? '',
        status: initial.status ?? 'ABERTO',
        geraValorContabil: Boolean(initial.geraValorContabil),
        valorEstimado: initial.valorEstimado != null ? String(initial.valorEstimado) : '',
        pagoPeloEscritorio: Boolean(initial.pagoPeloEscritorio),
        reembolsavelCliente: Boolean(initial.reembolsavelCliente),
        prazoCumprimento: initial.prazoCumprimento?.slice?.(0, 10) ?? initial.prazoCumprimento ?? '',
        prazoFinalizacao: initial.prazoFinalizacao?.slice?.(0, 10) ?? initial.prazoFinalizacao ?? '',
        observacoes: initial.observacoes ?? '',
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, initial]);

  if (!open) return null;

  function onImovelChange(imovelId) {
    const im = imoveis.find((i) => String(i.id) === String(imovelId));
    setForm((f) => ({
      ...f,
      imovelId,
      clienteId: im?.clienteId != null ? String(im.clienteId) : '',
      clienteNome: im?.titulo ? `${im.codigoCliente ?? ''} — ${im.titulo}` : '',
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    if (!form.imovelId || !form.clienteId || !form.descricao.trim()) {
      setErro('Preencha imóvel, cliente e descrição.');
      return;
    }
    if (form.geraValorContabil && (!form.valorEstimado || Number(form.valorEstimado) <= 0)) {
      setErro('Informe o valor estimado.');
      return;
    }
    const body = {
      imovelId: Number(form.imovelId),
      clienteId: Number(form.clienteId),
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      fornecedorTexto: form.fornecedorTexto?.trim() || null,
      status: form.status,
      geraValorContabil: form.geraValorContabil,
      valorEstimado: form.geraValorContabil ? Number(form.valorEstimado) : null,
      pagoPeloEscritorio: form.geraValorContabil ? form.pagoPeloEscritorio : false,
      reembolsavelCliente:
        form.geraValorContabil && form.pagoPeloEscritorio ? form.reembolsavelCliente : false,
      prazoCumprimento: form.prazoCumprimento || null,
      prazoFinalizacao: form.prazoFinalizacao || null,
      observacoes: form.observacoes?.trim() || null,
    };
    setSalvando(true);
    try {
      await onSave(body);
      onClose();
    } catch (err) {
      setErro(err?.message ?? 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog">
      <div className="bg-white dark:bg-[#141c2c] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10">
          <h2 className="text-lg font-semibold">{initial ? 'Editar demanda' : 'Nova demanda'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
          <label className="block text-sm">
            <span className="font-medium">Imóvel *</span>
            <select
              className={`${imoveisInputClass} mt-1`}
              value={form.imovelId}
              onChange={(ev) => onImovelChange(ev.target.value)}
              required
            >
              <option value="">Selecione…</option>
              {imoveis.map((im) => (
                <option key={im.id} value={im.id}>
                  {im.numeroPlanilha != null ? `#${im.numeroPlanilha} — ` : ''}
                  {im.titulo || im.enderecoCompleto || `Imóvel ${im.id}`}
                </option>
              ))}
            </select>
          </label>
          {form.clienteId ? (
            <p className="text-xs text-slate-500">Cliente (auto): ID {form.clienteId}</p>
          ) : null}
          <label className="block text-sm">
            <span className="font-medium">Descrição *</span>
            <textarea className={`${imoveisInputClass} mt-1`} rows={3} value={form.descricao} onChange={(ev) => setForm((f) => ({ ...f, descricao: ev.target.value }))} required />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Categoria *</span>
            <select className={`${imoveisInputClass} mt-1`} value={form.categoria} onChange={(ev) => setForm((f) => ({ ...f, categoria: ev.target.value }))}>
              {DEMANDA_CATEGORIAS_OPTS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Fornecedor</span>
            <input className={`${imoveisInputClass} mt-1`} value={form.fornecedorTexto} onChange={(ev) => setForm((f) => ({ ...f, fornecedorTexto: ev.target.value }))} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Status</span>
            <select className={`${imoveisInputClass} mt-1`} value={form.status} onChange={(ev) => setForm((f) => ({ ...f, status: ev.target.value }))}>
              {DEMANDA_STATUS_OPTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.geraValorContabil} onChange={(ev) => setForm((f) => ({ ...f, geraValorContabil: ev.target.checked }))} />
            Gera valor contábil
          </label>
          {form.geraValorContabil ? (
            <>
              <label className="block text-sm">
                <span className="font-medium">Valor estimado (R$)</span>
                <input type="number" step="0.01" min="0" className={`${imoveisInputClass} mt-1`} value={form.valorEstimado} onChange={(ev) => setForm((f) => ({ ...f, valorEstimado: ev.target.value }))} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.pagoPeloEscritorio} onChange={(ev) => setForm((f) => ({ ...f, pagoPeloEscritorio: ev.target.checked }))} />
                Pago pelo escritório
              </label>
              {form.pagoPeloEscritorio ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.reembolsavelCliente} onChange={(ev) => setForm((f) => ({ ...f, reembolsavelCliente: ev.target.checked }))} />
                  Reembolsável pelo cliente
                </label>
              ) : null}
            </>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium">Prazo cumprimento</span>
              <input type="date" className={`${imoveisInputClass} mt-1`} value={form.prazoCumprimento} onChange={(ev) => setForm((f) => ({ ...f, prazoCumprimento: ev.target.value }))} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Prazo finalização</span>
              <input type="date" className={`${imoveisInputClass} mt-1`} value={form.prazoFinalizacao} onChange={(ev) => setForm((f) => ({ ...f, prazoFinalizacao: ev.target.value }))} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium">Observações</span>
            <textarea className={`${imoveisInputClass} mt-1`} rows={2} value={form.observacoes} onChange={(ev) => setForm((f) => ({ ...f, observacoes: ev.target.value }))} />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={imoveisBtnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={imoveisBtnPrimary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
