import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  agendaUsuarios,
  agendaDataEsquerda,
  agendaEventosTerça,
  agendaEventosQuarta,
  agendaCalendarioMarco2026,
} from '../data/mockData';

/** Retorna string DD/MM/YYYY para dia/mês/ano */
function dataStr(dia, mes, ano) {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function ColunaDia({ dataLabel, eventos, vazias = 8 }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col border border-gray-300 rounded bg-white overflow-hidden">
      <div className="px-2 py-1.5 bg-gray-100 border-b border-gray-300 text-sm font-medium text-gray-800">
        {dataLabel}
      </div>
      <div className="flex-1 overflow-auto p-1">
        {eventos.map((ev) => (
          <div
            key={ev.id}
            className={`flex gap-2 py-1 px-2 text-sm border-b border-gray-100 ${
              ev.destaque ? 'bg-amber-100' : ''
            }`}
          >
            {ev.hora && (
              <span className="shrink-0 font-medium text-gray-600 w-10">
                {ev.hora}
              </span>
            )}
            <span className="text-gray-800 truncate" title={ev.descricao}>
              {ev.descricao}
            </span>
          </div>
        ))}
        {Array.from({ length: vazias }).map((_, i) => (
          <div
            key={`vazio-${i}`}
            className="py-1 px-2 text-sm border-b border-gray-100 min-h-[28px] text-gray-400"
          >
            {'\u00A0'}
          </div>
        ))}
      </div>
    </div>
  );
}

function PainelCalendario({
  mesAtual,
  anoAtual,
  setMesAtual,
  setAnoAtual,
  diaSelecionado,
  setDiaSelecionado,
  usuarioSelecionado,
  setUsuarioSelecionado,
  nomeGrupo = 'painel',
}) {
  const hoje = agendaCalendarioMarco2026.hoje ?? 10;
  const primeiroDiaSemana = 0;
  const dias = Array.from({ length: 31 }, (_, i) => i + 1);
  const nomeMesAtual = MESES[mesAtual - 1] ?? '';

  return (
    <aside className="w-56 shrink-0 flex flex-col gap-4 p-4 bg-gray-100 border border-gray-300 rounded-lg overflow-y-auto">
      <div className="border border-gray-300 rounded-lg p-3 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => {
              if (mesAtual <= 1) { setMesAtual(12); setAnoAtual((a) => a - 1); }
              else setMesAtual((m) => m - 1);
            }}
            className="p-1.5 rounded hover:bg-gray-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium capitalize">
            {nomeMesAtual} {anoAtual}
          </span>
          <button
            type="button"
            onClick={() => {
              if (mesAtual >= 12) { setMesAtual(1); setAnoAtual((a) => a + 1); }
              else setMesAtual((m) => m + 1);
            }}
            className="p-1.5 rounded hover:bg-gray-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-xs">
          {agendaCalendarioMarco2026.diasSemana.map((d) => (
            <div key={d} className="text-center font-medium text-gray-600 py-0.5">
              {d}
            </div>
          ))}
          {Array.from({ length: primeiroDiaSemana }).map((_, i) => (
            <div key={`v-${i}`} />
          ))}
          {dias.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDiaSelecionado(d)}
              className={`py-1 rounded text-xs ${
                d === diaSelecionado
                  ? 'bg-blue-600 text-white font-medium'
                  : d === hoje
                    ? 'bg-blue-400 text-white'
                    : 'hover:bg-gray-200 text-gray-800'
              }`}
            >
              {String(d).padStart(2, '0')}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Hoje: {agendaDataEsquerda}
        </p>
      </div>

      <div>
        <div className="text-sm font-medium text-gray-700 mb-1">Usuário:</div>
        <div className="space-y-1">
          {agendaUsuarios.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name={`usuario-${nomeGrupo}`}
                value={u.id}
                checked={usuarioSelecionado === u.id}
                onChange={() => setUsuarioSelecionado(u.id)}
                className="text-blue-600"
              />
              {u.nome}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <button type="button" className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-200">
          Pesquisar
        </button>
        <button type="button" className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-200">
          Opções
        </button>
        <button type="button" className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-200">
          Fechar
        </button>
      </div>
    </aside>
  );
}

export function Agenda() {
  const [usuarioEsquerda, setUsuarioEsquerda] = useState('itamar');
  const [usuarioDireita, setUsuarioDireita] = useState('itamar');
  const [mesAtual, setMesAtual] = useState(3);
  const [anoAtual, setAnoAtual] = useState(2026);
  const [diaEsquerda, setDiaEsquerda] = useState(agendaCalendarioMarco2026.diaSelecionado ?? 10);
  const [diaDireita, setDiaDireita] = useState(11);

  const eventosPorData = useMemo(() => ({
    [agendaDataEsquerda]: agendaEventosTerça,
    '11/03/2026': agendaEventosQuarta,
  }), []);

  const dataEsquerdaStr = dataStr(diaEsquerda, mesAtual, anoAtual);
  const dataDireitaStr = dataStr(diaDireita, mesAtual, anoAtual);

  const eventosEsquerda = eventosPorData[dataEsquerdaStr] ?? [];
  const eventosDireita = eventosPorData[dataDireitaStr] ?? [];

  return (
    <div className="flex flex-1 min-h-0 p-4 gap-4 overflow-hidden">
      {/* Painel esquerdo: Calendário + Usuário + Botões */}
      <PainelCalendario
        mesAtual={mesAtual}
        anoAtual={anoAtual}
        setMesAtual={setMesAtual}
        setAnoAtual={setAnoAtual}
        diaSelecionado={diaEsquerda}
        setDiaSelecionado={setDiaEsquerda}
        usuarioSelecionado={usuarioEsquerda}
        setUsuarioSelecionado={setUsuarioEsquerda}
        nomeGrupo="esquerda"
      />

      {/* Área central: duas colunas de compromissos (simétricas) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
        <h1 className="text-xl font-semibold text-gray-800 text-center py-2 border-b border-gray-200">
          Agenda
        </h1>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <ColunaDia
            dataLabel={`${dataEsquerdaStr} — Compromissos do dia`}
            eventos={eventosEsquerda}
            vazias={12}
          />
          <ColunaDia
            dataLabel={`${dataDireitaStr} — Próximo dia`}
            eventos={eventosDireita}
            vazias={12}
          />
        </div>
      </div>

      {/* Painel direito: Calendário + Usuário + Botões (espelho do esquerdo) */}
      <PainelCalendario
        mesAtual={mesAtual}
        anoAtual={anoAtual}
        setMesAtual={setMesAtual}
        setAnoAtual={setAnoAtual}
        diaSelecionado={diaDireita}
        setDiaSelecionado={setDiaDireita}
        usuarioSelecionado={usuarioDireita}
        setUsuarioSelecionado={setUsuarioDireita}
        nomeGrupo="direita"
      />
    </div>
  );
}
