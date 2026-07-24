import { useCallback, useEffect, useState } from 'react';
import { Building2, KeyRound, Landmark, Loader2, Mail, Save, Shield, Trash2 } from 'lucide-react';
import { useUsuarioPerfil } from '../hooks/useUsuarioPerfil.js';
import { isPortal1Instancia } from '../config/instanciaPortal.js';
import {
  obterConfigProjudiProtocoloEmail,
  salvarConfigProjudiProtocoloEmail,
} from '../repositories/configuracaoRepository.js';
import {
  atualizarSenhaCredencialPje,
  excluirCredencialProjudi,
  listarCredenciaisPje,
  listarCredenciaisProjudi,
  obterStatusInstanciaIntegracoes,
  salvarCredencialPje,
  salvarCredencialProjudi,
  testarCredencialPje,
} from '../repositories/configuracaoIntegracoesRepository.js';
import { VisorCodigoPdpj } from './VisorCodigoPdpj.jsx';

function rotuloInstanciaFrontend() {
  if (isPortal1Instancia()) return 'Portal 1';
  if (typeof window !== 'undefined' && window.location.hostname.includes('portal.')) {
    return 'Portal Vila Real';
  }
  return 'Instância local';
}

export function ConfiguracaoIntegracoesSistema() {
  const { isAdmin } = useUsuarioPerfil();
  const [status, setStatus] = useState(null);
  const [projudiLista, setProjudiLista] = useState([]);
  const [pjeLista, setPjeLista] = useState([]);
  const [cpf, setCpf] = useState('');
  const [senhaProjudi, setSenhaProjudi] = useState('');
  const [rotuloProjudi, setRotuloProjudi] = useState('');
  const [loginPje, setLoginPje] = useState('');
  const [secretPje, setSecretPje] = useState('');
  const [senhaPje, setSenhaPje] = useState('');
  const [emailProtocolo, setEmailProtocolo] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  const recarregar = useCallback(async () => {
    setErro('');
    setCarregando(true);
    try {
      const [st, emailCfg] = await Promise.all([
        obterStatusInstanciaIntegracoes(),
        obterConfigProjudiProtocoloEmail(),
      ]);
      setStatus(st);
      const dest = Array.isArray(emailCfg?.destinatarios) ? emailCfg.destinatarios.filter(Boolean) : [];
      setEmailProtocolo(dest.join(', '));

      if (isAdmin) {
        const [proj, pje] = await Promise.all([
          listarCredenciaisProjudi().catch(() => []),
          listarCredenciaisPje().catch(() => []),
        ]);
        setProjudiLista(Array.isArray(proj) ? proj : []);
        setPjeLista(Array.isArray(pje) ? pje : []);
      }
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar integrações.');
    } finally {
      setCarregando(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  async function onSalvarProjudi(e) {
    e.preventDefault();
    setErro('');
    setOk('');
    setSalvando('projudi');
    try {
      await salvarCredencialProjudi({
        cpf: cpf.trim(),
        senha: senhaProjudi,
        rotulo: rotuloProjudi.trim() || undefined,
      });
      setSenhaProjudi('');
      setOk('Credencial PROJUDI salva nesta instância.');
      await recarregar();
    } catch (err) {
      setErro(err?.message || 'Falha ao salvar PROJUDI.');
    } finally {
      setSalvando('');
    }
  }

  async function onExcluirProjudi(id) {
    if (!window.confirm('Remover esta credencial PROJUDI desta instância?')) return;
    setSalvando(`projudi-del-${id}`);
    setErro('');
    try {
      await excluirCredencialProjudi(id);
      setOk('Credencial PROJUDI removida.');
      await recarregar();
    } catch (err) {
      setErro(err?.message || 'Falha ao remover PROJUDI.');
    } finally {
      setSalvando('');
    }
  }

  async function onSalvarPje(e) {
    e.preventDefault();
    setErro('');
    setOk('');
    setSalvando('pje');
    try {
      await salvarCredencialPje({
        tribunal: 'PJE_TRT18',
        login: loginPje.trim(),
        otpauthUriOuSecret: secretPje.trim(),
        senha: senhaPje || undefined,
        ativo: true,
      });
      setSecretPje('');
      setSenhaPje('');
      setOk('Credencial PJe TRT18 salva nesta instância.');
      await recarregar();
    } catch (err) {
      setErro(err?.message || 'Falha ao salvar PJe.');
    } finally {
      setSalvando('');
    }
  }

  async function onAtualizarSenhaPje(id) {
    const nova = window.prompt('Nova senha do 1º fator PJe:');
    if (!nova) return;
    setSalvando(`pje-senha-${id}`);
    try {
      await atualizarSenhaCredencialPje(id, nova);
      setOk('Senha PJe atualizada.');
      await recarregar();
    } catch (err) {
      setErro(err?.message || 'Falha ao atualizar senha PJe.');
    } finally {
      setSalvando('');
    }
  }

  async function onTestarPje(id) {
    setSalvando(`pje-teste-${id}`);
    try {
      const r = await testarCredencialPje(id);
      setOk(`Código TOTP de teste: ${r.codigo} (válido por ${r.segundosRestantes}s)`);
    } catch (err) {
      setErro(err?.message || 'Falha no teste TOTP.');
    } finally {
      setSalvando('');
    }
  }

  async function onSalvarEmail(e) {
    e.preventDefault();
    setErro('');
    setOk('');
    const destinatarios = emailProtocolo
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!destinatarios.length) {
      setErro('Informe ao menos um e-mail.');
      return;
    }
    setSalvando('email');
    try {
      const cfg = await salvarConfigProjudiProtocoloEmail(destinatarios);
      setEmailProtocolo((cfg?.destinatarios || destinatarios).join(', '));
      setOk('Destinatários de e-mail salvos nesta instância.');
    } catch (err) {
      setErro(err?.message || 'Falha ao salvar e-mails.');
    } finally {
      setSalvando('');
    }
  }

  const rotulo = status?.instanciaRotulo || rotuloInstanciaFrontend();

  return (
    <div className="border-t border-slate-200 pt-6 space-y-6">
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 flex items-start gap-3">
        <Building2 className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-indigo-950">Integrações desta instância</h2>
          <p className="text-sm text-indigo-900/80 mt-0.5">
            <strong>{rotulo}</strong> — credenciais e e-mails ficam no banco desta instância (
            {status?.instanciaId || (isPortal1Instancia() ? 'portal1' : 'portal')}), separados do outro portal.
          </p>
          {status && !status.projudiChaveConfigurada ? (
            <p className="text-xs text-amber-800 mt-2">
              Cofre PROJUDI indisponível: configure <code className="font-mono">PROJUDI_CRED_KEY</code> no servidor desta instância.
            </p>
          ) : null}
          {status && !status.totpChaveConfigurada ? (
            <p className="text-xs text-amber-800 mt-1">
              Cofre PJe indisponível: configure <code className="font-mono">TOTP_ENCRYPTION_KEY</code> no servidor desta instância.
            </p>
          ) : null}
        </div>
      </div>

      {erro ? (
        <p className="text-sm text-rose-700 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">{erro}</p>
      ) : null}
      {ok ? (
        <p className="text-sm text-emerald-700 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">{ok}</p>
      ) : null}

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Carregando integrações…
        </div>
      ) : null}

      {!isAdmin ? (
        <p className="text-sm text-slate-600 flex items-center gap-2">
          <Shield className="w-4 h-4 shrink-0" aria-hidden />
          Cadastro de credenciais PROJUDI e PJe é restrito a administradores. E-mails de protocolo podem ser editados abaixo.
        </p>
      ) : null}

      {isAdmin ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-teal-700" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-800">PROJUDI — credencial</h3>
          </div>
          {projudiLista.length ? (
            <ul className="space-y-2">
              {projudiLista.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>
                    CPF <span className="font-mono">{c.cpfUsuario}</span>
                    {c.rotulo ? ` · ${c.rotulo}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => void onExcluirProjudi(c.id)}
                    disabled={Boolean(salvando)}
                    className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-900 text-xs font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden />
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Nenhuma credencial PROJUDI cadastrada nesta instância.</p>
          )}
          <form onSubmit={onSalvarProjudi} className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600 sm:col-span-1">
              CPF (login PROJUDI)
              <input
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="00000000000"
                required
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 sm:col-span-1">
              Senha
              <input
                type="password"
                value={senhaProjudi}
                onChange={(e) => setSenhaProjudi(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
              Rótulo (opcional)
              <input
                value={rotuloProjudi}
                onChange={(e) => setRotuloProjudi(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Escritório principal"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={Boolean(salvando)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {salvando === 'projudi' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar credencial PROJUDI
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {isAdmin ? (
        <section className="space-y-4 border-t border-slate-100 pt-6">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-sky-700" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-800">PJe TRT18 — credencial PDPJ</h3>
          </div>
          {pjeLista.length ? (
            <ul className="space-y-2">
              {pjeLista.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>
                    Login <span className="font-mono">{c.login}</span>
                    {c.senhaCadastrada ? ' · senha OK' : ' · senha pendente'}
                    {!c.ativo ? ' · inativa' : ''}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void onTestarPje(c.id)}
                      disabled={Boolean(salvando)}
                      className="text-xs font-medium text-sky-800 hover:underline"
                    >
                      Testar TOTP
                    </button>
                    <button
                      type="button"
                      onClick={() => void onAtualizarSenhaPje(c.id)}
                      disabled={Boolean(salvando)}
                      className="text-xs font-medium text-sky-800 hover:underline"
                    >
                      Trocar senha
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Nenhuma credencial PJe cadastrada nesta instância.</p>
          )}
          <form onSubmit={onSalvarPje} className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600 sm:col-span-1">
              Login PJe
              <input
                value={loginPje}
                onChange={(e) => setLoginPje(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 sm:col-span-1">
              Senha (1º fator)
              <input
                type="password"
                value={senhaPje}
                onChange={(e) => setSenhaPje(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
              Secret TOTP ou URI otpauth://
              <textarea
                rows={2}
                value={secretPje}
                onChange={(e) => setSecretPje(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
                placeholder="otpauth://totp/... ou secret Base32"
                required
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={Boolean(salvando)}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
              >
                {salvando === 'pje' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar credencial PJe
              </button>
            </div>
          </form>
          <VisorCodigoPdpj />
        </section>
      ) : (
        <VisorCodigoPdpj />
      )}

      <section className="space-y-3 border-t border-slate-100 pt-6">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-violet-700" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-800">E-mail do sistema</h3>
        </div>
        <p className="text-sm text-slate-600">
          Conta remetente: OAuth Gmail
          {status?.gmailConta ? (
            <>
              {' '}
              (<span className="font-mono text-xs">{status.gmailConta}</span>
              {status.gmailTokensConfigurados ? ', tokens OK' : ', tokens pendentes'})
            </>
          ) : (
            ' (configure tokens no servidor desta instância)'
          )}
          . Destinatários abaixo valem só para protocolo PROJUDI agendado nesta instância.
        </p>
        <form onSubmit={onSalvarEmail}>
          <label className="block text-xs font-medium text-slate-600">
            Destinatários do protocolo PROJUDI (vírgula ou quebra de linha)
            <textarea
              rows={2}
              value={emailProtocolo}
              onChange={(e) => setEmailProtocolo(e.target.value)}
              disabled={Boolean(salvando)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={Boolean(salvando)}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-60"
          >
            {salvando === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Salvar destinatários
          </button>
        </form>
      </section>
    </div>
  );
}
