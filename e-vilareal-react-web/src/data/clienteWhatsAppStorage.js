const STORAGE_PREFIX = 'vilareal:cliente-whatsapp:';

export function loadClienteWhatsAppLocal(codigoCliente) {
  if (!codigoCliente) return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + String(codigoCliente).trim());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveClienteWhatsAppLocal(codigoCliente, itens) {
  if (!codigoCliente) return;
  try {
    localStorage.setItem(STORAGE_PREFIX + String(codigoCliente).trim(), JSON.stringify(itens ?? []));
  } catch {
    /* ignore */
  }
}
