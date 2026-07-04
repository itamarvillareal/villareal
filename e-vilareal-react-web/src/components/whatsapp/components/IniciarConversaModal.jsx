import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, MessageSquarePlus, Search, X } from 'lucide-react';
import { pesquisarCadastroPessoasPorNomeOuCpf } from '../../../api/clientesService.js';
import {
  getJanelaAberta,
  getTelefonesIniciarConversa,
  sendWhatsAppTemplate,
  sendWhatsAppText,
} from '../../../repositories/whatsappRepository.js';
import { rotuloPessoaComDocumento } from '../../../services/qualificacaoContratualHelper.js';
import {
  formatDateTimeBR,
  formatPhoneDisplay,
  isValidBrazilPhone,
  normalizePhoneForApi,
} from '../../../utils/whatsappFormat.js';
import {
  buildComposePreviewText,
  FREE_TEXT_DELIVERY_ERROR,
} from '../../../utils/whatsappTemplateUtils.js';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';
import { processosBtnPrimary, processosInputClass } from '../../processos/ProcessosAdminLayout.jsx';
import { MessageComposePreview } from './MessageComposePreview.jsx';
import { TemplateParamsForm, TemplateSelect } from './TemplateParamsForm.jsx';
import { useWhatsAppTemplates } from '../hooks/useWhatsAppTemplates.js';
import { findWhatsAppTemplate } from '../../../data/whatsappTemplates.js';

function rotuloTelefoneOpcao(t) {
  const parts = [formatPhoneDisplay(t.numeroCanonico)];
  if (t.label) parts.push(`(${t.label})`);
  if (t.principal) parts.push('· principal');
  return parts.join(' ');
}

export function IniciarConversaModal({ open, onClose, onSuccess }) {
  const { templates, loading: loadingTemplates } = useWhatsAppTemplates({ approvedOnly: true });

  const [termoPessoa, setTermoPessoa] = useState('');
  const [buscandoPessoa, setBuscandoPessoa] = useState(false);
  const [resultadosPessoa, setResultadosPessoa] = useState([]);
  const [listaPessoaAberta, setListaPessoaAberta] = useState(false);
  const [pessoa, setPessoa] = useState(null);

  const [carregandoTelefones, setCarregandoTelefones] = useState(false);
  const [telefones, setTelefones] = useState([]);
  const [clienteId, setClienteId] = useState(null);
  const [contactName, setContactName] = useState('');
  const [telefoneSelecionado, setTelefoneSelecionado] = useState(null);
  const [telefoneManual, setTelefoneManual] = useState('');
  const [usarManual, setUsarManual] = useState(false);

  const [carregandoJanela, setCarregandoJanela] = useState(false);
  const [janela, setJanela] = useState(null);

  const [mode, setMode] = useState('template');
  const [message, setMessage] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [params, setParams] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const pessoaRef = useRef(null);

  useCloseOnEscape(open, onClose, { enabled: !sending });

  const reset = useCallback(() => {
    setTermoPessoa('');
    setResultadosPessoa([]);
    setListaPessoaAberta(false);
    setPessoa(null);
    setTelefones([]);
    setClienteId(null);
    setContactName('');
    setTelefoneSelecionado(null);
    setTelefoneManual('');
    setUsarManual(false);
    setJanela(null);
    setMode('template');
    setMessage('');
    setTemplateName('');
    setParams([]);
    setError('');
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

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

  useEffect(() => {
    const tpl = templates.find((t) => t.value === templateName) ?? findWhatsAppTemplate(templateName);
    setParams(tpl ? tpl.params.map(() => '') : []);
  }, [templateName, templates]);

  const phoneCanonico = useMemo(() => {
    if (usarManual) {
      const n = normalizePhoneForApi(telefoneManual);
      return isValidBrazilPhone(telefoneManual) ? n : '';
    }
    return telefoneSelecionado?.numeroCanonico ?? '';
  }, [usarManual, telefoneManual, telefoneSelecionado]);

  useEffect(() => {
    if (!phoneCanonico) {
      setJanela(null);
      return undefined;
    }

    let cancelado = false;
    setCarregandoJanela(true);
    void getJanelaAberta(phoneCanonico)
      .then((res) => {
        if (cancelado) return;
        setJanela(res);
        setMode(res?.janelaAberta ? 'texto' : 'template');
      })
      .catch(() => {
        if (!cancelado) setJanela({ janelaAberta: false, ultimaInboundAt: null });
      })
      .finally(() => {
        if (!cancelado) setCarregandoJanela(false);
      });

    return () => {
      cancelado = true;
    };
  }, [phoneCanonico]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.value === templateName) ?? findWhatsAppTemplate(templateName),
    [templates, templateName],
  );

  const previewText = useMemo(
    () =>
      buildComposePreviewText({
        mode: mode === 'texto' ? 'texto' : 'template',
        message,
        template: selectedTemplate,
        params,
      }),
    [mode, message, selectedTemplate, params],
  );

  const selecionarPessoa = async (p) => {
    setPessoa(p);
    setTermoPessoa('');
    setListaPessoaAberta(false);
    setTelefones([]);
    setTelefoneSelecionado(null);
    setUsarManual(false);
    setTelefoneManual('');
    setError('');

    const pessoaId = Number(p.id);
    if (!Number.isFinite(pessoaId)) return;

    setCarregandoTelefones(true);
    try {
      const res = await getTelefonesIniciarConversa({ pessoaId });
      const lista = Array.isArray(res?.telefones) ? res.telefones : [];
      setTelefones(lista);
      setClienteId(res?.clienteId ?? null);
      setContactName(res?.contactName ?? p.nome ?? '');

      if (lista.length === 1) {
        setTelefoneSelecionado(lista[0]);
      }
    } catch (err) {
      setError(err?.message || 'Erro ao buscar telefones da pessoa.');
    } finally {
      setCarregandoTelefones(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!phoneCanonico) {
      setError('Selecione ou informe um telefone válido.');
      return;
    }

    if (mode === 'texto') {
      if (!janela?.janelaAberta) {
        setError('Texto livre não disponível — use um template.');
        return;
      }
      if (!message.trim()) {
        setError('Digite a mensagem.');
        return;
      }
    } else if (!templateName) {
      setError('Selecione um template.');
      return;
    }

    const vinculo = clienteId != null ? { clienteId } : {};

    setSending(true);
    try {
      if (mode === 'texto') {
        const res = await sendWhatsAppText(phoneCanonico, message.trim(), vinculo);
        if (res?.success === false) {
          setError(res.error || FREE_TEXT_DELIVERY_ERROR);
          return;
        }
      } else {
        const res = await sendWhatsAppTemplate(
          phoneCanonico,
          templateName,
          'pt_BR',
          params.map((p) => String(p ?? '').trim()),
          vinculo,
        );
        if (res?.success === false) {
          setError(res.error || 'Falha ao enviar template.');
          return;
        }
      }
      onSuccess?.(phoneCanonico, contactName);
      onClose?.();
    } catch (err) {
      setError(err?.message || FREE_TEXT_DELIVERY_ERROR);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const janelaFechada = janela && !janela.janelaAberta;
  const podeTextoLivre = janela?.janelaAberta === true;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="iniciar-conversa-titulo"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 gap-2">
          <h2 id="iniciar-conversa-titulo" className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-emerald-600" aria-hidden />
            Nova conversa
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pessoa */}
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
                  className="text-xs text-emerald-800 hover:underline"
                  onClick={() => {
                    setPessoa(null);
                    setTelefones([]);
                    setTelefoneSelecionado(null);
                    setUsarManual(false);
                    setJanela(null);
                  }}
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
                    onChange={(e) => {
                      setTermoPessoa(e.target.value);
                      setListaPessoaAberta(true);
                    }}
                    onFocus={() => setListaPessoaAberta(true)}
                    placeholder="Digite nome ou CPF…"
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
                              <span className="block text-xs text-slate-500">{p.telefone}</span>
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

          {pessoa && !carregandoTelefones && telefones.length === 0 && !usarManual ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-100">
              Esta pessoa não tem telefone cadastrado.
            </p>
          ) : null}

          {pessoa && telefones.length > 1 && !usarManual ? (
            <fieldset>
              <legend className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                Escolha o telefone
              </legend>
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
                      name="telefone-iniciar"
                      checked={telefoneSelecionado?.numeroCanonico === t.numeroCanonico}
                      onChange={() => setTelefoneSelecionado(t)}
                    />
                    {rotuloTelefoneOpcao(t)}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {pessoa && (telefones.length === 0 || usarManual) ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Telefone manual
              </label>
              <input
                type="tel"
                className={processosInputClass}
                value={telefoneManual}
                onChange={(e) => setTelefoneManual(e.target.value)}
                placeholder="(62) 99999-1234"
              />
              {telefones.length > 0 ? (
                <button
                  type="button"
                  className="text-xs text-emerald-700 mt-1 hover:underline"
                  onClick={() => {
                    setUsarManual(false);
                    setTelefoneManual('');
                  }}
                >
                  Usar telefone do cadastro
                </button>
              ) : null}
            </div>
          ) : null}

          {pessoa && telefones.length === 0 && !usarManual ? (
            <button
              type="button"
              className="text-sm text-emerald-700 hover:underline"
              onClick={() => setUsarManual(true)}
            >
              Informar número manualmente
            </button>
          ) : null}

          {phoneCanonico && carregandoJanela ? (
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Verificando janela de conversa…
            </p>
          ) : null}

          {phoneCanonico && janelaFechada && !carregandoJanela ? (
            <div
              className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
              role="status"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" aria-hidden />
              <div>
                <p>
                  Este contato não respondeu nas últimas 24 horas. Pela política do WhatsApp, só é possível
                  iniciar com um modelo (template) aprovado.
                </p>
                {janela.ultimaInboundAt ? (
                  <p className="text-xs mt-1 opacity-80">
                    Última resposta: {formatDateTimeBR(janela.ultimaInboundAt)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {phoneCanonico && !carregandoJanela ? (
            <>
              {podeTextoLivre ? (
                <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setMode('texto')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                      mode === 'texto' ? 'bg-white dark:bg-slate-900 shadow-sm text-emerald-700' : 'text-slate-600'
                    }`}
                  >
                    Texto livre
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('template')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                      mode === 'template' ? 'bg-white dark:bg-slate-900 shadow-sm text-emerald-700' : 'text-slate-600'
                    }`}
                  >
                    Template
                  </button>
                </div>
              ) : null}

              {mode === 'texto' && podeTextoLivre ? (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Mensagem</label>
                  <textarea
                    className={`${processosInputClass} min-h-[100px] resize-y`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 4096))}
                    maxLength={4096}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <TemplateSelect
                    value={templateName}
                    onChange={setTemplateName}
                    id="iniciar-conversa-template"
                    templates={templates}
                    loading={loadingTemplates}
                  />
                  <TemplateParamsForm
                    templateName={templateName}
                    values={params}
                    onChange={setParams}
                    templates={templates}
                  />
                </div>
              )}

              <MessageComposePreview
                compact
                text={previewText}
                templateName={mode === 'template' && templateName ? templateName : null}
                emptyHint={
                  mode === 'template'
                    ? 'Selecione um template e preencha os parâmetros.'
                    : 'Digite a mensagem para ver o preview.'
                }
              />
            </>
          ) : null}

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending || !phoneCanonico || carregandoJanela}
              className={processosBtnPrimary}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Enviar e abrir conversa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
