import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/** @param {{ rua?: string, bairro?: string, cidade?: string, estado?: string, municipio?: { nome?: string, uf?: string }, cep?: string }} endereco */
export function formatarEnderecoParteUi(endereco) {
  if (!endereco) return 'Endereço';
  const partes = [
    endereco.rua,
    endereco.bairro,
    endereco.cidade || endereco.municipio?.nome,
    endereco.estado || endereco.municipio?.uf,
    endereco.cep ? `CEP ${endereco.cep}` : '',
  ]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean);
  return partes.join(' — ') || 'Endereço';
}

/**
 * @param {{
 *   aberto: boolean,
 *   nomePessoa?: string,
 *   enderecos: Array<{ id: number, rua?: string, bairro?: string, cidade?: string, estado?: string, municipio?: object, cep?: string, numero?: number }>,
 *   enderecoSelecionadoId?: number|null,
 *   onConfirmar: (pessoaEnderecoId: number) => void,
 *   onCancelar: () => void,
 * }} props
 */
export function ModalEscolherEnderecoParte({
  aberto,
  nomePessoa,
  enderecos,
  enderecoSelecionadoId,
  onConfirmar,
  onCancelar,
}) {
  const [selecionado, setSelecionado] = useState(null);

  useEffect(() => {
    if (!aberto) return;
    const inicial = Number(enderecoSelecionadoId);
    if (Number.isFinite(inicial) && inicial > 0) {
      setSelecionado(inicial);
      return;
    }
    const primeiro = Number(enderecos?.[0]?.id);
    setSelecionado(Number.isFinite(primeiro) && primeiro > 0 ? primeiro : null);
  }, [aberto, enderecoSelecionadoId, enderecos]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-escolher-endereco-titulo"
      onClick={onCancelar}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id="modal-escolher-endereco-titulo" className="text-base font-semibold text-slate-800">
              Escolher endereço
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {nomePessoa
                ? `${nomePessoa} possui mais de um endereço. Selecione qual usar nesta demanda (petições, procuração, declarações etc.).`
                : 'Esta pessoa possui mais de um endereço. Selecione qual usar nesta demanda.'}
            </p>
          </div>
          <button
            type="button"
            className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Fechar"
            onClick={onCancelar}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-4 py-3">
          <ul className="space-y-2">
            {(enderecos || []).map((end) => {
              const id = Number(end.id);
              const checked = selecionado === id;
              return (
                <li key={id}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                      checked
                        ? 'border-blue-400 bg-blue-50/70'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="endereco-parte"
                      className="mt-1"
                      checked={checked}
                      onChange={() => setSelecionado(id)}
                    />
                    <span className="min-w-0 text-slate-800">{formatarEnderecoParteUi(end)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!Number.isFinite(Number(selecionado)) || Number(selecionado) < 1}
            onClick={() => onConfirmar(Number(selecionado))}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
