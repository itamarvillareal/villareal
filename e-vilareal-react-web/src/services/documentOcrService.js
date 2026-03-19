const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
]);

export function isMimeTypeSuportado(mime) {
  if (!mime) return false;
  const tipo = mime.split(';')[0].trim().toLowerCase();
  return SUPPORTED_IMAGE_MIME_TYPES.has(tipo) || tipo === 'application/pdf';
}

async function carregarTesseract() {
  try {
    const mod = await import(
      /* @vite-ignore */ 'https://unpkg.com/tesseract.js@5.1.0/dist/tesseract.esm.min.js'
    );
    return mod.default || mod;
  } catch {
    throw new Error(
      'OCR indisponível no momento (falha ao carregar o mecanismo OCR remoto).'
    );
  }
}

async function carregarPdfJs() {
  try {
    const mod = await import(
      /* @vite-ignore */ 'https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.mjs'
    );
    const pdfjsLib = mod.default || mod;
    // URL do worker obrigatória em pdf.js 4.x
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
    return pdfjsLib;
  } catch {
    throw new Error(
      'Falha ao carregar o leitor de PDF para OCR. Tente novamente ou converta o PDF em imagem.'
    );
  }
}

async function pdfParaImagemBlob(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await carregarPdfJs();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error(
              'Não foi possível converter o PDF em imagem para OCR. Tente novamente ou use uma imagem direta (JPG/PNG).'
            )
          );
          return;
        }
        resolve(blob);
      },
      'image/png',
      0.92
    );
  });
}

export async function rodarOcrDocumento(file) {
  if (!file) throw new Error('Nenhum arquivo informado para OCR.');
  const tipo = (file.type || '').split(';')[0].trim().toLowerCase();
  if (!isMimeTypeSuportado(tipo)) {
    throw new Error('Tipo de arquivo não suportado para OCR (use PDF, JPG, PNG ou WEBP).');
  }

  let entradaParaOcr = file;
  if (tipo === 'application/pdf') {
    // Converte a primeira página do PDF em imagem para ser processada pelo Tesseract.
    const blobImagem = await pdfParaImagemBlob(file);
    entradaParaOcr = new File([blobImagem], `${file.name || 'documento'}.png`, {
      type: 'image/png',
    });
  }

  const lang = 'por+eng';
  const Tesseract = await carregarTesseract();

  const { data } = await Tesseract.recognize(entradaParaOcr, lang, {
    logger: () => {},
  });

  const texto = String(data.text || '').replace(/\r\n/g, '\n');

  return {
    texto,
    confidence: typeof data.confidence === 'number' ? data.confidence : null,
  };
}

