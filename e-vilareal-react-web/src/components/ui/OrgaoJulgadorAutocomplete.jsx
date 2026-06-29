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
  municipioId,
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
  const inputFocusedRef = useRef(false);

  const fecharLista = useCallback(() => {
    setAberto(false);
    setSugestoes([]);
  }, []);

  const labelSelecionado = value?.orgaoJulgador
    ? formatOrgaoLabel(value.orgaoJulgador)
    : value?.orgaoJulgadorId && value?.nome
      ? value.nome
      : '';

  useEffect(() => {
    if (disabled) fecharLista();
  }, [disabled, fecharLista]);

  useEffect(() => {
    const onScroll = () => {
      if (inputFocusedRef.current) return;
      fecharLista();
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [fecharLista]);

  useEffect(
    () => () => {
      seqRef.current += 1;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const buscar = useCallback(
    (termo) => {
      seqRef.current += 1;
      const seq = seqRef.current;
      setCarregando(true);
      buscarOrgaosJulgadores({ tribunalSigla: tribunal, municipioId, q: termo, limit: 20 })
        .then((lista) => {
          if (seq !== seqRef.current) return;
          const rows = Array.isArray(lista) ? lista : [];
          setSugestoes(rows);
          if (inputFocusedRef.current && rows.length > 0) setAberto(true);
          else if (!inputFocusedRef.current) setAberto(false);
        })
        .catch(() => {
          if (seq !== seqRef.current) return;
          setSugestoes([]);
          setAberto(false);
        })
        .finally(() => {
          if (seq === seqRef.current) setCarregando(false);
        });
    },
    [tribunal, municipioId]
  );

  useEffect(() => {
    if (disabled) return undefined;
    const termo = q.trim();
    if (!termo) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(termo), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, buscar, disabled]);

  useEffect(() => {
    fecharLista();
    setQ('');
  }, [municipioId, fecharLista]);

  function selecionar(o) {
    onChange?.({
      orgaoJulgadorId: o.id,
      orgaoJulgador: o,
    });
    setQ('');
    fecharLista();
  }

  return (
    <div className="space-y-1">
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
            if (disabled) return;
            inputFocusedRef.current = true;
            const termo = q.trim();
            if (!termo && labelSelecionado) return;
            buscar(termo);
          }}
          onBlur={() => {
            inputFocusedRef.current = false;
            window.setTimeout(() => fecharLista(), 150);
          }}
          autoComplete="off"
          id={`${idPrefix}-input`}
        />
        {aberto && sugestoes.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-lg dark:border-white/10 dark:bg-slate-900">
            {sugestoes.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/5"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selecionar(o)}
                >
                  {formatOrgaoLabel(o)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {carregando ? (
          <span className="absolute left-0 top-full z-20 mt-1 block text-xs text-slate-400">Buscando…</span>
        ) : null}
      </div>
      {labelSelecionado && !q ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Selecionado: <strong>{labelSelecionado}</strong>
        </p>
      ) : null}
    </div>
  );
}

export { formatOrgaoLabel };
