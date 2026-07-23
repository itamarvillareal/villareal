import {
  baixarP7sAssinadoInicial,
  listarArquivosAssinadosInicial,
} from '../api/iniciaisProjudiApi.js';

function nomeArquivoP7s(nomeOriginal, nomeP7s) {
  const base = String(nomeOriginal ?? '').trim();
  if (base.toLowerCase().endsWith('.p7s')) return base;
  if (base.toLowerCase().endsWith('.pdf')) return `${base.slice(0, -4)}.p7s`;
  if (base) return `${base}.p7s`;
  return String(nomeP7s ?? 'documento.p7s');
}

/**
 * Baixa os .p7s já assinados da inicial (última petição ASSINADA) para a lista de protocolo.
 * @param {string} codigoCliente
 * @param {number|string} numeroInterno
 * @returns {Promise<{ key: string, file: File, idArquivoTipo: number }[]>}
 */
export async function baixarLinhasP7sAssinadosInicial(codigoCliente, numeroInterno) {
  const arquivos = await listarArquivosAssinadosInicial({ codigoCliente, numeroInterno });
  if (!Array.isArray(arquivos) || arquivos.length === 0) return [];

  return Promise.all(
    arquivos.map(async (arq) => {
      const nome = nomeArquivoP7s(arq.nomeOriginal, arq.nomeP7s);
      const blob = await baixarP7sAssinadoInicial({
        arquivoId: arq.arquivoId,
        codigoCliente,
        numeroInterno,
        nomeFallback: nome,
      });
      const file = new File([blob], nome, { type: 'application/pkcs7-signature' });
      return {
        key: `assinado-${arq.arquivoId}`,
        file,
        idArquivoTipo: arq.idArquivoTipo ?? (arq.ordem === 1 ? 16 : 1),
      };
    }),
  );
}
