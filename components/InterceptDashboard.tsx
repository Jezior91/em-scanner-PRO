import React, { useState, useEffect, useRef, useCallback } from 'react';

const PRESETS = [
  { id:'p1', name:'315 MHz OOK',  freq:'315.000',  mod:'OOK',  desc:'Piloty bram, RSA' },
  { id:'p2', name:'433 MHz OOK',  freq:'433.920',  mod:'OOK',  desc:'Piloty, czujniki' },
  { id:'p3', name:'433 MHz FSK',  freq:'433.920',  mod:'FSK',  desc:'TPMS, termometry' },
  { id:'p4', name:'868 MHz LoRa', freq:'868.000',  mod:'LoRa', desc:'IoT EU band' },
  { id:'p5', name:'GSM 900 DL',   freq:'935.000',  mod:'GMSK', desc:'GSM downlink' },
  { id:'p6', name:'ISM 2.4 GHz',  freq:'2400.000', mod:'FHSS', desc:'Klawiatura, mysz' },
];

export const InterceptDashboard: React.FC = () => {
  const [bars, setBars]       = useState<number[]>(Array(48).fill(0));
  const [micOk, setMicOk]     = useState(false);
  const [preset, setPreset]   = useState('p1');
  const [recording, setRec]   = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [showSrc, setShowSrc] = useState(false);
  const [txInfo, setTxInfo]   = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef      = useRef<number>(0);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

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
        setBars(Array.from(d).slice(0, 48).map(v => v / 255));
      } else {
        setBars(p => p.map((v, i) => {
          const spike = (i===3||i===10||i===27||i===43) ? 0.08 : 0;
          return Math.max(0, Math.min(1, v + spike + (Math.random()-.58)*0.09));
        }));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  function toggleRec() {
    if (recording) {
      clearInterval(timerRef.current!);
      setRec(false); setRecSecs(0);
    } else {
      setRec(true);
      timerRef.current = setInterval(() => setRecSecs(t => t + 1), 1000);
    }
  }

  const sel = PRESETS.find(p => p.id === preset) || PRESETS[0];

  return (
    <div className="p-3 space-y-4">

      {/* ── SDR Spectrum ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-bold text-green-400">📻 SDR SPECTRUM</span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ml-auto ${micOk ? 'bg-warning/20 text-warning' : 'bg-base-300 text-base-content/40'}`}>
            {micOk ? '🎙 MIC fallback' : '⚠ symulacja'}
          </span>
        </div>
        <div className="bg-black rounded-xl p-2.5">
          <div className="flex items-end gap-px h-24">
            {bars.map((v, i) => (
              <div key={i} className="flex-1 flex items-end" style={{ minHeight: 2 }}>
                <div className="w-full rounded-t-sm" style={{
                  height: `${Math.max(2, v*100)}%`,
                  background: `hsl(${120-v*120},100%,${35+v*30}%)`
                }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] font-mono text-white/20 mt-1">
            <span>0 Hz</span>
            <button onClick={() => setShowSrc(s => !s)} className="text-white/20 hover:text-white/50 transition-colors px-2">
              {micOk ? '🎙 MIC' : '◦ SIM'} {showSrc ? '▲' : '▼'}
            </button>
            <span>Nyquist</span>
          </div>
        </div>

        {/* Fallback chain — ukryta, rozwijana */}
        {showSrc && (
          <div className="grid grid-cols-4 gap-1 mt-1.5 animate-[fadeIn_0.15s_ease]">
            {[
              { label: 'HackRF', ok: false },
              { label: 'WS Bridge', ok: false },
              { label: 'MIC FFT', ok: micOk },
              { label: 'SIM', ok: !micOk },
            ].map(({ label, ok }) => (
              <div key={label} className={`rounded px-1.5 py-1 text-center text-[9px] font-mono ${ok ? 'bg-success/15 text-success' : 'bg-base-300/50 text-base-content/30'}`}>
                <div className={`w-1.5 h-1.5 rounded-full mx-auto mb-0.5 ${ok ? 'bg-success animate-pulse' : 'bg-base-300'}`} />
                {label}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Presets ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-bold text-warning">🎯 INTERCEPT PRESETS</span>
          <button onClick={() => setTxInfo(t => !t)} className="text-[9px] font-mono text-base-content/20 hover:text-base-content/50 ml-auto transition-colors">ⓘ TX/TX</button>
        </div>
        {txInfo && (
          <div className="bg-error/10 border border-error/20 rounded-lg p-2.5 mb-2 text-[10px] font-mono text-error/80">
            TX / JAM wymaga HackRF One podłączonego przez USB i serwera mostka (hackrf_server.py). Odbiór (RX) działa bez sprzętu.
          </div>
        )}
        <div className="space-y-1">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => setPreset(p.id)}
              className={`w-full text-left rounded-lg px-3 py-2 transition-colors flex items-center gap-2 ${
                preset === p.id ? 'bg-warning/10 border border-warning/30' : 'bg-base-200 hover:bg-base-300'
              }`}>
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${preset === p.id ? 'bg-warning' : 'bg-base-300'}`} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-mono font-bold">{p.name}</span>
                <span className="text-[9px] font-mono text-base-content/40 ml-2">{p.desc}</span>
              </div>
              <span className="text-[9px] font-mono text-base-content/40 shrink-0">{p.mod}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {[['Freq', `${sel.freq} MHz`], ['Mod', sel.mod], ['Band', 'EU']].map(([k, v]) => (
            <div key={k} className="bg-base-300 rounded p-1.5 text-center">
              <div className="text-[9px] font-mono text-base-content/40">{k}</div>
              <div className="text-xs font-mono font-bold">{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Signal Grabber ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-bold text-secondary">⏺ SIGNAL GRABBER</span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ml-auto ${micOk ? 'bg-success/20 text-success' : 'bg-base-300 text-base-content/40'}`}>
            {micOk ? '🎙 MIC gotowy' : 'Brak mikrofonu'}
          </span>
        </div>
        <div className="bg-base-200 rounded-xl p-4 flex items-center gap-4">
          <button onClick={toggleRec}
            className={`btn btn-circle ${recording ? 'btn-error animate-pulse' : 'btn-primary'}`}>
            {recording ? '■' : '●'}
          </button>
          <div>
            <div className={`text-base font-mono font-bold ${recording ? 'text-error' : 'text-base-content/40'}`}>
              {recording ? `⏺ REC  ${recSecs}s` : 'GOTOWY'}
            </div>
            <div className="text-[9px] font-mono text-base-content/30">
              {recording ? 'Nagrywanie sygnału audio/SDR' : 'Naciśnij aby nagrać sygnał'}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
