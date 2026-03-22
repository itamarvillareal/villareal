import { useMemo, useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { rotuloPessoaComDocumento, inferirTipoPessoaPorDocumento } from '../../services/qualificacaoContratualHelper.js';

/**
 * Busca e seleção de outra pessoa cadastrada como responsável / representante.
 * @param {object} props
 * @param {Array<{id:number|string,nome?:string,cpf?:string}>} props.pessoas - lista completa (ex.: cadastro)
 * @param {number|string|null|undefined} props.valueId - ID da pessoa responsável ou vazio
 * @param {(id: number|null, snapshot: object|null) => void} props.onChange - snapshot: { id, nome, cpf, tipoPessoa }
 * @param {number|string|null|undefined} props.excluirId - não oferecer a própria ficha em edição
 * @param {boolean} props.disabled
 * @param {string} [props.className]
 */
export function SeletorResponsavelPessoa({
  pessoas = [],
  valueId,
  onChange,
  excluirId,
  disabled,
  className = '',
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const rootRef = useRef(null);

  const idExcl = excluirId != null && excluirId !== '' ? Number(excluirId) : null;

  const candidatos = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return (pessoas || []).filter((p) => {
      const id = Number(p.id);
      if (!Number.isFinite(id) || id < 1) return false;
      if (idExcl != null && id === idExcl) return false;
      if (!t) return true;
      const nome = String(p.nome ?? '').toLowerCase();
      const cpf = String(p.cpf ?? '').replace(/\D/g, '');
      const idStr = String(p.id);
      return nome.includes(t) || cpf.includes(t.replace(/\D/g, '')) || idStr.includes(t);
    });
  }, [pessoas, termo, idExcl]);

  const selecionada = useMemo(() => {
    const vid = valueId != null && valueId !== '' ? Number(valueId) : null;
    if (vid == null || !Number.isFinite(vid)) return null;
    return (pessoas || []).find((p) => Number(p.id) === vid) ?? null;
  }, [pessoas, valueId]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setAberto(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selecionar(p) {
    const id = Number(p.id);
    const snapshot = {
      id,
      nome: p.nome ?? '',
      cpf: p.cpf ?? '',
      tipoPessoa: p.tipoPessoa ?? inferirTipoPessoaPorDocumento(p.cpf),
    };
    onChange(id, snapshot);
    setTermo('');
    setAberto(false);
  }

  function limpar() {
    onChange(null, null);
    setTermo('');
    setAberto(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Pessoa responsável / representante
        <span className="text-slate-400 font-normal"> (opcional)</span>
      </label>
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <div className="flex rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
            <span className="pl-2 flex items-center text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              disabled={disabled}
              placeholder="Buscar por nome, CPF/CNPJ ou código…"
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value);
                setAberto(true);
              }}
              onFocus={() => setAberto(true)}
              className="w-full px-2 py-2 text-sm border-0 focus:ring-0 disabled:bg-slate-100"
            />
          </div>
          {aberto && !disabled && candidatos.length > 0 && (
            <ul
              className="absolute z-40 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg text-sm"
              role="listbox"
            >
              {candidatos.slice(0, 50).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-800"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selecionar(p)}
                  >
                    {rotuloPessoaComDocumento(p)}
                    <span className="text-slate-400 text-xs ml-1">#{p.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {(valueId != null && valueId !== '') || selecionada ? (
          <button
            type="button"
            disabled={disabled}
            onClick={limpar}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
            title="Remover vínculo de responsável"
          >
            <X className="w-4 h-4" />
            Limpar
          </button>
        ) : null}
      </div>
      {selecionada && (
        <p className="text-xs text-slate-600 mt-1.5">
          Vínculo atual: <strong>{rotuloPessoaComDocumento(selecionada)}</strong>
        </p>
      )}
      <p className="text-xs text-slate-500 mt-1">
        Vincule outro cadastro como representante legal, sócio administrador, tutor, curador etc.
      </p>
    </div>
  );
}
