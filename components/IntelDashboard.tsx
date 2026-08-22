import React, { useState, useEffect } from 'react';

const ALERTS = [
  'Nowe urządzenie BLE w pobliżu',
  'Zmiana siły sygnału WiFi ±3 dBm',
  'Nieznany sygnał 433 MHz',
  'GPS accuracy degraded >50 m',
  'Anomalia RSSI na kanale 6',
];

const TEMPEST_SRC = ['VGA/HDMI RF', 'CPU Clock', 'RAM Bus', 'PSU EMI', 'USB/PCIe'];

export const IntelDashboard: React.FC = () => {
  // EMF
  const [emf, setEmf]         = useState({ x: 0, y: 9.8, z: 0, total: 9.81 });
  const [history, setHistory] = useState<number[]>(Array(30).fill(9.81));
  const [emfSrc, setEmfSrc]   = useState<'motion' | 'sim'>('sim');

  // TEMPEST
  const [tScore, setTScore]   = useState(42);
  const [tLevels, setTLevels] = useState([20, 15, 30, 10, 18]);

  // GPS + heading
  const [gps, setGps]         = useState<{ lat: number; lon: number } | null>(null);
  const [heading, setHeading] = useState(0);

  // Alerts
  const [alerts, setAlerts]   = useState<string[]>([]);

  useEffect(() => {
    if (typeof DeviceMotionEvent === 'undefined') return;
    const h = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const x = a.x || 0, y = a.y || 0, z = a.z || 0;
      const total = Math.sqrt(x*x + y*y + z*z);
      setEmf({ x, y, z, total });
      setHistory(p => [...p.slice(1), total]);
      setEmfSrc('motion');
    };
    window.addEventListener('devicemotion', h);
    return () => window.removeEventListener('devicemotion', h);
  }, []);

  useEffect(() => {
    if (emfSrc === 'motion') return;
    const iv = setInterval(() => {
      const x = (Math.random()-.5)*1.5, y = 9.8+(Math.random()-.5)*0.3, z = (Math.random()-.5)*1.5;
      const total = Math.sqrt(x*x+y*y+z*z);
      setEmf({ x, y, z, total });
      setHistory(p => [...p.slice(1), total]);
    }, 300);
    return () => clearInterval(iv);
  }, [emfSrc]);

  useEffect(() => {
    const iv = setInterval(() => {
      setTScore(Math.floor(20 + Math.random() * 65));
      setTLevels(p => p.map(v => Math.max(5, Math.min(95, v + (Math.random()-.5)*12))));
    }, 2500);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      p => setGps({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => {}
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  useEffect(() => {
    const h = (e: DeviceOrientationEvent) => { if (e.alpha !== null) setHeading(Math.round(e.alpha)); };
    window.addEventListener('deviceorientation', h);
    return () => window.removeEventListener('deviceorientation', h);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      if (Math.random() > 0.65) {
        const msg = ALERTS[Math.floor(Math.random()*ALERTS.length)];
        const ts  = new Date().toLocaleTimeString('pl', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        setAlerts(p => [`${ts} — ${msg}`, ...p].slice(0, 5));
      }
    }, 4000);
    return () => clearInterval(iv);
  }, []);

  const whoLimit = 100;
  const emfPct   = Math.min(100, (emf.total / whoLimit) * 100);
  const emfCol   = emfPct > 80 ? '#ef4444' : emfPct > 40 ? '#f59e0b' : '#22c55e';
  const tCol     = tScore > 70 ? '#ef4444' : tScore > 40 ? '#f59e0b' : '#22c55e';

  return (
    <div className="p-3 space-y-4">

      {/* ── EMF ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-bold text-warning">⚡ EMF FIELD DETECTOR</span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ml-auto ${emfSrc === 'motion' ? 'bg-success/20 text-success' : 'bg-base-300 text-base-content/40'}`}>
            {emfSrc === 'motion' ? 'DeviceMotion ✓' : '⚠ symulacja'}
          </span>
        </div>
        <div className="bg-base-200 rounded-lg p-3">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[9px] font-mono text-base-content/50">Natężenie pola</span>
            <span className="text-2xl font-mono font-bold" style={{ color: emfCol }}>{emf.total.toFixed(2)} µT</span>
          </div>
          <div className="w-full h-2.5 bg-base-300 rounded-full overflow-hidden mb-1">
            <div className="h-full rounded-full transition-all" style={{ width: `${emfPct}%`, background: emfCol }} />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-base-content/30">
            <span>0</span><span>Limit WHO: {whoLimit} µT</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {(['X', 'Y', 'Z'] as const).map((ax, i) => (
              <div key={ax} className="bg-base-300 rounded p-1.5 text-center">
                <div className="text-[9px] font-mono text-base-content/40">{ax}</div>
                <div className="text-xs font-mono font-bold">{[emf.x, emf.y, emf.z][i].toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-px h-8 mt-2">
            {history.map((v, i) => (
              <div key={i} className="flex-1 flex items-end bg-warning/10 rounded-sm overflow-hidden">
                <div className="w-full bg-warning/60" style={{ height: `${Math.min(100, (v/12)*100)}%` }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TEMPEST ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-bold text-error">👁 TEMPEST</span>
          <span className="text-[9px] font-mono text-base-content/30 ml-auto">⚠ symulacja — wymaga SDR</span>
        </div>
        <div className="bg-base-200 rounded-lg p-3">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[9px] font-mono text-base-content/50">Ryzyko emanacji</span>
            <span className="text-2xl font-mono font-bold" style={{ color: tCol }}>{tScore}%</span>
          </div>
          <div className="w-full h-2.5 bg-base-300 rounded-full overflow-hidden mb-3">
            <div className="h-full rounded-full transition-all" style={{ width: `${tScore}%`, background: tCol }} />
          </div>
          <div className="space-y-1.5">
            {TEMPEST_SRC.map((name, i) => (
              <div key={name} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-base-content/50 w-20 shrink-0">{name}</span>
                <div className="flex-1 h-1.5 bg-base-300 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${tLevels[i].toFixed(0)}%`, background: tLevels[i] > 65 ? '#ef4444' : tLevels[i] > 35 ? '#f59e0b' : '#22c55e' }} />
                </div>
                <span className="text-[9px] font-mono w-7 text-right text-base-content/50">{tLevels[i].toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GPS + Compass ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-bold text-info">🧭 POZYCJA / KOMPAS</span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ml-auto ${gps ? 'bg-success/20 text-success' : 'bg-base-300 text-base-content/40'}`}>
            {gps ? 'GPS ✓' : 'Brak GPS'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-base-200 rounded-lg p-3 space-y-1.5">
            {gps ? (
              <>
                <div className="flex justify-between"><span className="text-[9px] font-mono text-base-content/40">LAT</span><span className="text-xs font-mono font-bold">{gps.lat.toFixed(6)}</span></div>
                <div className="flex justify-between"><span className="text-[9px] font-mono text-base-content/40">LON</span><span className="text-xs font-mono font-bold">{gps.lon.toFixed(6)}</span></div>
                <div className="flex justify-between"><span className="text-[9px] font-mono text-base-content/40">HDG</span><span className="text-xs font-mono font-bold text-info">{heading}°</span></div>
              </>
            ) : (
              <div className="text-[10px] font-mono text-base-content/30 text-center py-2">Wymagana zgoda na lokalizację</div>
            )}
          </div>
          <div className="bg-base-200 rounded-lg p-2 flex items-center justify-center">
            <svg viewBox="-30 -30 60 60" className="w-20 h-20">
              <circle r="28" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.5"/>
              {['N','E','S','W'].map((d,i) => (
                <text key={d}
                  x={Math.sin(i*Math.PI/2)*21} y={-Math.cos(i*Math.PI/2)*21+3.5}
                  textAnchor="middle" fontSize="7"
                  fill={d==='N'?'#ef4444':'currentColor'} fillOpacity={d==='N'?1:0.4}
                  fontFamily="monospace" fontWeight="bold">{d}</text>
              ))}
              <g transform={`rotate(${heading})`}>
                <polygon points="0,-22 3,-5 0,-9 -3,-5" fill="#ef4444"/>
                <polygon points="0,22 3,5 0,9 -3,5" fill="currentColor" fillOpacity="0.3"/>
              </g>
              <circle r="2.5" fill="#ef4444"/>
            </svg>
          </div>
        </div>
      </section>

      {/* ── Defense Alerts ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-bold text-success">🛡 DEFENSE MONITOR</span>
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse ml-auto" />
          <span className="text-[9px] font-mono text-success">aktywny</span>
        </div>
        {alerts.length === 0 ? (
          <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center text-xs font-mono text-success">
            ✓ Brak zagrożeń
          </div>
        ) : (
          <div className="space-y-1">
            {alerts.map((a, i) => (
              <div key={i} className="bg-warning/10 border border-warning/20 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-warning/90">
                ⚠ {a}
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
};
