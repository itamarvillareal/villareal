import { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPessoaPorId } from '../data/cadastroPessoasMock.js';
import { hashSenha } from '../data/usuarioSenhaHash.js';

/**
 * @param {{
 *   open: boolean,
 *   usuario: object | null,
 *   listaTodos: object[],
 *   onClose: () => void,
 *   onSalvar: (atualizado: object) => Promise<void> | void,
 * }} props
 */
export function ModalDadosUsuario({ open, usuario, listaTodos, onClose, onSalvar }) {
  const [numeroPessoa, setNumeroPessoa] = useState('');
  const [apelido, setApelido] = useState('');
  const [login, setLogin] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaNova2, setSenhaNova2] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open || !usuario) return;
    setNumeroPessoa(usuario.numeroPessoa != null ? String(usuario.numeroPessoa) : '');
    setApelido(String(usuario.apelido ?? '').trim());
    setLogin(String(usuario.login ?? '').trim());
    setSenhaNova('');
    setSenhaNova2('');
    setErro('');
  }, [open, usuario?.id]);

  if (!open || !usuario) return null;

  const pessoaVinculada = numeroPessoa.trim()
    ? getPessoaPorId(Number(numeroPessoa.trim()))
    : null;

  async function salvar() {
    setErro('');
    const np = numeroPessoa.trim();
    let numeroPessoaNum = null;
    if (np) {
      const n = Number(np);
      if (!Number.isFinite(n) || n < 1) {
        setErro('Número de pessoa inválido.');
        return;
      }
      const p = getPessoaPorId(n);
      if (!p) {
        setErro(`Não existe pessoa cadastrada com o nº ${n}. Cadastre em Pessoas ou confira o número.`);
        return;
      }
      const outro = (listaTodos || []).find(
        (u) => String(u.id) !== String(usuario.id) && Number(u.numeroPessoa) === n
      );
      if (outro) {
        setErro(`Este nº de pessoa já está vinculado ao usuário "${outro.id}".`);
        return;
      }
      numeroPessoaNum = n;
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

    setSalvando(true);
    try {
      let senhaHash = usuario.senhaHash || '';
      if (senhaNova) {
        senhaHash = await hashSenha(senhaNova);
      }

      const nomeCadastro =
        numeroPessoaNum != null ? getPessoaPorId(numeroPessoaNum)?.nome || usuario.nome : usuario.nome;

      await onSalvar({
        ...usuario,
        nome: nomeCadastro || usuario.nome,
        numeroPessoa: numeroPessoaNum,
        apelido: apelido.trim(),
        login: loginNorm,
        senhaHash,
      });
      onClose();
    } catch (e) {
      setErro(e?.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

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
            Cadastro do usuário — {usuario.id}
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
            Cada usuário deve estar cadastrado em <strong>Pessoas</strong> com um número único. O{' '}
            <strong>apelido</strong> aparece no menu e nas telas em vez do nome completo. Login e senha serão usados no
            acesso futuro ao sistema.
          </p>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-700">Nº da pessoa (Cadastro de Pessoas)</label>
              <Link
                to="/clientes"
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
              >
                Abrir Pessoas <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={numeroPessoa}
              onChange={(e) => setNumeroPessoa(e.target.value.replace(/\D/g, ''))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ex.: 4599"
            />
            {pessoaVinculada ? (
              <p className="mt-1 text-xs text-slate-700">
                <span className="font-medium">Nome no cadastro:</span> {pessoaVinculada.nome}
              </p>
            ) : numeroPessoa.trim() ? (
              <p className="mt-1 text-xs text-amber-800">Pessoa não encontrada para este número.</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Opcional até vincular ao cadastro.</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700">Apelido (exibição no sistema)</label>
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

          {erro ? <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{erro}</p> : null}
        </div>

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
