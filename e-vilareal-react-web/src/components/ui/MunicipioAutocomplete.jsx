import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buscarMunicipios, listarEstados } from '../../repositories/municipiosRepository.js';
import { imoveisInputClass } from '../imoveis/ImoveisAdminLayout.jsx';

function formatMunicipioLabel(m) {
  if (!m) return '';
  const uf = m.uf ? ` (${m.uf})` : '';
  return `${m.nome || ''}${uf}`;
}

/**
 * Autocomplete de município IBGE: UF + busca por nome (debounce).
 * Valor controlado: { municipioId, municipio, uf } ou null.
 */
export function MunicipioAutocomplete({
  value,
  onChange,
  uf: ufProp,
  onUfChange,
  disabled = false,
  className = imoveisInputClass,
  placeholder = 'Digite para buscar o município…',
  idPrefix = 'municipio',
}) {
  const [estados, setEstados] = useState([]);
  const [uf, setUf] = useState(ufProp || value?.municipio?.uf || value?.uf || 'GO');
  const [q, setQ] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const debounceRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => {
    let cancel = false;
    listarEstados()
      .then((lista) => {
        if (!cancel) setEstados(Array.isArray(lista) ? lista : []);
      })
      .catch(() => {
        if (!cancel) setEstados([]);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (ufProp != null && ufProp !== uf) {
      setUf(ufProp);
    }
  }, [ufProp, uf]);

  const labelSelecionado = useMemo(() => {
    if (value?.municipio) return formatMunicipioLabel(value.municipio);
    if (value?.municipioId && value?.nome) return formatMunicipioLabel(value);
    return '';
  }, [value]);

  const buscar = useCallback(
    (termo, ufAtual) => {
      seqRef.current += 1;
      const seq = seqRef.current;
      setCarregando(true);
      buscarMunicipios({ uf: ufAtual, q: termo, limit: 20 })
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
    [],
  );

  useEffect(() => {
    if (disabled) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      buscar(q.trim(), uf);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, uf, buscar, disabled]);

  function selecionar(m) {
    const next = {
      municipioId: m.id,
      municipio: { id: m.id, nome: m.nome, uf: m.uf },
      uf: m.uf,
      nome: m.nome,
    };
    onChange?.(next);
    setQ('');
    setAberto(false);
  }

  function alterarUf(sigla) {
    setUf(sigla);
    onUfChange?.(sigla);
    onChange?.(null);
    setQ('');
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-xs text-slate-500 dark:text-slate-400" htmlFor={`${idPrefix}-uf`}>
          UF
        </label>
        <select
          id={`${idPrefix}-uf`}
          className={`${className} w-auto min-w-[5rem]`}
          value={uf || ''}
          disabled={disabled}
          onChange={(e) => alterarUf(e.target.value)}
        >
          {estados.map((e) => (
            <option key={e.sigla} value={e.sigla}>
              {e.sigla}
            </option>
          ))}
        </select>
      </div>
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
            if (!disabled) buscar(q.trim(), uf);
          }}
          onBlur={() => {
            setTimeout(() => setAberto(false), 150);
          }}
          autoComplete="off"
        />
        {labelSelecionado && !q ? (
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Selecionado: <strong>{labelSelecionado}</strong>
          </p>
        ) : null}
        {aberto && sugestoes.length > 0 ? (
          <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg text-sm">
            {sugestoes.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/5"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selecionar(m)}
                >
                  {formatMunicipioLabel(m)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {carregando ? (
          <span className="text-xs text-slate-400 mt-1 block">Buscando…</span>
        ) : null}
      </div>
    </div>
  );
}

export { formatMunicipioLabel };
