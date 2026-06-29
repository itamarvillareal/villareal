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
  const inputFocusedRef = useRef(false);

  const fecharLista = useCallback(() => {
    setAberto(false);
    setSugestoes([]);
  }, []);

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

  const labelSelecionado = useMemo(() => {
    if (value?.municipio) return formatMunicipioLabel(value.municipio);
    if (value?.municipioId && value?.nome) return formatMunicipioLabel(value);
    return '';
  }, [value]);

  const buscar = useCallback((termo, ufAtual) => {
    seqRef.current += 1;
    const seq = seqRef.current;
    setCarregando(true);
    buscarMunicipios({ uf: ufAtual, q: termo, limit: 20 })
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
  }, []);

  useEffect(() => {
    if (disabled) return undefined;
    const termo = q.trim();
    if (!termo) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      buscar(termo, uf);
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
    fecharLista();
  }

  function alterarUf(sigla) {
    setUf(sigla);
    onUfChange?.(sigla);
    onChange?.(null);
    setQ('');
    fecharLista();
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
            if (disabled) return;
            inputFocusedRef.current = true;
            const termo = q.trim();
            if (!termo && labelSelecionado) return;
            buscar(termo, uf);
          }}
          onBlur={() => {
            inputFocusedRef.current = false;
            window.setTimeout(() => fecharLista(), 150);
          }}
          autoComplete="off"
        />
        {aberto && sugestoes.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-lg dark:border-white/10 dark:bg-slate-900">
            {sugestoes.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/5"
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

export { formatMunicipioLabel };
