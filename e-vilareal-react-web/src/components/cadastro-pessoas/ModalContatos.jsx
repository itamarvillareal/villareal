import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

const WHATSAPP_GREEN = '#25D366';

const TIPOS_CONTATO = [
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'website', label: 'Website' },
];

function formatarDataHora(isoOuTimestamp) {
  if (!isoOuTimestamp) return '—';
  try {
    const d = typeof isoOuTimestamp === 'string' ? new Date(isoOuTimestamp) : new Date(isoOuTimestamp);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/** Normaliza itens antigos (só tipo/valor) para o formato com histórico */
function normalizarContato(item, index) {
  if (item.dataLancamento != null && item.usuario != null) return item;
  const now = new Date().toISOString();
  return {
    tipo: item.tipo ?? 'email',
    valor: item.valor ?? '',
    dataLancamento: item.dataLancamento ?? now,
    dataAlteracao: item.dataAlteracao ?? now,
    usuario: item.usuario ?? 'Usuário',
  };
}

export function ModalContatos({ open, onClose, contatos, onChange }) {
  const [tipo, setTipo] = useState('email');
  const [valor, setValor] = useState('');
  const [usuario, setUsuario] = useState('Usuário');

  if (!open) return null;

  const lista = (Array.isArray(contatos) ? contatos : []).map(normalizarContato);

  const contagem = {
    telefone: lista.filter((c) => c.tipo === 'telefone').length,
    email: lista.filter((c) => c.tipo === 'email').length,
    website: lista.filter((c) => c.tipo === 'website').length,
  };

  const adicionar = () => {
    const v = valor?.trim();
    const u = usuario?.trim() || 'Usuário';
    if (!v) return;
    if (tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return;
    const now = new Date().toISOString();
    onChange([
      ...lista,
      {
        tipo,
        valor: v,
        dataLancamento: now,
        dataAlteracao: now,
        usuario: u,
      },
    ]);
    setValor('');
  };

  const remover = (index) => {
    onChange(lista.filter((_, i) => i !== index));
  };

  const getPlaceholder = () => {
    if (tipo === 'email') return 'email@exemplo.com';
    if (tipo === 'telefone') return '(00) 00000-0000';
    return 'https://www.exemplo.com';
  };

  const getInputType = () => {
    if (tipo === 'email') return 'email';
    if (tipo === 'website') return 'url';
    return 'tel';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col"
        style={{ height: 'min(90vh, 620px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-800">Contatos</h2>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100">
                <span className="font-medium text-slate-700">{contagem.telefone}</span>
                <span>telefone{contagem.telefone !== 1 ? 's' : ''}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100">
                <span className="font-medium text-slate-700">{contagem.email}</span>
                <span>e-mail{contagem.email !== 1 ? 's' : ''}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100">
                <span className="font-medium text-slate-700">{contagem.website}</span>
                <span>site{contagem.website !== 1 ? 's' : ''}</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col flex-1 min-h-0">
          {/* Formulário adicionar */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4 shrink-0">
            <p className="text-sm font-medium text-slate-700 mb-3">Adicionar contato</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="w-28">
                <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {TIPOS_CONTATO.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-slate-500 mb-1">Valor</label>
                <input
                  type={getInputType()}
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder={getPlaceholder()}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), adicionar())}
                />
              </div>
              <div className="w-36">
                <label className="block text-xs font-medium text-slate-500 mb-1">Registrado por</label>
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Usuário"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={adicionar}
                disabled={!valor?.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Plus className="w-4 h-4" />
                Adicionar contato
              </button>
            </div>
          </div>

          {/* Tabela com altura fixa e rolagem */}
          <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 shrink-0">
              <p className="text-sm font-medium text-slate-700">Histórico de contatos</p>
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700 border-b border-slate-200 w-24">Tipo</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700 border-b border-slate-200 min-w-[140px]">Valor</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700 border-b border-slate-200 w-36">Data lançamento</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700 border-b border-slate-200 w-36">Data alteração</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700 border-b border-slate-200 w-28">Usuário</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-700 border-b border-slate-200 w-24">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {lista.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Nenhum contato. Use o formulário acima para adicionar.
                      </td>
                    </tr>
                  ) : (
                    lista.map((item, index) => (
                      <tr key={index} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-slate-700 font-medium">
                          {TIPOS_CONTATO.find((t) => t.value === item.tipo)?.label ?? item.tipo}
                        </td>
                        <td className="px-4 py-2.5 text-slate-800 truncate max-w-[200px]" title={item.valor}>
                          {item.valor}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                          {formatarDataHora(item.dataLancamento)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                          {formatarDataHora(item.dataAlteracao)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">
                          {item.usuario ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1">
                            {item.tipo === 'telefone' && (
                              <a
                                href={`https://wa.me/55${(item.valor || '').replace(/\D/g, '').slice(0, 11)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-opacity hover:opacity-90"
                                style={{ backgroundColor: WHATSAPP_GREEN }}
                                title="Abrir WhatsApp"
                                aria-label="WhatsApp"
                              >
                                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => remover(index)}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 inline-flex items-center justify-center"
                              title="Remover"
                              aria-label="Remover"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex justify-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
