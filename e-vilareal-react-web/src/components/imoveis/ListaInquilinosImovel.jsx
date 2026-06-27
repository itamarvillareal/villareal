import { useCallback, useState } from 'react';
import { Plus, Trash2, UserRound } from 'lucide-react';
import { SeletorPessoaParteImovel } from './SeletorPessoaParteImovel.jsx';
import { formatDocBrExibicao, imoveisBtnSecondary } from './ImoveisAdminLayout.jsx';

function rotuloInquilino(f) {
  const n = String(f?.pessoaId ?? '').trim();
  const nm = String(f?.nome ?? '').trim();
  if (n && nm) return `#${n} · ${nm}`;
  if (nm) return nm;
  if (n) return `#${n}`;
  return '—';
}

/**
 * @param {{
 *   inquilinos: Array<{ pessoaId?: string, nome?: string, cpf?: string, contato?: string }>,
 *   onChange: (inquilinos: Array<{ pessoaId?: string, nome?: string, cpf?: string, contato?: string }>) => void,
 *   onPersistir?: (inquilinos: Array<{ pessoaId?: string, nome?: string, cpf?: string, contato?: string }>) => void | Promise<void>,
 *   disabled?: boolean,
 * }} props
 */
export function ListaInquilinosImovel({ inquilinos, onChange, onPersistir, disabled = false }) {
  const lista = Array.isArray(inquilinos) ? inquilinos : [];
  const [pessoaPendente, setPessoaPendente] = useState(null);
  const [seletorKey, setSeletorKey] = useState(0);

  const jaCadastrado = useCallback(
    (pessoaId) => lista.some((f) => String(f.pessoaId ?? '') === String(pessoaId)),
    [lista],
  );

  const persistirLista = useCallback(
    async (novaLista) => {
      onChange(novaLista);
      if (onPersistir) {
        await onPersistir(novaLista);
      }
    },
    [onChange, onPersistir],
  );

  const adicionar = useCallback(
    (pessoa) => {
      if (!pessoa?.id || disabled) return;
      const id = String(pessoa.id);
      if (jaCadastrado(id)) return;
      const novaLista = [
        ...lista,
        {
          pessoaId: id,
          nome: String(pessoa.nome ?? '').trim(),
          cpf: String(pessoa.cpf ?? '').trim(),
          contato: String(pessoa.telefone ?? pessoa.contato ?? '').trim(),
        },
      ];
      setPessoaPendente(null);
      setSeletorKey((k) => k + 1);
      void persistirLista(novaLista);
    },
    [disabled, jaCadastrado, lista, persistirLista],
  );

  const selecionarPendente = useCallback((pessoa) => {
    if (!pessoa?.id) return;
    setPessoaPendente({
      id: Number(pessoa.id),
      nome: pessoa.nome ?? '',
      cpf: pessoa.cpf ?? '',
      telefone: pessoa.telefone ?? '',
    });
  }, []);

  const remover = useCallback(
    (idx) => {
      void persistirLista(lista.filter((_, i) => i !== idx));
    },
    [lista, persistirLista],
  );

  return (
    <div className="space-y-4">
      {lista.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Nenhum inquilino cadastrado. Inquilinos cadastrados aqui são sincronizados com a parte oposta do processo vinculado.
        </p>
      ) : (
        <ul className="space-y-3">
          {lista.map((f, idx) => (
            <li
              key={`${f.pessoaId}-${idx}`}
              className="flex items-start gap-3 rounded-xl border border-teal-200/70 dark:border-teal-500/25 bg-teal-50/40 dark:bg-teal-950/20 p-4"
            >
              <div className="w-10 h-10 rounded-full bg-teal-500 text-white flex items-center justify-center shrink-0" aria-hidden>
                <UserRound className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">{rotuloInquilino(f)}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                  {f.cpf?.trim() ? formatDocBrExibicao(String(f.cpf).replace(/\D/g, '')) : '—'}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remover(idx)}
                className={`${imoveisBtnSecondary} shrink-0 text-red-700 dark:text-red-300`}
                title="Remover inquilino"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="max-w-lg">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
          Adicionar inquilino
        </p>
        <div className="flex gap-2 items-end">
          <div className="flex-1 min-w-0">
            <SeletorPessoaParteImovel
              key={seletorKey}
              disabled={disabled}
              onChange={selecionarPendente}
            />
            {pessoaPendente ? (
              <p
                className={`text-xs mt-2 ${
                  jaCadastrado(pessoaPendente.id)
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-teal-700 dark:text-teal-300'
                }`}
              >
                Selecionado: {rotuloInquilino({ pessoaId: pessoaPendente.id, nome: pessoaPendente.nome })}
                {jaCadastrado(pessoaPendente.id) ? ' · já cadastrado' : ' · clique + para incluir'}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={disabled || !pessoaPendente?.id || jaCadastrado(pessoaPendente.id)}
            onClick={() => adicionar(pessoaPendente)}
            className="inline-flex items-center justify-center gap-1.5 h-[42px] w-[42px] rounded-xl text-white bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 shadow-sm active:scale-[0.99] transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none shrink-0"
            title="Incluir inquilino"
            aria-label="Incluir inquilino"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
