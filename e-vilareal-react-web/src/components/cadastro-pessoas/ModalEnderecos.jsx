import { useState, useEffect, useRef } from 'react';
import { X, Search } from 'lucide-react';

export function ModalEnderecos({
  open,
  onClose,
  nomePessoa,
  codigoPessoa,
  enderecos,
  onChange,
  sugestaoEndereco = null,
}) {
  const [numero, setNumero] = useState(1);
  const [rua, setRua] = useState('');
  const [bairro, setBairro] = useState('');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [cep, setCep] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const sessaoAbertaRef = useRef(false);

  useEffect(() => {
    if (!open) {
      sessaoAbertaRef.current = false;
      return;
    }
    if (sessaoAbertaRef.current) return;
    sessaoAbertaRef.current = true;

    const lista = Array.isArray(enderecos) ? enderecos : [];
    setNumero(lista.length + 1);

    const s = sugestaoEndereco;
    const temSugestao =
      s &&
      (String(s.rua || '').trim() ||
        String(s.cep || '').replace(/\D/g, '') ||
        String(s.cidade || '').trim());
    if (temSugestao) {
      setRua(String(s.rua || '').trim());
      setBairro(String(s.bairro || '').trim());
      setEstado(String(s.estado || '').trim());
      setCidade(String(s.cidade || '').trim());
      setCep(String(s.cep || '').replace(/\D/g, '').slice(0, 8));
    }
  }, [open, sugestaoEndereco, enderecos]);

  if (!open) return null;

  const lista = Array.isArray(enderecos) ? enderecos : [];

  const estados = [
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  ];

  const buscarCep = async () => {
    const apenasNumeros = cep.replace(/\D/g, '');
    if (apenasNumeros.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${apenasNumeros}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setRua(data.logradouro || '');
        setBairro(data.bairro || '');
        setEstado(data.uf || '');
        setCidade(data.localidade || '');
      }
    } catch {
      /* rede / CEP indisponível */
    }
    setBuscandoCep(false);
  };

  const incluir = () => {
    if (!rua.trim()) return;
    const novo = {
      numero: numero,
      rua: rua.trim(),
      bairro: bairro.trim(),
      estado,
      cidade: cidade.trim(),
      cep: cep.replace(/\D/g, ''),
      autoPreenchido: false,
    };
    onChange([...lista, novo]);
    setRua(''); setBairro(''); setEstado(''); setCidade(''); setCep(''); setNumero(lista.length + 2);
  };

  const remover = (index) => {
    onChange(lista.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">Endereços</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {nomePessoa && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-800">{nomePessoa}</p>
              {codigoPessoa != null && <p className="text-sm text-gray-500">Código: {codigoPessoa}</p>}
            </div>
          )}
          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 w-20">Número:</label>
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setNumero((n) => Math.max(1, n - 1))}
                  className="px-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={numero}
                  onChange={(e) => setNumero(parseInt(e.target.value, 10) || 1)}
                  className="w-16 text-center border-x border-gray-300 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setNumero((n) => n + 1)}
                  className="px-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rua</label>
              <input
                type="text"
                value={rua}
                onChange={(e) => setRua(e.target.value)}
                placeholder="Logradouro"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
              <input
                type="text"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Selecione</option>
                  {estados.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                <input
                  type="text"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Cidade"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                <input
                  type="text"
                  value={cep}
                  onChange={(e) => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="00000-000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={buscarCep}
                disabled={buscandoCep || cep.replace(/\D/g, '').length < 8}
                className="p-2.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                title="Buscar CEP"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={incluir}
                className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Incluir
              </button>
            </div>
          </div>
          {lista.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 border-b border-gray-200">
                Endereços incluídos
              </div>
              <ul className="divide-y divide-gray-200">
                {lista.map((e, i) => (
                  <li
                    key={i}
                    className={`px-3 py-2 flex justify-between items-start text-sm ${
                      e.autoPreenchido ? 'bg-amber-50' : ''
                    }`}
                  >
                    <span className="text-gray-700">
                      {e.rua}
                      {e.numero ? `, ${e.numero}` : ''}
                      {e.bairro ? ` – ${e.bairro}` : ''}
                      {e.cidade || e.estado ? ` – ${e.cidade || ''} ${e.estado || ''}`.trim() : ''}
                      {e.cep ? ` – CEP ${e.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => remover(i)}
                      className="text-red-600 hover:underline ml-2"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex justify-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
