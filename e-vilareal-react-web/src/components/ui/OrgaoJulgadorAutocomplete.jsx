import { useCallback, useEffect, useRef, useState } from 'react';
import { buscarOrgaosJulgadores } from '../../repositories/orgaosJulgadoresRepository.js';
import { imoveisInputClass } from '../imoveis/ImoveisAdminLayout.jsx';

function formatOrgaoLabel(o) {
  if (!o) return '';
  const mun = o.municipio?.nome ? ` — ${o.municipio.nome}/${o.municipio.uf || ''}` : '';
  const grau = o.grau ? ` [${o.grau}]` : '';
  return `${o.nome || ''}${grau}${mun}`;
}

/**
 * Autocomplete de órgão julgador (TJGO por padrão).
 * Valor: { orgaoJulgadorId, orgaoJulgador } ou null.
 */
export function OrgaoJulgadorAutocomplete({
  value,
  onChange,
  tribunal = 'TJGO',
  uf = 'GO',
  grau,
  tipo,
  disabled = false,
  className = imoveisInputClass,
  placeholder = 'Digite para buscar vara, juizado ou câmara…',
  idPrefix = 'orgao-julgador',
}) {
  const [q, setQ] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const debounceRef = useRef(null);
  const seqRef = useRef(0);

  const labelSelecionado = value?.orgaoJulgador
    ? formatOrgaoLabel(value.orgaoJulgador)
    : value?.orgaoJulgadorId && value?.nome
      ? value.nome
      : '';

  const buscar = useCallback(
    (termo) => {
      seqRef.current += 1;
      const seq = seqRef.current;
      setCarregando(true);
      buscarOrgaosJulgadores({ tribunalSigla: tribunal, q: termo, limit: 20 })
        .then((lista) => {
          if (seq !== seqRef.current) return;
          setSugestoes(Array.isArray(lista) ? lista : []);
          setAberto(true);
        })
        .catch(() => {
          if (seq !== seqRef.current) return;
          setSugestoes([]);
        })
        .finally(() => {
          if (seq === seqRef.current) setCarregando(false);
        });
    },
    [tribunal],
  );

  useEffect(() => {
    if (disabled) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(q.trim()), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, buscar, disabled]);

  function selecionar(o) {
    onChange?.({
      orgaoJulgadorId: o.id,
      orgaoJulgador: o,
    });
    setQ('');
    setAberto(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        className={className}
        disabled={disabled}
        placeholder={labelSelecionado || placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          if (value) onChange?.(null);
        }}
        onFocus={() => {
          if (!disabled) buscar(q.trim());
        }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        autoComplete="off"
        id={`${idPrefix}-input`}
      />
      {labelSelecionado && !q ? (
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
          Selecionado: <strong>{labelSelecionado}</strong>
        </p>
      ) : null}
      {aberto && sugestoes.length > 0 ? (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg text-sm">
          {sugestoes.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/5"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selecionar(o)}
              >
                {formatOrgaoLabel(o)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {carregando ? <span className="text-xs text-slate-400 mt-1 block">Buscando…</span> : null}
    </div>
  );
}

export { formatOrgaoLabel };
