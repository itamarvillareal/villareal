/**
 * Datas em planilhas Villa Real (layout BR): interpreta texto dd/mm/aaaa ou d/m/aa
 * como dia/mês/ano — não usa serial Excel (armazenamento US mm/dd).
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * @param {number} dia
 * @param {number} mes
 * @param {number} ano
 * @returns {string | null} yyyy-MM-dd
 */
function isoFromDiaMesAno(dia, mes, ano) {
  if (!Number.isFinite(dia) || !Number.isFinite(mes) || !Number.isFinite(ano)) return null;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const dim = new Date(ano, mes, 0).getDate();
  if (dia > dim) return null;
  return `${ano}-${pad2(mes)}-${pad2(dia)}`;
}

/**
 * Texto exibido na célula (dd/mm/aaaa ou d/m/aa), sempre dia/mês/ano brasileiro.
 * @param {unknown} v
 * @returns {string | null}
 */
export function parseDataPlanilhaBrIso(v) {
  if (v == null || v === "") return null;
  const t = String(v).trim();
  if (!t) return null;

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const dia = Number(br[1]);
    const mes = Number(br[2]);
    let ano = Number(br[3]);
    if (ano < 100) ano += ano >= 70 ? 1900 : 2000;
    return isoFromDiaMesAno(dia, mes, ano);
  }

  return null;
}

/**
 * Célula da planilha: prefere o texto formatado (`raw: false`) ao serial numérico.
 * @param {unknown} rawVal valor com raw:true (número serial ou string)
 * @param {unknown} [fmtVal] valor com raw:false (texto como no Excel)
 * @returns {string | null}
 */
export function parseDataPlanilhaCellIso(rawVal, fmtVal) {
  const fromFmt = parseDataPlanilhaBrIso(fmtVal);
  if (fromFmt) return fromFmt;
  if (typeof rawVal === "string") return parseDataPlanilhaBrIso(rawVal);
  return null;
}
