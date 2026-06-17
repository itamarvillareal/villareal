import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Eye,
  ImageIcon,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useUsuarioPerfil } from '../../hooks/useUsuarioPerfil.js';
import { getNomeExibicaoUsuario } from '../../data/usuarioDisplayHelpers.js';
import { getColaboradoresHumanosAtivos } from '../../data/agendaPersistenciaData.js';
import { listarColaboradoresHumanos } from '../../repositories/usuariosRepository.js';
import {
  atualizarModeloDocumento,
  buscarCabecalhoModeloBlob,
  buscarModeloDocumento,
  criarModeloDocumento,
  excluirModeloDocumento,
  listarModelosDocumento,
  previewModeloDocumentoPdf,
  validarArquivoCabecalhoModelo,
} from '../../repositories/documentosModelosRepository.js';
import {
  downloadPdfBlob,
  nomeArquivoPeticaoPdf,
} from '../../repositories/documentosRepository.js';
import { DocumentosSubmenu } from './components/DocumentosSubmenu.jsx';
import {
  btnPrimary,
  btnSecondary,
  fieldErrorClass,
  inputClass,
  textareaClass,
} from './documentosStyles.js';

const FORM_VAZIO = () => ({
  label: '',
  usuarioResponsavelId: '',
  advogadoNome: '',
  advogadoOab: '',
  rodapeTexto: '',
});

function formatarRodapePreview(texto) {
  return String(texto ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function ModeloFormModal({
  open,
  editId,
  form,
  errors,
  infoMsg,
  colaboradores,
  cabecalhoAtualUrl,
  cabecalhoNovoPreview,
  removerCabecalho,
  temCabecalhoSalvo,
  salvando,
  gerandoPreview,
  onChange,
  onRemoverCabecalho,
  onLimparNovoCabecalho,
  onSelecionarCabecalho,
  onClose,
  onSalvar,
  onPreviewPdf,
}) {
  const inputRef = useRef(null);
  if (!open) return null;

  const editando = Boolean(editId);
  const linhasRodape = formatarRodapePreview(form.rodapeTexto);
  const avisoCabecalhoPadrao = !editando && !cabecalhoNovoPreview;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modelo-peticao-titulo"
        className="my-4 w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 id="modelo-peticao-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {editando ? 'Editar modelo de petição' : 'Novo modelo de petição'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Timbrado compartilhado: vale para todos os processos do responsável escolhido.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSalvar();
          }}
        >
          {infoMsg ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {infoMsg}
            </div>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Rótulo</span>
            <input
              className={inputClass}
              value={form.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Ex.: Karla Caroline Pedroza"
              maxLength={120}
              required
            />
            {errors.label ? <p className={fieldErrorClass}>{errors.label}</p> : null}
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Responsável</span>
            <select
              className={inputClass}
              value={form.usuarioResponsavelId}
              onChange={(e) => onChange({ usuarioResponsavelId: e.target.value })}
              required
              disabled={editando}
            >
              <option value="">Selecione…</option>
              {colaboradores.map((u) => (
                <option key={u.id} value={u.id}>
                  {getNomeExibicaoUsuario(u)}
                </option>
              ))}
            </select>
            {editando ? (
              <span className="mt-1 block text-xs text-slate-500">
                O responsável não pode ser alterado. Exclua e crie outro modelo se necessário.
              </span>
            ) : null}
            {errors.usuarioResponsavelId ? (
              <p className={fieldErrorClass}>{errors.usuarioResponsavelId}</p>
            ) : null}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Nome do advogado</span>
              <input
                className={inputClass}
                value={form.advogadoNome}
                onChange={(e) => onChange({ advogadoNome: e.target.value })}
                maxLength={255}
                required
              />
              {errors.advogadoNome ? <p className={fieldErrorClass}>{errors.advogadoNome}</p> : null}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">OAB</span>
              <input
                className={inputClass}
                value={form.advogadoOab}
                onChange={(e) => onChange({ advogadoOab: e.target.value })}
                placeholder="OAB/GO 41.662"
                maxLength={80}
                required
              />
              {errors.advogadoOab ? <p className={fieldErrorClass}>{errors.advogadoOab}</p> : null}
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Rodapé (texto)</span>
            <textarea
              className={`${textareaClass} min-h-[120px] font-mono text-xs`}
              value={form.rodapeTexto}
              onChange={(e) => onChange({ rodapeTexto: e.target.value })}
              placeholder={'Endereço…\nTelefone: …\nE-mail: …'}
              required
            />
            <span className="mt-1 block text-xs text-slate-500">Uma linha por parágrafo. Linha com «Telefone» só na 1ª página.</span>
            {errors.rodapeTexto ? <p className={fieldErrorClass}>{errors.rodapeTexto}</p> : null}
            {linhasRodape.length ? (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                <p className="mb-1 font-medium text-slate-500">Prévia do rodapé</p>
                {linhasRodape.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            ) : null}
          </label>

          <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <legend className="px-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              Imagem de cabeçalho
            </legend>

            {avisoCabecalhoPadrao ? (
              <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
                <strong>Sem imagem própria</strong>, o PDF usará o cabeçalho padrão do escritório (Itamar) com nome,
                OAB e rodapé deste modelo — timbrado misturado. Envie a imagem timbrada do responsável.
              </div>
            ) : null}

            {editando && temCabecalhoSalvo && !removerCabecalho && cabecalhoAtualUrl ? (
              <div className="mb-3">
                <p className="mb-2 text-xs text-slate-500">Cabeçalho atual</p>
                <img
                  src={cabecalhoAtualUrl}
                  alt="Cabeçalho atual do modelo"
                  className="max-h-32 w-full rounded border border-slate-200 object-contain dark:border-slate-600"
                />
              </div>
            ) : null}

            {cabecalhoNovoPreview ? (
              <div className="mb-3">
                <p className="mb-2 text-xs text-slate-500">Nova imagem selecionada</p>
                <img
                  src={cabecalhoNovoPreview}
                  alt="Prévia do novo cabeçalho"
                  className="max-h-32 w-full rounded border border-cyan-200 object-contain dark:border-cyan-800"
                />
              </div>
            ) : null}

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => onSelecionarCabecalho(e.target.files?.[0] ?? null)}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-4 w-4" aria-hidden />
                {cabecalhoNovoPreview || (editando && temCabecalhoSalvo && !removerCabecalho)
                  ? 'Trocar imagem'
                  : 'Enviar imagem'}
              </button>
              {cabecalhoNovoPreview ? (
                <button type="button" className={btnSecondary} onClick={onLimparNovoCabecalho}>
                  Descartar nova imagem
                </button>
              ) : null}
              {editando && temCabecalhoSalvo && !removerCabecalho ? (
                <button type="button" className={btnSecondary} onClick={onRemoverCabecalho}>
                  Remover cabeçalho salvo
                </button>
              ) : null}
              {removerCabecalho ? (
                <span className="self-center text-xs text-amber-700 dark:text-amber-300">
                  Cabeçalho será removido ao salvar (volta ao padrão do escritório).
                </span>
              ) : null}
            </div>
            {errors.cabecalho ? <p className={`mt-2 ${fieldErrorClass}`}>{errors.cabecalho}</p> : null}
            <p className="mt-2 text-xs text-slate-500">JPEG ou PNG, máximo 2 MB.</p>
          </fieldset>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button type="button" className={btnSecondary} onClick={onClose} disabled={salvando}>
              Cancelar
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={salvando || gerandoPreview}
              onClick={() => void onPreviewPdf()}
            >
              {gerandoPreview ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Gerando…
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" aria-hidden />
                  Pré-visualizar PDF
                </>
              )}
            </button>
            <button type="submit" className={btnPrimary} disabled={salvando}>
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                'Salvar modelo'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ModelosPeticao() {
  const { isAdmin } = useUsuarioPerfil();
  const [modelos, setModelos] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [errors, setErrors] = useState({});
  const [infoMsg, setInfoMsg] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [gerandoPreview, setGerandoPreview] = useState(false);
  const [cabecalhoArquivo, setCabecalhoArquivo] = useState(null);
  const [cabecalhoPreviewUrl, setCabecalhoPreviewUrl] = useState(null);
  const [cabecalhoAtualUrl, setCabecalhoAtualUrl] = useState(null);
  const [temCabecalhoSalvo, setTemCabecalhoSalvo] = useState(false);
  const [removerCabecalho, setRemoverCabecalho] = useState(false);

  const modelosAtivos = useMemo(
    () => modelos.filter((m) => m.ativo !== false),
    [modelos],
  );

  const revogarCabecalhoAtual = useCallback(() => {
    setCabecalhoAtualUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const revogarCabecalhoPreview = useCallback(() => {
    setCabecalhoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  useEffect(() => () => {
    revogarCabecalhoAtual();
    revogarCabecalhoPreview();
  }, [revogarCabecalhoAtual, revogarCabecalhoPreview]);

  const recarregarLista = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const lista = await listarModelosDocumento();
      setModelos(lista);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar modelos.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregarLista();
  }, [recarregarLista]);

  useEffect(() => {
    let ativo = true;
    void listarColaboradoresHumanos()
      .then((lista) => {
        if (!ativo) return;
        setColaboradores(Array.isArray(lista) ? lista : []);
      })
      .catch(() => {
        if (!ativo) return;
        setColaboradores(getColaboradoresHumanosAtivos() || []);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const resetModal = useCallback(() => {
    setForm(FORM_VAZIO());
    setErrors({});
    setInfoMsg('');
    setEditId(null);
    setCabecalhoArquivo(null);
    setRemoverCabecalho(false);
    setTemCabecalhoSalvo(false);
    revogarCabecalhoPreview();
    revogarCabecalhoAtual();
  }, [revogarCabecalhoAtual, revogarCabecalhoPreview]);

  const abrirNovo = () => {
    resetModal();
    setModalOpen(true);
  };

  const abrirEdicao = async (id, msgInfo = '') => {
    resetModal();
    setEditId(id);
    setInfoMsg(msgInfo);
    setModalOpen(true);
    try {
      const m = await buscarModeloDocumento(id);
      setForm({
        label: m.label || '',
        usuarioResponsavelId: m.usuarioResponsavelId != null ? String(m.usuarioResponsavelId) : '',
        advogadoNome: m.advogadoNome || '',
        advogadoOab: m.advogadoOab || '',
        rodapeTexto: m.rodapeTexto || '',
      });
      setTemCabecalhoSalvo(Boolean(m.temCabecalhoImagem));
      if (m.temCabecalhoImagem) {
        const blob = await buscarCabecalhoModeloBlob(id);
        revogarCabecalhoAtual();
        setCabecalhoAtualUrl(URL.createObjectURL(blob));
      }
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar modelo.');
      setModalOpen(false);
    }
  };

  const patchForm = (p) => {
    if (!editId && p.usuarioResponsavelId) {
      const existente = modelosAtivos.find(
        (m) => Number(m.usuarioResponsavelId) === Number(p.usuarioResponsavelId),
      );
      if (existente) {
        void abrirEdicao(existente.id, 'Este responsável já possui modelo — aberto para edição.');
        return;
      }
    }
    setForm((f) => ({ ...f, ...p }));
    setErrors({});
  };

  const onSelecionarCabecalho = (file) => {
    setRemoverCabecalho(false);
    const err = validarArquivoCabecalhoModelo(file);
    if (err) {
      setErrors((e) => ({ ...e, cabecalho: err }));
      return;
    }
    setCabecalhoArquivo(file);
    revogarCabecalhoPreview();
    if (file) {
      setCabecalhoPreviewUrl(URL.createObjectURL(file));
    }
    setErrors((e) => ({ ...e, cabecalho: undefined }));
  };

  const validarForm = () => {
    const errs = {};
    if (!form.label?.trim()) errs.label = 'Informe o rótulo.';
    if (!form.usuarioResponsavelId) errs.usuarioResponsavelId = 'Selecione o responsável.';
    if (!form.advogadoNome?.trim()) errs.advogadoNome = 'Informe o nome do advogado.';
    if (!form.advogadoOab?.trim()) errs.advogadoOab = 'Informe a OAB.';
    if (!form.rodapeTexto?.trim()) errs.rodapeTexto = 'Informe o texto do rodapé.';
    if (cabecalhoArquivo) {
      const errCab = validarArquivoCabecalhoModelo(cabecalhoArquivo);
      if (errCab) errs.cabecalho = errCab;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const montarPayload = () => ({
    label: form.label.trim(),
    usuarioResponsavelId: Number(form.usuarioResponsavelId),
    advogadoNome: form.advogadoNome.trim(),
    advogadoOab: form.advogadoOab.trim(),
    rodapeTexto: form.rodapeTexto.trim(),
    ativo: true,
    ...(editId && removerCabecalho ? { removerCabecalho: true } : {}),
  });

  const salvar = async () => {
    if (!validarForm()) return;
    setSalvando(true);
    setErro('');
    try {
      const payload = montarPayload();
      if (editId) {
        await atualizarModeloDocumento(editId, payload, cabecalhoArquivo);
      } else {
        await criarModeloDocumento(payload, cabecalhoArquivo);
      }
      setModalOpen(false);
      resetModal();
      await recarregarLista();
    } catch (e) {
      const msg = e?.message || 'Falha ao salvar modelo.';
      if (!editId && msg.toLowerCase().includes('já existe modelo')) {
        const existente = modelosAtivos.find(
          (m) => Number(m.usuarioResponsavelId) === Number(form.usuarioResponsavelId),
        );
        if (existente) {
          await abrirEdicao(existente.id, msg);
          return;
        }
      }
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (modelo) => {
    const ok = window.confirm(
      `Excluir o modelo «${modelo.label}»?\n\nO timbrado deste responsável voltará ao padrão do escritório.`,
    );
    if (!ok) return;
    setErro('');
    try {
      await excluirModeloDocumento(modelo.id);
      await recarregarLista();
    } catch (e) {
      setErro(e?.message || 'Falha ao excluir modelo.');
    }
  };

  const montarPreviewPayload = () => ({
    advogadoNome: form.advogadoNome.trim(),
    advogadoOab: form.advogadoOab.trim(),
    rodapeTexto: form.rodapeTexto.trim(),
    ...(editId ? { modeloId: editId } : {}),
    ...(editId && removerCabecalho ? { removerCabecalho: true } : {}),
  });

  const previewPdf = async () => {
    if (!validarForm()) return;

    setGerandoPreview(true);
    setErro('');
    try {
      const blob = await previewModeloDocumentoPdf(montarPreviewPayload(), cabecalhoArquivo);
      const sufixo = editId ? `modelo_${editId}` : 'modelo_novo';
      downloadPdfBlob(blob, nomeArquivoPeticaoPdf(sufixo));
    } catch (e) {
      setErro(e?.message || 'Falha ao gerar PDF de exemplo.');
    } finally {
      setGerandoPreview(false);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/documentos/gerar" replace />;
  }

  return (
    <div className="flex min-h-full min-h-0 flex-1 flex-col bg-gradient-to-br from-slate-100 via-cyan-50/30 to-slate-100 p-4 dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] md:p-6">
      <DocumentosSubmenu />

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-cyan-600 to-teal-700 p-2.5 text-white shadow-lg shadow-cyan-500/25 ring-1 ring-white/20">
            <Layers className="h-7 w-7" aria-hidden />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-cyan-800 to-teal-800 bg-clip-text text-xl font-bold text-transparent dark:from-cyan-200 dark:to-teal-200">
              Modelos de petição
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Timbrado por responsável do processo — alterações valem para todo o escritório.
            </p>
          </div>
        </div>
        <button type="button" className={btnPrimary} onClick={abrirNovo}>
          <Plus className="h-4 w-4" aria-hidden />
          Novo modelo
        </button>
      </header>

      {erro ? (
        <div
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {erro}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        {carregando ? (
          <p className="flex items-center gap-2 p-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando modelos…
          </p>
        ) : modelosAtivos.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            Nenhum modelo cadastrado. Processos sem modelo ativo para o responsável usam o timbrado padrão Itamar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
                  <th className="px-4 py-3 font-medium">Rótulo</th>
                  <th className="px-4 py-3 font-medium">Responsável</th>
                  <th className="px-4 py-3 font-medium">Advogado / OAB</th>
                  <th className="px-4 py-3 font-medium">Cabeçalho</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {modelosAtivos.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{m.label}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {m.usuarioResponsavelNome || m.usuarioResponsavelLogin || `#${m.usuarioResponsavelId}`}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <div>{m.advogadoNome}</div>
                      <div className="text-xs text-slate-500">{m.advogadoOab}</div>
                    </td>
                    <td className="px-4 py-3">
                      {m.temCabecalhoImagem ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                          Próprio
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">Padrão escritório</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-cyan-700 dark:hover:bg-slate-800"
                          title="Editar"
                          onClick={() => void abrirEdicao(m.id)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                          title="Excluir"
                          onClick={() => void excluir(m)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModeloFormModal
        open={modalOpen}
        editId={editId}
        form={form}
        errors={errors}
        infoMsg={infoMsg}
        colaboradores={colaboradores}
        cabecalhoAtualUrl={cabecalhoAtualUrl}
        cabecalhoNovoPreview={cabecalhoPreviewUrl}
        removerCabecalho={removerCabecalho}
        temCabecalhoSalvo={temCabecalhoSalvo}
        salvando={salvando}
        gerandoPreview={gerandoPreview}
        onChange={patchForm}
        onRemoverCabecalho={() => {
          setRemoverCabecalho(true);
          setCabecalhoArquivo(null);
          revogarCabecalhoPreview();
        }}
        onLimparNovoCabecalho={() => {
          setCabecalhoArquivo(null);
          revogarCabecalhoPreview();
        }}
        onSelecionarCabecalho={onSelecionarCabecalho}
        onClose={() => {
          setModalOpen(false);
          resetModal();
        }}
        onSalvar={() => void salvar()}
        onPreviewPdf={previewPdf}
      />
    </div>
  );
}
