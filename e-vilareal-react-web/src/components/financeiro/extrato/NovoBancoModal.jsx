import { useState } from 'react';
import { X } from 'lucide-react';
import {
  loadPersistedContasExtrasFinanceiro,
  proximoNumeroContaBanco,
  savePersistedContasExtrasFinanceiro,
  validarNovoNomeContaBancaria,
} from '../../../data/financeiroData.js';

export function NovoBancoModal({ open, onClose, onCreated }) {
  const [nome, setNome] = useState('');
  const [numeroManual, setNumeroManual] = useState('');
  const [tipo, setTipo] = useState('banco');
  const [erro, setErro] = useState('');

  if (!open) return null;

  const handleSalvar = () => {
    setErro('');
    if (tipo === 'cartao') {
      setErro('Cartões são gerenciados em Configuração. Escolha tipo Banco para conta corrente.');
      return;
    }
    const extras = loadPersistedContasExtrasFinanceiro();
    const v = validarNovoNomeContaBancaria(nome, extras);
    if (!v.ok) {
      setErro(v.message);
      return;
    }
    const numero =
      numeroManual.trim() !== '' ? Number(numeroManual) : proximoNumeroContaBanco(extras);
    if (!Number.isFinite(numero) || numero < 1) {
      setErro('Número inválido.');
      return;
    }
    if (extras.some((c) => c.numero === numero)) {
      setErro('Este número já está em uso.');
      return;
    }
    const novo = { nome: v.nome, numero };
    const next = [...extras, novo].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    savePersistedContasExtrasFinanceiro(next);
    onCreated?.(novo);
    setNome('');
    setNumeroManual('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Adicionar novo banco</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Nome</span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
              placeholder="Ex.: Banco XYZ"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Número (identificador único)</span>
            <input
              type="number"
              min={1}
              value={numeroManual}
              onChange={(e) => setNumeroManual(e.target.value)}
              placeholder="Automático se vazio"
              className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
            />
          </label>
          <fieldset className="text-sm text-slate-800 dark:text-slate-200">
            <legend className="text-slate-600 dark:text-slate-400 mb-1">Tipo</legend>
            <label className="inline-flex items-center gap-1.5 mr-4">
              <input type="radio" checked={tipo === 'banco'} onChange={() => setTipo('banco')} />
              Banco
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" checked={tipo === 'cartao'} onChange={() => setTipo('cartao')} />
              Cartão
            </label>
          </fieldset>
          {erro ? <p className="text-sm text-red-600 dark:text-red-400">{erro}</p> : null}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
