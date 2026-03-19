const MAP_SUBSTITUCOES_OCR = [
  { de: /(?<=\d)[Oo](?=\d)/g, para: '0' },
  { de: /(?<=\d)[Ii](?=\d)/g, para: '1' },
  { de: /(?<=\d)[Ss](?=\d)/g, para: '5' },
  { de: /(?<=\d)[Bb](?=\d)/g, para: '8' },
];

export function normalizarTextoBruto(texto) {
  const original = String(texto || '');
  const semQuebrasRuins = original.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');
  const linhas = semQuebrasRuins.split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  const textoLimpo = linhas.join('\n');

  let textoNumericoCorrigido = textoLimpo;
  MAP_SUBSTITUCOES_OCR.forEach(({ de, para }) => {
    textoNumericoCorrigido = textoNumericoCorrigido.replace(de, para);
  });

  const upper = textoNumericoCorrigido.toUpperCase();

  return {
    original,
    textoLimpo,
    textoCorrigido: textoNumericoCorrigido,
    upper,
    linhas: textoNumericoCorrigido.split('\n'),
    upperLinhas: upper.split('\n'),
  };
}

