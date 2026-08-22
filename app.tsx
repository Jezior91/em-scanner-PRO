import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Radio, Eye, Crosshair, Sliders } from 'lucide-react';
import type { TabId } from './types';
import { ScanDashboard }      from './components/ScanDashboard';
import { IntelDashboard }     from './components/IntelDashboard';
import { InterceptDashboard } from './components/InterceptDashboard';
import { TrackerEQ }          from './components/TrackerEQ';

const TABS = [
  { id: 'scan'      as TabId, icon: <Radio size={18}/>,    label: 'SCAN',      sub: 'RF·WiFi·BLE·GPS',    color: 'text-primary',  border: 'border-primary'  },
  { id: 'intel'     as TabId, icon: <Eye size={18}/>,      label: 'INTEL',     sub: 'EMF·TEMPEST·Defense', color: 'text-warning',  border: 'border-warning'  },
  { id: 'intercept' as TabId, icon: <Crosshair size={18}/>,label: 'INTERCEPT', sub: 'SDR·Presets·Grab',   color: 'text-error',    border: 'border-error'    },
  { id: 'eq'        as TabId, icon: <Sliders size={18}/>,  label: 'EQ / TACT', sub: 'EQ·CoT·P2P·Track',   color: 'text-cyan-400', border: 'border-cyan-400' },
];

const App: React.FC = () => {
  const [active, setActive] = useState<TabId>('scan');

  return (
    <div className="flex flex-col h-screen bg-base-100 overflow-hidden">

      {/* ── Header ── */}
      <div className="bg-base-300 border-b border-base-content/10 px-4 py-2 flex items-center gap-3 shrink-0">
        <span className="text-primary font-mono font-bold text-sm tracking-widest">📡 EM SCANNER PRO</span>
        <span className="text-[10px] text-base-content/30 font-mono">v5.1</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse"/>
          <span className="text-xs text-success font-mono font-bold">LIVE</span>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-base-300 bg-base-200 shrink-0">
        {TABS.map(t => {
          const on = active === t.id;
          return (
            <button key={t.id} onClick={() => setActive(t.id)}
              className={`flex-1 px-1 py-2.5 flex flex-col items-center gap-0.5 transition-all border-b-2 ${
                on ? `${t.border} ${t.color} bg-base-100` : 'border-transparent text-base-content/40 hover:text-base-content/60'
              }`}>
              <span className={on ? t.color : ''}>{t.icon}</span>
              <span className="text-xs font-bold font-mono">{t.label}</span>
              <span className="text-[9px] opacity-50 font-mono hidden sm:block">{t.sub}</span>
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {active === 'scan'      && <ScanDashboard />}
        {active === 'intel'     && <IntelDashboard />}
        {active === 'intercept' && <InterceptDashboard />}
        {active === 'eq'        && <TrackerEQ />}
      </div>

    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
