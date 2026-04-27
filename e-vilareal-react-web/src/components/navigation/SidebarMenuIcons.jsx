/**
 * Ícones coloridos do menu lateral — SVG escalável, estilo flat com leve profundidade.
 * IDs de gradiente únicos por instância (useId) para evitar colisão no DOM.
 *
 * O botão «Cálculos» em Processos usa o mesmo ícone do grupo «Calcular» (calcular-grupo).
 * O item «Cálculos» (id calculos) usa Lucide Calculator para diferenciar no submenu.
 */

import { useId } from 'react';
import { Calculator as LucideCalculator, Receipt, Wallet } from 'lucide-react';

function IconIptuMenu({ className }) {
  return <Receipt className={className} strokeWidth={2} aria-hidden />;
}

const shadow = { filter: 'drop-shadow(0 1px 1px rgb(0 0 0 / 0.1))' };

function IconPessoas({ className }) {
  const uid = useId().replace(/:/g, '');
  const gO = `pessoas-o-${uid}`;
  const gB = `pessoas-b-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={gB} x1="6" y1="4" x2="14" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id={gO} x1="10" y1="6" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <ellipse cx="9" cy="9" rx="4.5" ry="5" fill={`url(#${gB})`} opacity="0.98" />
      <circle cx="9" cy="7" r="2.2" fill="#1e3a5f" />
      <ellipse cx="15" cy="11" rx="5" ry="5.5" fill={`url(#${gO})`} />
      <circle cx="15" cy="8.5" r="2.4" fill="#9a3412" />
    </svg>
  );
}

/** Lista (submenu Todas as pessoas). */
function IconListaPessoas({ className }) {
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <path d="M8 7h12M8 12h12M8 17h9" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="5" cy="7" r="1.35" fill="#38bdf8" />
      <circle cx="5" cy="12" r="1.35" fill="#38bdf8" />
      <circle cx="5" cy="17" r="1.35" fill="#38bdf8" />
    </svg>
  );
}

/** Nova pessoa (ícone user +). */
function IconNovaPessoa({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `nova-p-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="3" y1="4" x2="13" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4ade80" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
      <circle cx="9.5" cy="8.5" r="4" fill={`url(#${g})`} stroke="#14532d" strokeWidth="0.35" />
      <path d="M4.5 19.5c.8-3.2 3.5-5 5-5s4.2 1.8 5 5" stroke="#14532d" strokeWidth="1.35" strokeLinecap="round" />
      <circle cx="18" cy="7" r="4.5" fill="#2563eb" stroke="#1e3a8a" strokeWidth="0.35" />
      <path d="M18 5v4M16 7h4" stroke="#e0f2fe" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconClientes({ className }) {
  const uid = useId().replace(/:/g, '');
  const gF = `cli-f-${uid}`;
  const gBk = `cli-bk-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={gBk} x1="4" y1="6" x2="12" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60a5fa" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id={gF} x1="8" y1="5" x2="16" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4ade80" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <ellipse cx="8" cy="10" rx="4.2" ry="5" fill={`url(#${gBk})`} />
      <circle cx="8" cy="7.5" r="2.1" fill="#1e3a5f" />
      <ellipse cx="14" cy="11" rx="4.8" ry="5.2" fill={`url(#${gF})`} />
      <circle cx="14" cy="8.5" r="2.2" fill="#78350f" />
    </svg>
  );
}

function IconFolderProcessos({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `fld-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="4" y1="6" x2="20" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="0.5" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <path
        d="M4 8.5c0-1 .9-1.8 2-1.8h4.2l1.2 1.5H18c1.1 0 2 .8 2 1.8v8.5c0 1-.9 1.8-2 1.8H6c-1.1 0-2-.8-2-1.8V8.5z"
        fill={`url(#${g})`}
        stroke="#1e40af"
        strokeWidth="0.55"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Diário / publicações oficiais (submenu Processos). */
function IconPublicacoes({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `pub-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="5" y1="3" x2="19" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
      </defs>
      <path
        d="M7 3.5h10.5a2 2 0 012 2v13a2.5 2.5 0 01-2.5 2.5H7A2.5 2.5 0 014.5 18V6a2.5 2.5 0 012.5-2.5z"
        fill={`url(#${g})`}
        stroke="#0c4a6e"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path d="M8 8.5h8M8 11.5h8M8 14.5h5.5" stroke="#e0f2fe" strokeWidth="1.15" strokeLinecap="round" />
      <path d="M16 16.5l1.2 1.2 2.3-2.3" stroke="#fef08a" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconRelatorioProcessos({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `rp-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="5" y1="4" x2="19" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#93c5fd" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect x="5" y="3" width="14" height="18" rx="2" fill={`url(#${g})`} stroke="#1d4ed8" strokeWidth="0.55" />
      <rect x="8" y="6" width="8" height="1.2" rx="0.4" fill="#e0f2fe" opacity="0.95" />
      <rect x="8" y="8.5" width="5" height="1" rx="0.3" fill="#bfdbfe" opacity="0.75" />
      <rect x="9" y="12" width="2.5" height="6" rx="0.4" fill="#f59e0b" />
      <rect x="12" y="10" width="2.5" height="8" rx="0.4" fill="#fbbf24" />
      <rect x="15" y="13" width="2.5" height="5" rx="0.4" fill="#fb923c" />
    </svg>
  );
}

/** Mesmo pictograma do botão «Cálculos» na tela Processos (`lucide-react` Calculator). */
function IconCalculationsLucide({ className }) {
  return (
    <LucideCalculator
      className={`block shrink-0 ${className ?? ''}`}
      strokeWidth={1.75}
      aria-hidden
    />
  );
}

function IconCalculator({ className }) {
  const uid = useId().replace(/:/g, '');
  const gb = `calc-b-${uid}`;
  const gs = `calc-s-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={gb} x1="5" y1="4" x2="19" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde047" />
          <stop offset="1" stopColor="#eab308" />
        </linearGradient>
        <linearGradient id={gs} x1="7" y1="6" x2="17" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
      </defs>
      <rect x="5" y="4" width="14" height="16" rx="2.2" fill={`url(#${gb})`} stroke="#ca8a04" strokeWidth="0.55" />
      <rect x="7" y="6" width="10" height="4" rx="0.8" fill={`url(#${gs})`} />
      <circle cx="9" cy="13" r="1.1" fill="#ef4444" />
      <circle cx="12" cy="13" r="1.1" fill="#22c55e" />
      <circle cx="15" cy="13" r="1.1" fill="#3b82f6" />
      <circle cx="9" cy="16.5" r="1.1" fill="#a855f7" />
      <circle cx="12" cy="16.5" r="1.1" fill="#f97316" />
      <circle cx="15" cy="16.5" r="1.1" fill="#64748b" />
    </svg>
  );
}

function IconRelatorioCalculos({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `rtc-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="4" y1="5" x2="20" y2="19" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5eead4" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect x="4" y="5" width="16" height="14" rx="1.5" fill={`url(#${g})`} stroke="#0f766e" strokeWidth="0.5" />
      <path d="M7 8h10M7 11h10M7 14h6" stroke="#ccfbf1" strokeWidth="0.75" strokeLinecap="round" />
      <rect x="14" y="12.5" width="2.2" height="4" rx="0.3" fill="#fbbf24" />
      <rect x="17" y="11" width="2.2" height="5.5" rx="0.3" fill="#fb923c" />
    </svg>
  );
}

function IconLandmarkImoveis({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `lm-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="6" y1="18" x2="18" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <path d="M12 3L4 9v11h16V9l-8-6z" fill={`url(#${g})`} stroke="#047857" strokeWidth="0.5" strokeLinejoin="round" />
      <rect x="9" y="12" width="2.5" height="4" fill="#e0f2fe" opacity="0.95" rx="0.3" />
      <rect x="12.5" y="12" width="2.5" height="4" fill="#e0f2fe" opacity="0.95" rx="0.3" />
      <rect x="10" y="8" width="4" height="2.5" fill="#fef3c7" rx="0.3" />
    </svg>
  );
}

function IconBuilding({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `bld-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="6" y1="20" x2="18" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8fafc" />
          <stop offset="0.5" stopColor="#bae6fd" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <rect x="7" y="8" width="10" height="12" rx="1" fill={`url(#${g})`} stroke="#0369a1" strokeWidth="0.5" />
      <rect x="9" y="11" width="2" height="2" fill="#0c4a6e" rx="0.2" />
      <rect x="13" y="11" width="2" height="2" fill="#0c4a6e" rx="0.2" />
      <rect x="9" y="15" width="2" height="2" fill="#0c4a6e" rx="0.2" />
      <rect x="13" y="15" width="2" height="2" fill="#0c4a6e" rx="0.2" />
      <ellipse cx="8" cy="20.5" rx="2" ry="1" fill="#22c55e" />
      <ellipse cx="16" cy="20.5" rx="2" ry="1" fill="#22c55e" />
      <path d="M6 20h12" stroke="#15803d" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconSpreadsheet({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `ss-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="5" y1="4" x2="19" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a7f3d0" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect x="5" y="4" width="14" height="16" rx="1.5" fill={`url(#${g})`} stroke="#047857" strokeWidth="0.5" />
      <path d="M5 8.5h14M9.5 4v16M14.5 4v16M5 12.5h14" stroke="#ecfdf5" strokeWidth="0.55" opacity="0.9" />
    </svg>
  );
}

function IconAgenda({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `ag-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="4" y1="4" x2="20" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fb7185" />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
      </defs>
      <rect x="4" y="7" width="16" height="14" rx="1.5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.55" />
      <rect x="4" y="5" width="16" height="5" rx="1.5" fill={`url(#${g})`} />
      <path d="M7 4.5v3M17 4.5v3" stroke="#fecdd3" strokeWidth="1.1" strokeLinecap="round" />
      <rect x="7" y="11.5" width="3" height="2.5" rx="0.35" fill="#cbd5e1" />
      <rect x="11.5" y="11.5" width="3" height="2.5" rx="0.35" fill="#cbd5e1" />
      <rect x="16" y="11.5" width="2.5" height="2.5" rx="0.35" fill="#cbd5e1" />
    </svg>
  );
}

function IconAtividade({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `at-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="6" y1="4" x2="18" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde047" />
          <stop offset="1" stopColor="#eab308" />
        </linearGradient>
      </defs>
      <rect x="6" y="5" width="12" height="15" rx="1.5" fill={`url(#${g})`} stroke="#ca8a04" strokeWidth="0.5" />
      <path d="M6 7h12" stroke="#22c55e" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8 10h8M8 13h6M8 16h7" stroke="#854d0e" strokeWidth="0.75" strokeLinecap="round" opacity="0.45" />
      <circle cx="17" cy="16" r="3.5" fill="#22c55e" stroke="#fff" strokeWidth="0.55" />
      <path d="M15.3 16l1.2 1.2 2.2-2.4" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFinanceiro({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `fin-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="5" y1="5" x2="19" y2="19" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4ade80" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="8.5" fill={`url(#${g})`} stroke="#14532d" strokeWidth="0.55" />
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="#bbf7d0" strokeWidth="0.35" opacity="0.55" />
      <text
        x="12"
        y="15.5"
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="700"
        fill="#fef08a"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        $
      </text>
    </svg>
  );
}

function IconPendencias({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `pen-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="4" y1="18" x2="20" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde047" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <path d="M12 4l9.5 16H2.5L12 4z" fill={`url(#${g})`} stroke="#b45309" strokeWidth="0.55" strokeLinejoin="round" />
      <path d="M12 9v5M12 16.5v.5" stroke="#1c1917" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

function IconDiagnosticos({ className }) {
  const uid = useId().replace(/:/g, '');
  const gp = `dg-p-${uid}`;
  const gg = `dg-g-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={gp} x1="3" y1="18" x2="13" y2="5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id={gg} x1="14" y1="8" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fcd34d" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <circle cx="8.5" cy="10" r="4.5" fill={`url(#${gp})`} stroke="#4c1d95" strokeWidth="0.4" />
      <circle cx="8.5" cy="9" r="1.6" fill="#312e81" />
      <path d="M5.5 17c1-1.8 2.5-2.8 3.5-2.8s2.5 1 3.5 2.8" stroke="#4338ca" strokeWidth="1" strokeLinecap="round" fill="none" />
      <circle cx="17" cy="15" r="3.6" fill={`url(#${gg})`} stroke="#92400e" strokeWidth="0.4" />
      <path
        d="M17 12.5v5M14.8 15h4.4"
        stroke="#fff"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.95"
      />
    </svg>
  );
}

function IconUsuarios({ className }) {
  const uid = useId().replace(/:/g, '');
  const gu = `usr-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={gu} x1="4" y1="6" x2="16" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="9" r="3.6" fill={`url(#${gu})`} stroke="#1e40af" strokeWidth="0.45" />
      <path d="M5 19c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" fill={`url(#${gu})`} stroke="#1e40af" strokeWidth="0.45" />
      <circle cx="17.5" cy="11" r="2.8" fill="#60a5fa" stroke="#1e3a8a" strokeWidth="0.4" />
      <path
        d="M17.5 9.3v3.4M15.8 11h3.4"
        stroke="#1e3a8a"
        strokeWidth="0.65"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMonitoramento({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `mon-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" stroke={`url(#${g})`} strokeWidth="1.2" fill="none" opacity="0.35" />
      <circle cx="12" cy="12" r="5.5" stroke={`url(#${g})`} strokeWidth="1" fill="none" opacity="0.55" />
      <circle cx="12" cy="12" r="2.2" fill={`url(#${g})`} stroke="#312e81" strokeWidth="0.35" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" stroke="#6366f1" strokeWidth="0.9" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function IconTopicos({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `top-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="4" y1="6" x2="22" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      {[6, 11, 16].map((y, i) => (
        <g key={y}>
          <circle cx="6" cy={y} r="1.6" fill={`url(#${g})`} opacity={1 - i * 0.12} />
          <rect x="9.5" y={y - 1.25} width="12" height="2.5" rx="1" fill={`url(#${g})`} opacity={0.88 - i * 0.1} />
        </g>
      ))}
    </svg>
  );
}

/** Painel / gestão de tópicos (submenu). */
function IconGerenteTopicos({ className }) {
  const uid = useId().replace(/:/g, '');
  const g = `gtop-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g} x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <rect x="3.5" y="4" width="17" height="14" rx="2" stroke={`url(#${g})`} strokeWidth="1.2" fill="none" opacity="0.85" />
      <path d="M7 9h10M7 12h6" stroke={`url(#${g})`} strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="17" cy="12" r="2.2" fill={`url(#${g})`} opacity="0.95" />
      <path d="M16.2 12.6l0.6 0.6 1.4-1.4" stroke="#fff" strokeWidth="0.55" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPagamentosMenu({ className }) {
  return (
    <Wallet className={`block shrink-0 ${className ?? ''}`} strokeWidth={1.75} style={shadow} aria-hidden />
  );
}

function IconConfiguracoes({ className }) {
  const uid = useId().replace(/:/g, '');
  const g1 = `cfg1-${uid}`;
  const g2 = `cfg2-${uid}`;
  return (
    <svg className={`block shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="none" style={shadow} aria-hidden>
      <defs>
        <linearGradient id={g1} x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#94a3b8" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
        <linearGradient id={g2} x1="10" y1="8" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <circle cx="9.5" cy="10" r="4.8" fill={`url(#${g1})`} stroke="#334155" strokeWidth="0.45" />
      <circle cx="9.5" cy="10" r="1.85" fill="#f1f5f9" stroke="#475569" strokeWidth="0.25" />
      <circle cx="15.5" cy="14" r="4.2" fill={`url(#${g2})`} stroke="#065f46" strokeWidth="0.4" />
      <circle cx="15.5" cy="14" r="1.5" fill="#ecfdf5" stroke="#059669" strokeWidth="0.25" />
    </svg>
  );
}

const MENU_ICONS = {
  clientes: IconPessoas,
  'pessoas-grupo': IconPessoas,
  'clientes/lista': IconListaPessoas,
  'clientes/relatorio': IconRelatorioProcessos,
  'clientes/nova': IconNovaPessoa,
  pessoas: IconClientes,
  'processos-grupo': IconFolderProcessos,
  processos: IconFolderProcessos,
  'processos/publicacoes': IconPublicacoes,
  'processos/monitoramento': IconMonitoramento,
  relatorio: IconRelatorioProcessos,
  'calcular-grupo': IconCalculator,
  calculos: IconCalculationsLucide,
  'relatorio-calculos': IconRelatorioCalculos,
  'admin-imoveis-grupo': IconLandmarkImoveis,
  imoveis: IconBuilding,
  iptu: IconIptuMenu,
  'imoveis/relatorio-financeiro': IconFinanceiro,
  'relatorio-imoveis': IconSpreadsheet,
  agenda: IconAgenda,
  'ana-luisa': IconClientes,
  atividade: IconAtividade,
  'atividades-em-lote': IconTopicos,
  financeiro: IconFinanceiro,
  pagamentos: IconPagamentosMenu,
  pendencias: IconPendencias,
  'topicos-grupo': IconTopicos,
  topicos: IconTopicos,
  'topicos/gerente': IconGerenteTopicos,
  diagnosticos: IconDiagnosticos,
  'integracoes-grupo': IconMonitoramento,
  'integracoes/scraper-lab': IconRelatorioProcessos,
  usuarios: IconUsuarios,
  configuracoes: IconConfiguracoes,
};

/**
 * @param {{ id: string, className?: string }} props
 */
export function SidebarMenuIcon({ id, className }) {
  const Cmp = MENU_ICONS[id];
  if (!Cmp) return null;
  return <Cmp className={className} />;
}
