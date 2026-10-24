// Generated sound effects (WebAudio), so there are no sound files to license.
// The context is created on the first tap, since browsers block audio until then.

let ctx = null;
let master = null;
let noise = null;
let muted = false;

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}

function env(node, t0, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  node.connect(g);
  g.connect(master);
  return g;
}

function noiseBurst(t0, dur, type, f0, f1, q, peak) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  src.connect(f);
  env(f, t0, peak, 0.01, dur);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.05);
}

function tone(t0, dur, type, f0, f1, peak) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  env(o, t0, peak, 0.005, dur);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export function sfx(name) {
  if (!ctx || muted) return;
  try {
    const t = ctx.currentTime;
    switch (name) {
      case 'splash':
        noiseBurst(t, 0.16, 'bandpass', 2200, 900, 0.8, 0.5);
        break;
      case 'slurp':
        noiseBurst(t + 0.09, 0.26, 'bandpass', 380, 2400, 4, 0.35);
        break;
      case 'plop':
        tone(t, 0.12, 'sine', 620, 180, 0.35);
        break;
      case 'drop':
        tone(t, 0.06, 'sine', 900, 500, 0.12);
        break;
      case 'chime':
        tone(t, 0.25, 'triangle', 880, 880, 0.2);
        tone(t + 0.07, 0.3, 'triangle', 1320, 1320, 0.16);
        break;
      case 'fanfare':
        [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.09, 0.22, 'triangle', f, f, 0.18));
        break;
      case 'tick':
        tone(t, 0.04, 'square', 1200, 1000, 0.06);
        break;
      case 'locked':
        tone(t, 0.12, 'square', 220, 160, 0.08);
        break;
    }
  } catch {
    // Never let audio break the game.
  }
}
