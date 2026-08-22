import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Band {
  id: string; label: string; freq: string;
  gain: number; level: number; color: string;
}

interface TrackedSig {
  id: number; freq: string; level: number;
  lat: number | null; lon: number | null;
  bearing: number; ts: number;
}

const INIT_BANDS: Band[] = [
  { id:'lf',   label:'LF',   freq:'30-300kHz',   gain:0, level:0, color:'#6366f1' },
  { id:'mf',   label:'MF',   freq:'300k-3MHz',   gain:0, level:0, color:'#8b5cf6' },
  { id:'hf',   label:'HF',   freq:'3-30MHz',     gain:0, level:0, color:'#a855f7' },
  { id:'vhf',  label:'VHF',  freq:'30-300MHz',   gain:0, level:0, color:'#06b6d4' },
  { id:'uhf',  label:'UHF',  freq:'300M-3GHz',   gain:0, level:0, color:'#10b981' },
  { id:'wifi', label:'WiFi', freq:'2.4/5GHz',    gain:0, level:0, color:'#f59e0b' },
  { id:'bt',   label:'BT',   freq:'2.402GHz',    gain:0, level:0, color:'#ef4444' },
  { id:'cell', label:'Cell', freq:'0.7-2.7GHz',  gain:0, level:0, color:'#f97316' },
];

const COT_MARKERS = [
  { uid:'u1', callsign:'ALPHA-1', lat:52.2297, lon:21.0122, type:'a-f-G', color:'#3b82f6' },
  { uid:'u2', callsign:'BRAVO-2', lat:52.2315, lon:21.0148, type:'a-h-G', color:'#ef4444' },
  { uid:'u3', callsign:'CHARLIE', lat:52.2280, lon:21.0098, type:'a-n-G', color:'#f59e0b' },
];

function toXY(lat: number, lon: number): [number, number] {
  return [
    Math.max(8, Math.min(192, 100 + (lon - 21.0122) * 6000)),
    Math.max(8, Math.min(192, 100 - (lat - 52.2297) * 6000)),
  ];
}

export const TrackerEQ: React.FC = () => {
  const [bands, setBands]       = useState<Band[]>(INIT_BANDS);
  const [signals, setSignals]   = useState<TrackedSig[]>([]);
  const [gps, setGps]           = useState<{ lat: number; lon: number } | null>(null);
  const [heading, setHeading]   = useState(0);
  const [audioOn, setAudioOn]   = useState(false);
  const [audioSrc, setAudioSrc] = useState<'mic' | 'sim'>('sim');
  const [sdpOffer, setSdpOffer] = useState('');
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef      = useRef<AudioContext | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number>(0);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const sigIdRef    = useRef(0);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      p => setGps({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => {}, { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Heading
  useEffect(() => {
    const h = (e: DeviceOrientationEvent) => { if (e.alpha !== null) setHeading(Math.round(e.alpha)); };
    window.addEventListener('deviceorientation', h);
    return () => window.removeEventListener('deviceorientation', h);
  }, []);

  // Audio
  const startAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx    = new AudioContext();
      const src    = ctx.createMediaStreamSource(stream);
      const an     = ctx.createAnalyser(); an.fftSize = 2048;
      src.connect(an);
      analyserRef.current = an; ctxRef.current = ctx; streamRef.current = stream;
      setAudioSrc('mic'); setAudioOn(true);
    } catch {
      setAudioSrc('sim'); setAudioOn(true);
    }
  }, []);

  const stopAudio = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    ctxRef.current?.close();
    analyserRef.current = null; ctxRef.current = null; streamRef.current = null;
    cancelAnimationFrame(rafRef.current);
    setAudioOn(false);
  }, []);

  // EQ level update
  useEffect(() => {
    if (!audioOn) {
      const iv = setInterval(() => {
        setBands(p => p.map(b => ({ ...b, level: Math.max(0, Math.min(100, b.level + (Math.random()-.48)*12)) })));
      }, 120);
      return () => clearInterval(iv);
    }
    if (!analyserRef.current) return;
    const data  = new Uint8Array(analyserRef.current.frequencyBinCount);
    const rngs  = [0.01, 0.03, 0.06, 0.12, 0.25, 0.35, 0.5, 0.7];
    const draw  = () => {
      analyserRef.current!.getByteFrequencyData(data);
      const len = data.length;
      setBands(p => p.map((b, i) => {
        const s = Math.floor(rngs[i]*len), e = Math.floor((rngs[i+1]||1)*len);
        let sum = 0; for (let j=s; j<e; j++) sum += data[j];
        return { ...b, level: Math.round((sum/(e-s))/255*100) };
      }));
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [audioOn]);

  // Canvas draw
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = c.width, H = c.height, bW = W / bands.length;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(6,182,212,0.08)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = (i/10)*H;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    bands.forEach((b, i) => {
      const x = i*bW+2;
      const lvl = Math.max(0, Math.min(100, b.level + b.gain*4));
      const bH  = (lvl/100)*H;
      const grd = ctx.createLinearGradient(x, H-bH, x, H);
      grd.addColorStop(0, b.color+'ff'); grd.addColorStop(1, b.color+'44');
      ctx.fillStyle = grd; ctx.shadowColor = b.color; ctx.shadowBlur = 8;
      ctx.fillRect(x, H-bH, bW-4, bH);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff';
      ctx.fillRect(x, H-bH-2, bW-4, 2);
    });
  }, [bands]);

  function addSignal() {
    const top = [...bands].sort((a,b) => b.level-a.level)[0];
    const id  = ++sigIdRef.current;
    setSignals(p => [{ id, freq: top.freq, level: top.level, lat: gps?.lat??null, lon: gps?.lon??null,
      bearing: Math.round(Math.random()*360), ts: Date.now() }, ...p.slice(0, 9)]);
  }

  async function createOffer() {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('em-p2p');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setSdpOffer((offer.sdp||'').slice(0,140)+'…');
    } catch (_) {
      setSdpOffer('⚠ WebRTC niedostępne');
    }
  }

  return (
    <div className="p-3 space-y-4">

      {/* ── EQ Header ── */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-cyan-400">🎚 EQUALIZER + TRACKER</span>
        <div className="flex gap-1.5">
          <span className={`badge badge-xs ${gps ? 'badge-success' : 'badge-ghost'}`}>
            {gps ? '📍 GPS' : '📍 SIM'}
          </span>
          <span className={`badge badge-xs ${audioSrc==='mic' ? 'badge-info' : 'badge-ghost'}`}>
            {audioSrc==='mic' ? '🎤 MIC' : '🔁 SIM'}
          </span>
        </div>
      </div>

      {/* ── EQ Canvas ── */}
      <section>
        <div className="rounded-lg overflow-hidden border border-cyan-900 bg-black">
          <canvas ref={canvasRef} width={600} height={130} className="w-full" />
        </div>

        {/* Band labels + gain sliders */}
        <div className="grid grid-cols-8 gap-0.5 mt-2">
          {bands.map(b => (
            <div key={b.id} className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-bold font-mono" style={{ color: b.color }}>{b.label}</span>
              <span className="text-[8px] text-base-content/40">{b.gain>0?'+':''}{b.gain}</span>
              <input type="range" min={-12} max={12} step={1} value={b.gain}
                onChange={e => setBands(p => p.map(x => x.id===b.id ? {...x, gain:+e.target.value} : x))}
                className="range range-xs w-full" style={{ accentColor: b.color }} />
              <span className="text-[8px] text-base-content/40">{b.level}%</span>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-2 mt-2 flex-wrap">
          {!audioOn
            ? <button onClick={startAudio} className="btn btn-xs btn-info">⚡ Start EQ</button>
            : <button onClick={stopAudio}  className="btn btn-xs btn-error">■ Stop EQ</button>
          }
          <button onClick={() => setBands(p => p.map(b => ({...b, gain:0})))} className="btn btn-xs btn-ghost">Reset Gain</button>
          <button onClick={addSignal} className="btn btn-xs btn-warning">🎯 Track Signal</button>
        </div>
      </section>

      {/* ── Tracked Signals ── */}
      {signals.length > 0 && (
        <section>
          <div className="text-xs font-mono font-bold text-cyan-400 mb-2">📌 NAMIERZONE SYGNAŁY</div>
          <div className="space-y-1">
            {signals.map((s, i) => (
              <div key={s.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${i===0 ? 'bg-warning/10 border border-warning/20' : 'bg-base-200'}`}>
                <span className="text-[9px] font-mono text-base-content/40 w-4">{s.id}</span>
                <span className="text-xs font-mono flex-1">{s.freq}</span>
                <div className="w-12 h-1.5 bg-base-300 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width:`${s.level}%` }} />
                </div>
                <span className="text-[9px] font-mono w-8 text-right">{s.level}%</span>
                <span className="text-[9px] font-mono text-base-content/40">{s.bearing}°</span>
                <span className="text-[9px] font-mono text-base-content/30">{new Date(s.ts).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── CoT Tactical Map ── */}
      <section>
        <div className="text-xs font-mono font-bold text-orange-400 mb-2">🗺 TACTICAL MAP (CoT/ATAK)</div>
        <div className="bg-slate-900 rounded-xl overflow-hidden border border-base-300">
          <svg viewBox="0 0 200 200" className="w-full" style={{ maxHeight: 200 }}>
            <rect width="200" height="200" fill="#0f172a"/>
            {[0,50,100,150,200].map(v => (
              <React.Fragment key={v}>
                <line x1={v} y1="0" x2={v} y2="200" stroke="white" strokeOpacity="0.04" strokeWidth="0.5"/>
                <line x1="0" y1={v} x2="200" y2={v} stroke="white" strokeOpacity="0.04" strokeWidth="0.5"/>
              </React.Fragment>
            ))}
            <circle cx="100" cy="100" r="30" fill="none" stroke="white" strokeOpacity="0.06" strokeDasharray="3,3" strokeWidth="0.5"/>
            <circle cx="100" cy="100" r="60" fill="none" stroke="white" strokeOpacity="0.04" strokeDasharray="3,3" strokeWidth="0.5"/>
            {COT_MARKERS.map(m => {
              const [x,y] = toXY(m.lat, m.lon);
              return (
                <g key={m.uid}>
                  <circle cx={x} cy={y} r="9" fill={m.color} fillOpacity="0.15"/>
                  <circle cx={x} cy={y} r="4" fill={m.color}/>
                  <text x={x+6} y={y-6} fontSize="7" fill={m.color} fontFamily="monospace" fontWeight="bold">{m.callsign}</text>
                </g>
              );
            })}
            <line x1="95" y1="100" x2="105" y2="100" stroke="white" strokeOpacity="0.3" strokeWidth="0.5"/>
            <line x1="100" y1="95" x2="100" y2="105" stroke="white" strokeOpacity="0.3" strokeWidth="0.5"/>
          </svg>
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {COT_MARKERS.map(m => (
            <div key={m.uid} className="flex items-center gap-1 bg-base-200 rounded px-2 py-1">
              <div className="w-2 h-2 rounded-sm" style={{ background: m.color }}/>
              <span className="text-[9px] font-mono">{m.callsign}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── P2P Mesh ── */}
      <section>
        <div className="text-xs font-mono font-bold text-cyan-400 mb-2">🔗 P2P OFFLINE MESH</div>
        <button onClick={createOffer} className="btn btn-sm btn-info font-mono w-full mb-2">
          📡 Utwórz SDP Offer (WebRTC)
        </button>
        {sdpOffer && (
          <div className="bg-base-300 rounded-lg p-2.5">
            <div className="text-[9px] font-mono text-base-content/40 mb-1">SDP OFFER (fragment)</div>
            <div className="text-[9px] font-mono text-success break-all leading-4">{sdpOffer}</div>
          </div>
        )}
        <div className="text-[9px] font-mono text-base-content/40 mt-1.5">
          💡 Brak serwera STUN/TURN — działa w sieci lokalnej (WiFi Ad-Hoc / hotspot)
        </div>
      </section>

    </div>
  );
};
