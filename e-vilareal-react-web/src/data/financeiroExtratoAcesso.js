import { featureFlags } from '../config/featureFlags.js';
import {
  getApiUsuarioSessao,
  getPerfilAtivoParaPermissoes,
  idEhUsuarioMasterEstacao,
  USUARIO_MASTER_ID,
} from './usuarioPermissoesStorage.js';

/** Banco do Brasil */
export const NUMERO_BANCO_BB = 3;
/** Caixa Econômica Federal */
export const NUMERO_BANCO_CEF = 5;
/** Cora */
export const NUMERO_BANCO_CORA = 26;

const BANCOS_KARLA = [NUMERO_BANCO_BB, NUMERO_BANCO_CEF, NUMERO_BANCO_CORA];
const KARLA_PERFIL_IDS = new Set(['karla', '2']);

export function usuarioTemAcessoTotalExtratos(perfilId, login) {
  const id = String(perfilId ?? '').trim();
  if (idEhUsuarioMasterEstacao(id)) return true;
  const l = String(login ?? '')
    .trim()
    .toLowerCase();
  return l === 'itamar' || l.startsWith('itamar.');
}

export function usuarioEhKarlaExtrato(perfilId, login) {
  const id = String(perfilId ?? '').trim();
  if (KARLA_PERFIL_IDS.has(id)) return true;
  const l = String(login ?? '')
    .trim()
    .toLowerCase();
  return l === 'karla' || l.startsWith('karla.');
}

function loginEfetivoParaExtrato(perfilId, login) {
  if (login != null && String(login).trim()) return login;
  const api = featureFlags.requiresApiAuth ? getApiUsuarioSessao() : null;
  if (api?.login) return api.login;
  return String(perfilId) === USUARIO_MASTER_ID ? 'itamar' : String(perfilId ?? '');
}

/** @returns {number[] | null} null = todos os bancos; array = apenas esses números. */
export function getBancosExtratoPermitidosParaUsuario(perfilId, login) {
  const loginEfetivo = loginEfetivoParaExtrato(perfilId, login);
  if (usuarioTemAcessoTotalExtratos(perfilId, loginEfetivo)) return null;
  if (usuarioEhKarlaExtrato(perfilId, loginEfetivo)) return BANCOS_KARLA.slice();
  return null;
}

export function getBancosExtratoPermitidosUsuario() {
  const perfilId = getPerfilAtivoParaPermissoes();
  return getBancosExtratoPermitidosParaUsuario(perfilId);
}

export function usuarioPodeAcessarExtratoBanco(numeroBanco, perfilId, login) {
  const permitidos =
    perfilId != null || login != null
      ? getBancosExtratoPermitidosParaUsuario(perfilId, login)
      : getBancosExtratoPermitidosUsuario();
  if (permitidos == null) return true;
  const n = Number(numeroBanco);
  return Number.isFinite(n) && permitidos.includes(n);
}

export function filtrarBancosPorAcessoExtrato(bancos, perfilId, login) {
  const permitidos =
    perfilId != null || login != null
      ? getBancosExtratoPermitidosParaUsuario(perfilId, login)
      : getBancosExtratoPermitidosUsuario();
  if (permitidos == null) return bancos;
  const set = new Set(permitidos);
  return bancos.filter((b) => set.has(b.numero));
}
