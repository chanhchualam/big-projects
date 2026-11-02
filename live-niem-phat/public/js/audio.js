/**
 * ÂM THANH bằng Web Audio API (tổng hợp, không cần file):
 *  - mõ (cốc cốc), chuông chùa, chuông nhỏ (chime), nhạc nền nhẹ (drone + chuông gió)
 *  - Nếu có file public/assets/bgm.mp3 thì dùng làm nhạc nền thay cho nhạc tổng hợp
 */
window.TD = window.TD || {};

TD.Audio = (function () {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let bgmBus = null;
  let muted = false;
  let localMuted = false; // dùng cho iframe preview
  let cfg = { volume: 0.7, bgm: true, bgmVolume: 0.35, bgmFile: '' };
  let bgmStarted = false;
  let bgmEl = null;
  let chimeTimer = null;
  let lastPlay = {}; // chống phát dồn dập cùng 1 âm

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    bgmBus = ctx.createGain();
    bgmBus.connect(master);
    applyVolume();
    return ctx;
  }

  function applyVolume() {
    if (!master) return;
    const on = !muted && !localMuted;
    master.gain.setTargetAtTime(on ? cfg.volume : 0, ctx.currentTime, 0.05);
    bgmBus.gain.value = cfg.bgmVolume;
    if (bgmEl) bgmEl.volume = on ? Math.min(1, cfg.volume * cfg.bgmVolume) : 0;
  }

  function unlock() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (cfg.bgm && !bgmStarted) startBgm();
    if (bgmEl && bgmEl.paused) bgmEl.play().catch(() => {});
  }

  function throttle(name, ms) {
    const now = performance.now();
    if (now - (lastPlay[name] || 0) < ms) return true;
    lastPlay[name] = now;
    return false;
  }

  function canPlay() {
    return ensure() && ctx.state === 'running' && !muted && !localMuted;
  }

  // ---------- Mõ gỗ: tiếng "cốc" ngắn, cao, khô ----------
  function knock(t, pitch = 1) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(820 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(520 * pitch, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(sfxBus);
    o.start(t);
    o.stop(t + 0.2);
    // Tiếng gõ (noise lọc dải)
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = ctx.createBufferSource();
    n.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 * pitch;
    bp.Q.value = 3;
    const ng = ctx.createGain();
    ng.gain.value = 0.5;
    n.connect(bp).connect(ng).connect(sfxBus);
    n.start(t);
  }
  function mo() {
    if (!canPlay() || throttle('mo', 120)) return;
    const t = ctx.currentTime + 0.01;
    knock(t, 1);
    knock(t + 0.2, 0.97);
  }

  // ---------- Chuông chùa: các bội âm không hài hoà, ngân dài ----------
  function bell(big = false) {
    if (!canPlay() || throttle('bell' + big, big ? 400 : 250)) return;
    const t = ctx.currentTime + 0.01;
    const f0 = big ? 130 : 220;
    const partials = [
      [1, 0.5, 1], [2.0, 0.28, 0.8], [2.76, 0.22, 0.6], [4.07, 0.12, 0.45], [5.4, 0.08, 0.3], [0.5, 0.25, 1.2],
    ];
    const dur = big ? 9 : 5;
    for (const [mul, amp, dk] of partials) {
      for (const det of [0, 0.8]) { // 2 dao động lệch nhau tạo tiếng "ngân" rung
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f0 * mul + det;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(amp * 0.5, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur * dk);
        o.connect(g).connect(sfxBus);
        o.start(t);
        o.stop(t + dur * dk + 0.1);
      }
    }
  }

  // ---------- Chuông nhỏ (vào thiền, quà nhỏ) ----------
  function chime(note = 0, vol = 0.18) {
    if (!canPlay() || throttle('chime', 90)) return;
    const scale = [880, 987.8, 1174.7, 1318.5, 1568, 1760];
    const f = scale[((note % scale.length) + scale.length) % scale.length];
    const t = ctx.currentTime + 0.01;
    [[1, vol], [2.4, vol * 0.3], [3.9, vol * 0.12]].forEach(([m, a]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * m;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(a, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 / m);
      o.connect(g).connect(sfxBus);
      o.start(t);
      o.stop(t + 2);
    });
  }
  function sparkle() {
    if (!canPlay()) return;
    [0, 2, 4, 5].forEach((n, i) => setTimeout(() => { lastPlay.chime = 0; chime(n, 0.14); }, i * 110));
  }
  /** Tiếng lắc ống xăm */
  function shake() {
    if (!canPlay() || throttle('shake', 500)) return;
    const t0 = ctx.currentTime;
    for (let i = 0; i < 8; i++) knock(t0 + i * 0.07 + Math.random() * 0.02, 1.6 + Math.random() * 0.3);
  }

  // ---------- Nhạc nền ----------
  function startBgm() {
    if (bgmStarted || !ensure()) return;
    bgmStarted = true;
    if (cfg.bgmFile) {
      // Thử file nhạc người dùng, nếu lỗi quay về nhạc tổng hợp
      const el = new Audio(cfg.bgmFile);
      el.loop = true;
      el.addEventListener('canplay', () => {
        if (bgmEl) return;
        bgmEl = el;
        applyVolume();
        el.play().catch(() => {});
      }, { once: true });
      el.addEventListener('error', synthBgm, { once: true });
      el.load();
    } else synthBgm();
  }

  function synthBgm() {
    if (!ctx || bgmEl) return;
    // Drone ấm: La - Mi - La (quãng 5) qua lọc thấp
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const pad = ctx.createGain();
    pad.gain.value = 0.07;
    lp.connect(pad).connect(bgmBus);
    [110, 164.81, 220, 277.18].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8;
      const g = ctx.createGain();
      g.gain.value = i === 3 ? 0.15 : 0.35;
      // LFO chậm làm âm "thở"
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.07;
      const lg = ctx.createGain();
      lg.gain.value = 0.15;
      lfo.connect(lg).connect(g.gain);
      o.connect(g).connect(lp);
      o.start();
      lfo.start();
    });
    // Chuông gió ngũ cung ngẫu nhiên
    const penta = [440, 493.9, 554.4, 659.3, 740, 880];
    const ring = () => {
      if (ctx && ctx.state === 'running') {
        const f = penta[Math.floor(Math.random() * penta.length)];
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
        o.connect(g).connect(bgmBus);
        o.start(t);
        o.stop(t + 3.2);
      }
      chimeTimer = setTimeout(ring, 2500 + Math.random() * 5000);
    };
    ring();
  }

  return {
    configure(c) {
      cfg = Object.assign(cfg, c || {});
      applyVolume();
    },
    setMuted(m) { muted = !!m; ensure(); applyVolume(); },
    setLocalMuted(m) { localMuted = !!m; ensure(); applyVolume(); if (!m) unlock(); },
    isMuted: () => muted || localMuted,
    unlock,
    mo, bell, chime, sparkle, shake,
  };
})();
