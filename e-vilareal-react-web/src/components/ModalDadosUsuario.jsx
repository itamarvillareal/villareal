import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { obterPessoaParaVinculoUsuario } from '../services/pessoaVinculoUsuarioService.js';
import { hashSenha } from '../data/usuarioSenhaHash.js';
import { featureFlags } from '../config/featureFlags.js';

/**
 * @param {{
 *   open: boolean,
 *   usuario: object | null,
 *   listaTodos: object[],
 *   podeEditarIdUsuario?: boolean,
 *   onClose: () => void,
 *   onSalvar: (atualizado: object) => Promise<void> | void,
 * }} props
 */
export function ModalDadosUsuario({ open, usuario, listaTodos, podeEditarIdUsuario = false, onClose, onSalvar }) {
  const [usuarioIdCampo, setUsuarioIdCampo] = useState('');
  const [numeroPessoa, setNumeroPessoa] = useState('');
  const [apelido, setApelido] = useState('');
  const [login, setLogin] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaNova2, setSenhaNova2] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [pessoaPreview, setPessoaPreview] = useState(null);
  const [carregandoPessoa, setCarregandoPessoa] = useState(false);
  const erroRef = useRef(null);

  const temVinculoPessoa =
    usuario &&
    usuario.numeroPessoa != null &&
    String(usuario.numeroPessoa).trim() !== '' &&
    Number.isFinite(Number(usuario.numeroPessoa)) &&
    Number(usuario.numeroPessoa) >= 1;

  useEffect(() => {
    if (!open || !usuario) return;
    setUsuarioIdCampo(String(usuario.id ?? ''));
    setNumeroPessoa(usuario.numeroPessoa != null ? String(usuario.numeroPessoa) : '');
    setApelido(String(usuario.apelido ?? '').trim());
    setLogin(String(usuario.login ?? '').trim());
    setSenhaNova('');
    setSenhaNova2('');
    setErro('');
    setPessoaPreview(null);
  }, [open, usuario?.id, usuario?.numeroPessoa, usuario?.apelido]);

  useEffect(() => {
    if (!open) return;
    const np = (temVinculoPessoa ? String(usuario?.numeroPessoa ?? '') : numeroPessoa).trim();
    if (!np) {
      setPessoaPreview(null);
      setCarregandoPessoa(false);
      return;
    }
    const n = Number(np);
    if (!Number.isFinite(n) || n < 1) {
      setPessoaPreview(null);
      setCarregandoPessoa(false);
      return;
    }
    let cancelled = false;
    setCarregandoPessoa(true);
    void obterPessoaParaVinculoUsuario(n)
      .then((p) => {
        if (!cancelled) {
          setPessoaPreview(p);
          setCarregandoPessoa(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPessoaPreview(null);
          setCarregandoPessoa(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, temVinculoPessoa, usuario?.numeroPessoa, numeroPessoa]);

  useEffect(() => {
    if (!erro || !erroRef.current) return;
    erroRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [erro]);

  if (!open || !usuario) return null;

  const isCadastroNovoApi =
    featureFlags.useApiUsuarios &&
    (!Number.isFinite(Number(usuario.id)) || Number(usuario.id) < 1);

  const idTitulo =
    featureFlags.useApiUsuarios || !podeEditarIdUsuario ? String(usuario.id ?? '') : usuarioIdCampo.trim() || '…';

  async function salvar() {
    setErro('');

    const idDesejado = featureFlags.useApiUsuarios
      ? String(usuario.id ?? '').trim()
      : podeEditarIdUsuario
        ? usuarioIdCampo.trim()
        : String(usuario.id ?? '').trim();

    if (!idDesejado) {
      setErro('ID do usuário é obrigatório.');
      return;
    }
    if (/\s/.test(idDesejado)) {
      setErro('O ID do usuário não pode conter espaços.');
      return;
    }

    const dupId = (listaTodos || []).find(
      (u) => String(u.id) === idDesejado && String(u.id) !== String(usuario.id)
    );
    if (dupId) {
      setErro('Já existe outro usuário com este ID.');
      return;
    }

    let n = null;
    let p = null;

    if (temVinculoPessoa) {
      n = Number(usuario.numeroPessoa);
      if (!Number.isFinite(n) || n < 1) {
        setErro('Vínculo com pessoa inválido.');
        return;
      }
      p = await obterPessoaParaVinculoUsuario(n);
      if (!p) {
        setErro(
          `Não existe pessoa cadastrada com o nº ${n}. Cadastre em Cadastro de Pessoas ou confira o número.`
        );
        return;
      }
    } else {
      const np = numeroPessoa.trim();
      if (np) {
        n = Number(np);
        if (!Number.isFinite(n) || n < 1) {
          setErro('Número de pessoa inválido.');
          return;
        }
        p = await obterPessoaParaVinculoUsuario(n);
        if (!p) {
          setErro(
            `Não existe pessoa cadastrada com o nº ${n}. Cadastre em Cadastro de Pessoas ou confira o número.`
          );
          return;
        }
      }
    }

    if (n != null && Number.isFinite(n)) {
      const outro = (listaTodos || []).find(
        (u) => String(u.id) !== String(usuario.id) && Number(u.numeroPessoa) === n
      );
      if (outro) {
        setErro(`Este nº de pessoa já está vinculado ao usuário "${outro.id}".`);
        return;
      }
    }

    const loginNorm = login.trim().toLowerCase();
    if (loginNorm) {
      const dup = (listaTodos || []).find(
        (u) => String(u.id) !== String(usuario.id) && String(u.login || '').trim().toLowerCase() === loginNorm
      );
      if (dup) {
        setErro(`Login "${loginNorm}" já está em uso.`);
        return;
      }
    }

    if (senhaNova || senhaNova2) {
      if (senhaNova.length < 4) {
        setErro('Senha deve ter pelo menos 4 caracteres.');
        return;
      }
      if (senhaNova !== senhaNova2) {
        setErro('Confirmação de senha não confere.');
        return;
      }
    }

    if (isCadastroNovoApi && !apelido.trim()) {
      setErro('Apelido é obrigatório ao cadastrar um novo usuário.');
      return;
    }

    setSalvando(true);
    try {
      let senhaHash = usuario.senhaHash || '';
      if (senhaNova) {
        senhaHash = await hashSenha(senhaNova);
      }

      const nomePessoa = p?.nome != null ? String(p.nome).trim() : '';
      const nomeUsuario = String(usuario.nome ?? '').trim();
      const nomeSalvar =
        nomePessoa || nomeUsuario || String(idDesejado).trim() || 'Usuário';
      const idAnterior = String(usuario.id ?? '');
      const idMudou = !featureFlags.useApiUsuarios && idDesejado !== idAnterior;
      let slotAgenda =
        usuario.slotAgendaId != null && String(usuario.slotAgendaId).trim() !== ''
          ? String(usuario.slotAgendaId).trim()
          : '';
      if (!slotAgenda && !featureFlags.useApiUsuarios) {
        slotAgenda = idMudou ? idAnterior : String(idDesejado);
      }

      await onSalvar({
        ...usuario,
        id: idDesejado,
        ...(idMudou ? { idAnterior } : {}),
        nome: nomeSalvar,
        numeroPessoa: n,
        apelido: apelido.trim(),
        login: loginNorm,
        senhaHash,
        ...(featureFlags.useApiUsuarios && senhaNova ? { senha: senhaNova } : {}),
        ...(!featureFlags.useApiUsuarios && slotAgenda ? { slotAgendaId: slotAgenda } : {}),
      });
      onClose();
    } catch (e) {
      setErro(e?.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const linkEditarPessoa = `/clientes/editar/${pessoaPreview?.id ?? usuario.numeroPessoa ?? ''}`;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dados-usuario-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 shrink-0">
          <h2 id="dados-usuario-title" className="text-base font-semibold text-slate-800">
            Cadastro do usuário — {idTitulo}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
          <p className="text-xs text-slate-600 leading-relaxed">
            Cada usuário deve estar cadastrado em <strong>Pessoas</strong> com um número único. O nome civil e dados
            cadastrais ficam só na ficha em{' '}
            <Link to="/clientes/lista" className="text-indigo-600 underline">
              Cadastro de Pessoas
            </Link>
            . No restante do sistema (menu, Agenda, histórico de processos, etc.) usa-se apenas o{' '}
            <strong>apelido</strong>. Login e senha servem para o acesso futuro.
          </p>

          <div>
            <label className="text-xs font-medium text-slate-700">ID do usuário</label>
            {featureFlags.useApiUsuarios ? (
              <p className="mt-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 font-mono">
                {usuario.id}
              </p>
            ) : podeEditarIdUsuario ? (
              <input
                type="text"
                value={usuarioIdCampo}
                onChange={(e) => setUsuarioIdCampo(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                placeholder="Identificador único (ex.: karla)"
                autoComplete="off"
              />
            ) : (
              <>
                <p className="mt-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 font-mono">
                  {usuario.id}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Este usuário espelha o primeiro item da lista fixa da Agenda (modo local); o ID não pode ser alterado
                  aqui.
                </p>
              </>
            )}
            {featureFlags.useApiUsuarios ? (
              <p className="mt-1 text-xs text-slate-500">O ID é definido pelo servidor e não pode ser editado.</p>
            ) : podeEditarIdUsuario ? (
              <p className="mt-1 text-xs text-slate-500">
                Ao mudar o ID, compromissos locais da agenda, permissões e pendências passam a usar o novo valor.
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-700">
                {temVinculoPessoa
                  ? 'Vínculo com Pessoas (somente leitura)'
                  : 'Nº da pessoa (Cadastro de Pessoas)'}
              </label>
              <Link
                to="/clientes/lista"
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
              >
                Abrir Pessoas <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            {temVinculoPessoa ? (
              <>
                <p className="mt-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  Nº <span className="font-mono font-medium">{usuario.numeroPessoa}</span>
                  {pessoaPreview?.nome ? (
                    <span className="text-slate-600"> — {pessoaPreview.nome}</span>
                  ) : null}
                </p>
                {carregandoPessoa ? (
                  <p className="mt-1 text-xs text-slate-500">Consultando cadastro…</p>
                ) : pessoaPreview ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Para editar dados cadastrais da pessoa, abra a ficha em{' '}
                    <Link to={linkEditarPessoa} className="text-indigo-600 underline">
                      editar cadastro
                    </Link>
                    .
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-800">
                    Pessoa não encontrada para este número — confira no Cadastro de Pessoas.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mt-1 text-xs text-slate-600 mb-1">
                  Você pode <strong>salvar apelido, login e senha</strong> agora e informar o nº depois. Quando
                  preencher o nº, o vínculo só é gravado se a pessoa existir no cadastro.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={numeroPessoa}
                  onChange={(e) => setNumeroPessoa(e.target.value.replace(/\D/g, ''))}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Ex.: 4599"
                />
                {carregandoPessoa && numeroPessoa.trim() ? (
                  <p className="mt-1 text-xs text-slate-500">Consultando cadastro…</p>
                ) : pessoaPreview ? (
                  <p className="mt-1 text-xs text-slate-700">
                    <span className="font-medium">Nome no cadastro:</span> {pessoaPreview.nome}
                  </p>
                ) : numeroPessoa.trim() ? (
                  <p className="mt-1 text-xs text-amber-800">Pessoa não encontrada para este número.</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    Deixe em branco para só atualizar apelido/login; ou informe o nº da ficha em Pessoas.
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700">
              Apelido{' '}
              {isCadastroNovoApi ? <span className="text-red-600">*</span> : null}{' '}
              <span className="text-slate-500 font-normal">(único nome de usuário nas telas)</span>
            </label>
            <input
              type="text"
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ex.: Itamar, Karla"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700">Login</label>
            <input
              type="text"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value.toLowerCase().replace(/\s/g, ''))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="único no escritório"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-700">Nova senha</label>
              <input
                type="password"
                autoComplete="new-password"
                value={senhaNova}
                onChange={(e) => setSenhaNova(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder={usuario.senhaHash ? 'deixe em branco para manter' : 'mín. 4 caracteres'}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Confirmar senha</label>
              <input
                type="password"
                autoComplete="new-password"
                value={senhaNova2}
                onChange={(e) => setSenhaNova2(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          {usuario.senhaHash ? (
            <p className="text-xs text-slate-500">Senha já definida. Preencha apenas para trocar.</p>
          ) : null}
        </div>

        {erro ? (
          <div
            ref={erroRef}
            className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800"
            role="alert"
          >
            {erro}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={() => void salvar()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
