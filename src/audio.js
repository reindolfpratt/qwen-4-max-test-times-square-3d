// Procedural city ambience via Web Audio. No samples, no network. Gesture-gated.
export function createAudio() {
  let ctx = null, master = null, started = false, muted = true;
  let honkTimer = 3, sirenTimer = 14;

  function noiseBuffer(type) {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'brown') { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; }
      else d[i] = white;
    }
    return buf;
  }

  function start() {
    if (started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // silent fallback
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);

    // Low rumble (brown noise -> lowpass)
    const rumble = ctx.createBufferSource(); rumble.buffer = noiseBuffer('brown'); rumble.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
    const rg = ctx.createGain(); rg.gain.value = 0.5;
    rumble.connect(lp).connect(rg).connect(master); rumble.start();

    // Traffic hiss (white -> bandpass)
    const hiss = ctx.createBufferSource(); hiss.buffer = noiseBuffer('white'); hiss.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
    const hg = ctx.createGain(); hg.gain.value = 0.05;
    hiss.connect(bp).connect(hg).connect(master); hiss.start();

    started = true;
    if (!muted) rampMaster(0.5);
  }

  function rampMaster(v) {
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.6);
  }

  function honk() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(rr(0.05, 0.12), t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + rr(0.25, 0.5));
    g.connect(master);
    for (const f of [rr(300, 420), rr(300, 420) * 1.26]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(g); o.start(t); o.stop(t + 0.55);
    }
  }

  function siren() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle';
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(g).connect(master);
    o.frequency.setValueAtTime(600, t);
    for (let i = 0; i < 6; i++) {
      o.frequency.linearRampToValueAtTime(i % 2 ? 600 : 900, t + 0.4 * (i + 1));
    }
    g.gain.linearRampToValueAtTime(0.03, t + 0.3);
    g.gain.linearRampToValueAtTime(0.03, t + 2.2);
    g.gain.linearRampToValueAtTime(0, t + 2.6);
    o.start(t); o.stop(t + 2.7);
  }

  const rr = (a, b) => a + Math.random() * (b - a);

  return {
    get muted() { return muted; },
    get started() { return started; },
    ensureStarted() { start(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggle() {
      muted = !muted;
      if (!muted) { start(); if (ctx && ctx.state === 'suspended') ctx.resume(); rampMaster(0.5); }
      else rampMaster(0);
      return muted;
    },
    update(dt) {
      if (!started || muted) return;
      honkTimer -= dt; sirenTimer -= dt;
      if (honkTimer <= 0) { honk(); honkTimer = rr(2.5, 7); }
      if (sirenTimer <= 0) { siren(); sirenTimer = rr(18, 35); }
    },
  };
}