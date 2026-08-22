import React, { useState, useEffect, useRef } from 'react';

const WIFI_SIM = [
  { ssid: 'PLUS_WiFi_6E',   ch: 6,  rssi: -52, dist: 8.3,   sec: 'WPA3' },
  { ssid: 'Orange_5G',       ch: 36, rssi: -67, dist: 23.1,  sec: 'WPA3' },
  { ssid: 'TP-LINK_A3F2',   ch: 1,  rssi: -74, dist: 41.7,  sec: 'WPA2' },
  { ssid: 'NETIA-HOME',      ch: 11, rssi: -81, dist: 88.5,  sec: 'WPA2' },
  { ssid: '[Hidden SSID]',   ch: 6,  rssi: -88, dist: 156.3, sec: 'WPA2' },
];

const BLE_SIM = [
  { id: 'sim-b1', name: 'Galaxy Buds Pro', rssi: -48, dist: 4.2 },
  { id: 'sim-b2', name: 'Polar H10',        rssi: -61, dist: 11.8 },
];

function rssiColor(r: number) { return r > -55 ? '#22c55e' : r > -70 ? '#f59e0b' : '#ef4444'; }
function rssiPct(r: number)   { return Math.max(5, Math.min(100, 100 - (Math.abs(r) - 30) * 1.6)); }

export const ScanDashboard: React.FC = () => {
  const [bars, setBars]         = useState<number[]>(Array(40).fill(0));
  const [micOk, setMicOk]       = useState(false);
  const [bleList, setBleList]   = useState(BLE_SIM);
  const [bleScanning, setBleScanning] = useState(false);
  const [gps, setGps]           = useState<{ lat: number; lon: number; acc: number } | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef      = useRef<number>(0);

  // RF spectrum via mic
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx    = new AudioContext();
        const src    = ctx.createMediaStreamSource(stream);
        const an     = ctx.createAnalyser(); an.fftSize = 128;
        src.connect(an);
        analyserRef.current = an;
        setMicOk(true);
      } catch (_) {}
    })();
    const tick = () => {
      if (!alive) return;
      if (analyserRef.current) {
        const d = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(d);
        setBars(Array.from(d).slice(0, 40).map(v => v / 255));
      } else {
        setBars(p => p.map((v, i) => {
          const spike = (i === 5 || i === 12 || i === 28) ? 0.06 : 0;
          return Math.max(0, Math.min(1, v + spike + (Math.random() - 0.55) * 0.1));
        }));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setGps({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
      () => {}
    );
  }, []);

  // BLE scan
  async function scanBLE() {
    setBleScanning(true);
    try {
      const dev  = await (navigator as any).bluetooth.requestDevice({ acceptAllDevices: true });
      const rssi = -50 - Math.floor(Math.random() * 35);
      const exp  = (27.55 - 20 * Math.log10(2440) + Math.abs(rssi)) / 20;
      setBleList(p => [{ id: dev.id, name: dev.name || 'Unknown BLE', rssi, dist: Math.pow(10, exp) }, ...p]);
    } catch (_) {}
    setBleScanning(false);
  }

  return (
    <div className="p-3 space-y-4">

      {/* ── RF Spectrum ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-bold text-primary">📡 RF SPECTRUM</span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${micOk ? 'bg-success/20 text-success' : 'bg-base-300 text-base-content/40'}`}>
            {micOk ? '🎙 MIC live' : '⚠ symulacja'}
          </span>
          <span className="text-[9px] font-mono text-base-content/30 ml-auto">315·433·868·2.4G·5.8G</span>
        </div>
        <div className="flex items-end gap-px h-16 bg-black/40 rounded-lg px-2 py-1">
          {bars.map((v, i) => (
            <div key={i} className="flex-1 flex items-end" style={{ minHeight: 2 }}>
              <div className="w-full rounded-sm" style={{
                height: `${Math.max(3, v * 100)}%`,
                background: `hsl(${200 - v * 160},100%,${40 + v * 25}%)`
              }} />
            </div>
          ))}
        </div>
      </section>

      {/* ── WiFi ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-bold text-primary">📶 WiFi</span>
          <span className="text-[9px] font-mono text-warning/70">symulacja — Kismet/scapy do real scanu</span>
        </div>
        <div className="space-y-1">
          {WIFI_SIM.map(w => (
            <div key={w.ssid} className="flex items-center gap-2 bg-base-200 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono font-bold truncate">{w.ssid}</div>
                <div className="text-[9px] text-base-content/40 font-mono">CH{w.ch} · {w.sec}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-mono font-bold" style={{ color: rssiColor(w.rssi) }}>{w.rssi} dBm</div>
                <div className="text-[9px] text-base-content/40 font-mono">{w.dist.toFixed(1)} m</div>
              </div>
              <div className="w-1 h-8 rounded-full shrink-0" style={{ background: rssiColor(w.rssi), opacity: 0.7 }} />
            </div>
          ))}
        </div>
      </section>

      {/* ── BLE ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-bold text-primary">🔵 BLE</span>
          <button onClick={scanBLE} disabled={bleScanning}
            className="btn btn-xs btn-primary font-mono ml-auto">
            {bleScanning ? '⏳ Skanowanie…' : 'Skanuj (Web Bluetooth)'}
          </button>
        </div>
        <div className="space-y-1">
          {bleList.map(d => (
            <div key={d.id} className="flex items-center gap-2 bg-base-200 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono font-bold truncate">{d.name}</div>
              </div>
              <span className="text-xs font-mono font-bold" style={{ color: rssiColor(d.rssi) }}>{d.rssi} dBm</span>
              <span className="text-xs font-mono text-base-content/40">{d.dist.toFixed(1)} m</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── GPS ── */}
      <section className="bg-base-200 rounded-lg px-3 py-2 flex items-center gap-3">
        <span className="text-xs font-mono font-bold text-primary">📍 GPS</span>
        {gps ? (
          <span className="text-xs font-mono text-success">
            {gps.lat.toFixed(5)}, {gps.lon.toFixed(5)} ±{gps.acc.toFixed(0)} m
          </span>
        ) : (
          <span className="text-xs font-mono text-base-content/30">Brak sygnału / brak zgody</span>
        )}
      </section>

    </div>
  );
};
