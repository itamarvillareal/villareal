import { useEffect, useState } from 'react';
import { ChevronLeft, MessageCircle, Plus, Star, Trash2, X } from 'lucide-react';
import { featureFlags } from '../config/featureFlags.js';
import { padCliente8Cadastro } from '../data/cadastroClientesStorage.js';
import {
  importarWhatsAppDaPessoa,
  listarClienteWhatsApp,
  salvarClienteWhatsApp,
} from '../repositories/clienteWhatsAppRepository.js';
import { resolverClienteCadastroPorCodigo } from '../repositories/clientesRepository.js';
import { formatPhoneDisplay, isValidBrazilPhone, normalizePhoneForApi } from '../utils/whatsappFormat.js';

const WHATSAPP_GREEN = '#25D366';

function itemVazio() {
  return {
    numero: '',
    nomeLabel: '',
    principal: false,
    preenchidoAutomaticamente: false,
    ativo: true,
    pessoaId: null,
    pessoaContatoId: null,
  };
}

/**
 * Modal para cadastrar números WhatsApp que recebem comunicações automáticas do escritório.
 * Os números são independentes de pessoa_contato após o vínculo inicial.
 */
export function ModalWhatsAppCliente({
  open,
  codigoCliente,
  nomeCliente,
  pessoaId,
  onClose,
  onImportouDaPessoa,
}) {
  const [itens, setItens] = useState([]);
  const [clientePk, setClientePk] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [novoNumero, setNovoNumero] = useState('');
  const [novoLabel, setNovoLabel] = useState('');

  useEffect(() => {
    if (!open || !codigoCliente) return undefined;
    let cancelled = false;
    setErro('');
    setCarregando(true);

    (async () => {
      try {
        const cod = padCliente8Cadastro(codigoCliente);
        let pk = null;
        if (featureFlags.useApiClientes) {
          const resolved = await resolverClienteCadastroPorCodigo(cod);
          pk = resolved?.clienteId ?? resolved?.id ?? null;
        }
        if (cancelled) return;
        setClientePk(pk);
        const lista = await listarClienteWhatsApp(pk, cod);
        if (!cancelled) setItens(Array.isArray(lista) ? lista : []);
      } catch (e) {
        if (!cancelled) setErro(e?.message || 'Falha ao carregar números WhatsApp.');
      } finally {
        if (!cancelled) setCarregando(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, codigoCliente]);

  if (!open) return null;

  const codPad = padCliente8Cadastro(codigoCliente);

  async function salvar() {
    setErro('');
    const ativos = itens.filter((i) => i.ativo !== false);
    if (ativos.length === 0) {
      setErro('Informe ao menos um número ativo.');
      return;
    }
    const invalidos = ativos.filter((i) => !isValidBrazilPhone(i.numero));
    if (invalidos.length > 0) {
      setErro('Há número(s) inválido(s). Use DDD + número (10 ou 11 dígitos).');
      return;
    }
    setSalvando(true);
    try {
      const salvos = await salvarClienteWhatsApp(clientePk, codPad, itens);
      setItens(salvos);
      onClose?.();
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function importarDaPessoaVinculada() {
    const pid = Number(String(pessoaId ?? '').replace(/\D/g, ''));
    if (!Number.isFinite(pid) || pid < 1) {
      setErro('Vincule uma pessoa ao cliente antes de importar os telefones.');
      return;
    }
    setErro('');
    setCarregando(true);
    try {
      const lista = await importarWhatsAppDaPessoa(clientePk, pid, codPad);
      setItens(lista);
      onImportouDaPessoa?.(lista);
    } catch (e) {
      setErro(e?.message || 'Falha ao importar telefones da pessoa.');
    } finally {
      setCarregando(false);
    }
  }

  function adicionarManual() {
    const numero = normalizePhoneForApi(novoNumero);
    if (!numero) {
      setErro('Informe um número válido.');
      return;
    }
    if (!isValidBrazilPhone(numero)) {
      setErro('Número inválido. Use DDD + número.');
      return;
    }
    if (itens.some((i) => normalizePhoneForApi(i.numero) === numero)) {
      setErro('Este número já está na lista.');
      return;
    }
    const principal = itens.length === 0;
    setItens([
      ...itens,
      {
        ...itemVazio(),
        numero,
        nomeLabel: novoLabel.trim() || 'WhatsApp adicional',
        principal,
        preenchidoAutomaticamente: false,
      },
    ]);
    setNovoNumero('');
    setNovoLabel('');
    setErro('');
  }

  function remover(index) {
    setItens(itens.filter((_, i) => i !== index));
  }

  function definirPrincipal(index) {
    setItens(
      itens.map((item, i) => ({
        ...item,
        principal: i === index,
      }))
    );
  }

  function atualizarCampo(index, campo, valor) {
    setItens(itens.map((item, i) => (i === index ? { ...item, [campo]: valor } : item)));
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-stretch justify-center bg-black/45 p-0 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-whatsapp-cliente-titulo"
    >
      <div className="flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-xl md:h-auto md:max-h-[92vh] md:max-w-3xl md:rounded-lg">
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3 md:px-4">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 md:hidden"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h2 id="modal-whatsapp-cliente-titulo" className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <MessageCircle className="h-5 w-5 shrink-0" style={{ color: WHATSAPP_GREEN }} aria-hidden />
              WhatsApp — notificações automáticas
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Cliente {codPad}
              {nomeCliente ? ` · ${nomeCliente}` : ''}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Números usados pelo escritório para lembretes e mensagens automáticas. Podem incluir contatos
              adicionais além da pessoa vinculada; alterações aqui não mudam o cadastro de Pessoas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hidden min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 md:flex"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
          {erro ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {erro}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={importarDaPessoaVinculada}
              disabled={carregando || !pessoaId}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
            >
              Importar telefones da pessoa vinculada
            </button>
          </div>

          {carregando && itens.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Carregando…</p>
          ) : null}

          {itens.length > 0 ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="px-2 py-2 font-semibold text-slate-700 w-10" aria-label="Principal" />
                    <th className="px-2 py-2 font-semibold text-slate-700">Número</th>
                    <th className="px-2 py-2 font-semibold text-slate-700">Identificação</th>
                    <th className="px-2 py-2 font-semibold text-slate-700 w-20">Origem</th>
                    <th className="px-2 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item, index) => (
                    <tr key={item.id ?? `w-${index}`} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 align-middle">
                        <button
                          type="button"
                          onClick={() => definirPrincipal(index)}
                          className={`p-1 rounded ${item.principal ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                          title={item.principal ? 'Número principal' : 'Definir como principal'}
                          aria-label={item.principal ? 'Principal' : 'Definir principal'}
                        >
                          <Star className={`h-4 w-4 ${item.principal ? 'fill-current' : ''}`} aria-hidden />
                        </button>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <input
                          type="tel"
                          value={formatPhoneDisplay(item.numero) || item.numero}
                          onChange={(e) => atualizarCampo(index, 'numero', e.target.value)}
                          className="w-full min-w-[9rem] rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <input
                          type="text"
                          value={item.nomeLabel ?? ''}
                          onChange={(e) => atualizarCampo(index, 'nomeLabel', e.target.value)}
                          placeholder="Ex.: Secretária, Cônjuge"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-2 py-1.5 align-middle text-xs text-slate-500">
                        {item.preenchidoAutomaticamente ? 'Pessoa' : 'Manual'}
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <button
                          type="button"
                          onClick={() => remover(index)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                          aria-label="Remover número"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !carregando && (
              <p className="text-sm text-slate-600 py-4 text-center border border-dashed border-slate-200 rounded-lg">
                Nenhum número cadastrado. Importe da pessoa vinculada ou adicione manualmente.
              </p>
            )
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Adicionar número</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="tel"
                value={novoNumero}
                onChange={(e) => setNovoNumero(e.target.value)}
                placeholder="(62) 99999-1234"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={novoLabel}
                onChange={(e) => setNovoLabel(e.target.value)}
                placeholder="Identificação (opcional)"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={adicionarManual}
                className="inline-flex items-center justify-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-white shrink-0"
                style={{ backgroundColor: WHATSAPP_GREEN }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Incluir
              </button>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-3 py-3 md:px-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || carregando}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: WHATSAPP_GREEN }}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
