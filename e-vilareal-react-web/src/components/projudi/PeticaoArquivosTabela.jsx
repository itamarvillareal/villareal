import { FileText, Loader2, Trash2 } from 'lucide-react';

const TIPOS_ARQUIVO = [
  { id: 16, label: 'Petição' },
  { id: 1, label: 'Outros' },
];

export function labelTipoArquivoPeticao(id) {
  return TIPOS_ARQUIVO.find((t) => t.id === id)?.label || `Tipo ${id}`;
}

export function formatDateTimePeticao(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

function statusPeticaoExcluivel(status) {
  return status === 'PENDENTE_ASSINATURA' || status === 'ASSINADA' || status === 'ERRO';
}

export function podeExcluirArquivoPeticao(peticao, arquivo) {
  if (!statusPeticaoExcluivel(peticao?.status)) return false;
  if (arquivo?.id == null) return false;
  return arquivo.status === 'PENDENTE_ASSINATURA' || arquivo.status === 'ASSINADO';
}

function podeExcluirArquivo(peticao, arquivo) {
  return podeExcluirArquivoPeticao(peticao, arquivo);
}

export function podeExcluirPeticao(peticao) {
  if (!statusPeticaoExcluivel(peticao?.status)) return false;
  const arquivos = peticao?.arquivos || [];
  return arquivos.length > 0 && arquivos.every((a) => podeExcluirArquivoPeticao(peticao, a));
}

/**
 * Linha compacta de arquivo com botão de exclusão individual.
 * @param {{
 *   peticao: import('../../api/peticoesProjudiApi.js').ProjudiPeticao,
 *   arquivo: import('../../api/peticoesProjudiApi.js').ProjudiPeticaoArquivo,
 *   operacao?: string | null,
 *   bloqueado?: boolean,
 *   onExcluir?: (peticaoId: number, arquivoId: number, nome: string) => void,
 * }} props
 */
export function PeticaoArquivoLinhaExcluir({ peticao, arquivo, operacao = null, bloqueado = false, onExcluir }) {
  const excluivel = podeExcluirArquivoPeticao(peticao, arquivo) && onExcluir;
  const chave = `excluir-arq-${peticao.id}-${arquivo.id}`;
  const excluindo = operacao === chave;

  return (
    <div className="flex items-center gap-1 text-xs text-slate-600 min-w-0">
      <span className="truncate flex-1" title={arquivo.nomeOriginal || undefined}>
        {arquivo.nomeOriginal} ({labelTipoArquivoPeticao(arquivo.idArquivoTipo)})
      </span>
      {excluivel ? (
        <button
          type="button"
          className="shrink-0 p-0.5 text-rose-600 hover:text-rose-800 disabled:opacity-50"
          disabled={bloqueado || !!operacao}
          onClick={() => onExcluir(peticao.id, arquivo.id, arquivo.nomeOriginal || 'arquivo')}
          title="Excluir este arquivo"
          aria-label={`Excluir ${arquivo.nomeOriginal || 'arquivo'}`}
        >
          {excluindo ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="w-3.5 h-3.5" aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   peticoes: import('../../api/peticoesProjudiApi.js').ProjudiPeticao[],
 *   excluindo?: string | null,
 *   onExcluirArquivo?: (peticaoId: number, arquivoId: number, nome: string) => void,
 *   onExcluirPeticao?: (peticaoId: number, numeroProcesso: string) => void,
 *   compact?: boolean,
 * }} props
 */
export function PeticaoArquivosTabela({
  peticoes,
  excluindo = null,
  onExcluirArquivo,
  onExcluirPeticao,
  compact = false,
}) {
  const linhas = [];
  for (const p of peticoes) {
    for (const a of p.arquivos || []) {
      linhas.push({ peticao: p, arquivo: a });
    }
  }

  if (linhas.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum arquivo registrado.</p>;
  }

  const thClass = compact
    ? 'px-2 py-1.5 font-medium'
    : 'px-3 py-2 font-medium';
  const tdClass = compact ? 'px-2 py-1.5' : 'px-3 py-2';

  return (
    <div className="rounded-lg border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-xs text-slate-600 uppercase tracking-wide">
          <tr>
            <th className={thClass}>Processo</th>
            <th className={thClass}>Petição</th>
            <th className={thClass}>Arquivo</th>
            <th className={thClass}>Tipo</th>
            <th className={thClass}>Status</th>
            <th className={thClass}>Enviado em</th>
            <th className={`${thClass} text-right`}>Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {linhas.map(({ peticao: p, arquivo: a }) => {
            const chave = `${p.id}-${a.id ?? a.ordem}`;
            const excluivel = podeExcluirArquivo(p, a);
            const excluindoEsta = excluindo === chave;
            return (
              <tr key={chave} className="hover:bg-slate-50/80">
                <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>{p.numeroProcesso}</td>
                <td className={tdClass}>
                  <span className="font-medium">#{p.id}</span>
                  {p.complemento ? (
                    <span className="block text-xs text-slate-500 truncate max-w-[12rem]" title={p.complemento}>
                      {p.complemento}
                    </span>
                  ) : null}
                </td>
                <td className={tdClass}>
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                    <span className="truncate max-w-[14rem]" title={a.nomeOriginal || undefined}>
                      {a.nomeOriginal || '—'}
                    </span>
                  </span>
                </td>
                <td className={`${tdClass} text-xs`}>{labelTipoArquivoPeticao(a.idArquivoTipo)}</td>
                <td className={tdClass}>
                  <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs">{a.status}</span>
                </td>
                <td className={`${tdClass} text-xs text-slate-500 whitespace-nowrap`}>
                  {formatDateTimePeticao(a.criadoEm || p.criadoEm)}
                </td>
                <td className={`${tdClass} text-right whitespace-nowrap`}>
                  {excluivel && onExcluirArquivo ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      disabled={!!excluindo}
                      title="Excluir arquivo"
                      onClick={() => onExcluirArquivo(p.id, a.id, a.nomeOriginal || 'arquivo')}
                    >
                      {excluindoEsta ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Excluir
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {peticoes.some((p) => podeExcluirPeticao(p)) && onExcluirPeticao ? (
        <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2 flex flex-wrap gap-2">
          {peticoes
            .filter((p) => podeExcluirPeticao(p))
            .map((p) => {
              const chavePet = `pet-${p.id}`;
              const excluindoPet = excluindo === chavePet;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  disabled={!!excluindo}
                  onClick={() => onExcluirPeticao(p.id, p.numeroProcesso)}
                >
                  {excluindoPet ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Excluir petição #{p.id} inteira
                </button>
              );
            })}
        </div>
      ) : null}
    </div>
  );
}
