import { useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { pesquisarCadastroPessoasPorNomeOuCpf } from '../../../api/clientesService.js';
import { getTelefonesIniciarConversa } from '../../../repositories/whatsappRepository.js';
import { rotuloPessoaComDocumento } from '../../../services/qualificacaoContratualHelper.js';
import { formatPhoneDisplay, formatPhoneFromContato, normalizePhoneForApi } from '../../../utils/whatsappFormat.js';
import { processosInputClass } from '../../processos/ProcessosAdminLayout.jsx';

function rotuloTelefoneOpcao(t) {
  const parts = [formatPhoneDisplay(t.numeroCanonico)];
  if (t.label) parts.push(`(${t.label})`);
  if (t.principal) parts.push('· principal');
  return parts.join(' ');
}

/**
 * Busca pessoa por nome/CPF e preenche o telefone destino, ou permite digitar o número manualmente.
 */
export function WhatsAppDestinatarioCampo({ phone, onPhoneChange, disabled = false }) {
  const [pessoa, setPessoa] = useState(null);
  const [termoPessoa, setTermoPessoa] = useState('');
  const [resultadosPessoa, setResultadosPessoa] = useState([]);
  const [listaPessoaAberta, setListaPessoaAberta] = useState(false);
  const [buscandoPessoa, setBuscandoPessoa] = useState(false);
  const [carregandoTelefones, setCarregandoTelefones] = useState(false);
  const [telefones, setTelefones] = useState([]);
  const [telefoneSelecionado, setTelefoneSelecionado] = useState(null);
  const pessoaRef = useRef(null);

  useEffect(() => {
    const t = termoPessoa.trim();
    if (!t || pessoa) {
      setResultadosPessoa([]);
      setBuscandoPessoa(false);
      return undefined;
    }

    let cancelado = false;
    const timer = window.setTimeout(async () => {
      setBuscandoPessoa(true);
      try {
        const arr = await pesquisarCadastroPessoasPorNomeOuCpf(t, { apenasAtivos: false, limite: 25 });
        if (!cancelado) setResultadosPessoa(Array.isArray(arr) ? arr : []);
      } catch {
        if (!cancelado) setResultadosPessoa([]);
      } finally {
        if (!cancelado) setBuscandoPessoa(false);
      }
    }, 280);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [termoPessoa, pessoa]);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (pessoaRef.current && !pessoaRef.current.contains(e.target)) {
        setListaPessoaAberta(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const aplicarTelefoneCanonico = (numeroCanonico) => {
    const n = normalizePhoneForApi(numeroCanonico);
    onPhoneChange?.(n ? formatPhoneFromContato(n) : '');
  };

  const selecionarPessoa = async (p) => {
    setPessoa(p);
    setTermoPessoa('');
    setListaPessoaAberta(false);
    setTelefones([]);
    setTelefoneSelecionado(null);

    const pessoaId = Number(p.id);
    if (!Number.isFinite(pessoaId)) return;

    setCarregandoTelefones(true);
    try {
      const res = await getTelefonesIniciarConversa({ pessoaId });
      const lista = Array.isArray(res?.telefones) ? res.telefones : [];
      setTelefones(lista);

      if (lista.length === 1) {
        setTelefoneSelecionado(lista[0]);
        aplicarTelefoneCanonico(lista[0].numeroCanonico);
      } else if (lista.length === 0 && p.telefone) {
        aplicarTelefoneCanonico(p.telefone);
      } else if (lista.length > 1) {
        const principal = lista.find((t) => t.principal) ?? lista[0];
        setTelefoneSelecionado(principal);
        aplicarTelefoneCanonico(principal.numeroCanonico);
      }
    } finally {
      setCarregandoTelefones(false);
    }
  };

  const limparPessoa = () => {
    setPessoa(null);
    setTelefones([]);
    setTelefoneSelecionado(null);
    onPhoneChange?.('');
  };

  return (
    <div className="space-y-3">
      <div ref={pessoaRef} className="relative">
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
          Buscar pessoa (nome ou CPF)
        </label>
        {pessoa ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {rotuloPessoaComDocumento(pessoa)}
            </span>
            <button
              type="button"
              disabled={disabled}
              className="text-xs text-emerald-800 hover:underline disabled:opacity-50"
              onClick={limparPessoa}
            >
              Trocar
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
              <input
                type="search"
                className={`${processosInputClass} pl-9`}
                value={termoPessoa}
                disabled={disabled}
                onChange={(e) => {
                  setTermoPessoa(e.target.value);
                  setListaPessoaAberta(true);
                }}
                onFocus={() => setListaPessoaAberta(true)}
                placeholder="Ex.: Arnaldo Noronha ou CPF"
                autoComplete="off"
              />
            </div>
            {listaPessoaAberta && termoPessoa.trim() ? (
              <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
                {buscandoPessoa ? (
                  <li className="px-3 py-2 text-sm text-slate-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Buscando…
                  </li>
                ) : resultadosPessoa.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-slate-500">Nenhuma pessoa encontrada.</li>
                ) : (
                  resultadosPessoa.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                        onClick={() => void selecionarPessoa(p)}
                      >
                        <span className="font-medium">{rotuloPessoaComDocumento(p)}</span>
                        {p.telefone ? (
                          <span className="block text-xs text-slate-500">{formatPhoneFromContato(p.telefone)}</span>
                        ) : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </>
        )}
      </div>

      {pessoa && carregandoTelefones ? (
        <p className="text-sm text-slate-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando telefones…
        </p>
      ) : null}

      {pessoa && !carregandoTelefones && telefones.length > 1 ? (
        <fieldset>
          <legend className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Telefone</legend>
          <div className="space-y-2">
            {telefones.map((t) => (
              <label
                key={t.numeroCanonico}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm ${
                  telefoneSelecionado?.numeroCanonico === t.numeroCanonico
                    ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="telefone-enviar"
                  disabled={disabled}
                  checked={telefoneSelecionado?.numeroCanonico === t.numeroCanonico}
                  onChange={() => {
                    setTelefoneSelecionado(t);
                    aplicarTelefoneCanonico(t.numeroCanonico);
                  }}
                />
                {rotuloTelefoneOpcao(t)}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Telefone
          </label>
          <input
            type="tel"
            className={processosInputClass}
            value={phone}
            disabled={disabled}
            onChange={(e) => {
              if (pessoa) limparPessoa();
              onPhoneChange?.(e.target.value);
            }}
            placeholder="(62) 99999-1234 ou busque pelo nome acima"
          />
        </div>
      )}
    </div>
  );
}
