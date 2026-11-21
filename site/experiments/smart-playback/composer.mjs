export function makePlan(duration, cuts = [], fade = .2) {
  const segments = []; let from = 0, start = 0;
  for (const c of cuts) {
    if (!Number.isFinite(c.from) || !Number.isFinite(c.to) || c.from <= from || c.to <= c.from || c.to >= duration) throw Error('Invalid cut');
    segments.push({start, end: start + c.from - from, from});
    start += c.from - from - fade; from = c.to;
  }
  segments.push({start, end: start + duration - from, from});
  return {segments, duration: segments.at(-1).end, saved: duration - segments.at(-1).end, fade};
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const DURATION = 1387.357641723356;
// Web Audio exposes cancelScheduledValues on older mobile engines but not
// cancelAndHoldAtTime. Keep the small envelope in audio-clock time on that path.
export class GainEnvelope {
  constructor(param) {
    this.param = param;
    this.native = typeof param.cancelAndHoldAtTime === 'function';
    this.points = [[0, 0]];
    param.value = 0;
  }
  valueAt(time) {
    for (let i = 1; i < this.points.length; i++) {
      const [t, v] = this.points[i], [prev, start] = this.points[i - 1];
      if (time < t) return start + (v - start) * Math.max(0, (time - prev) / (t - prev));
    }
    return this.points.at(-1)[1];
  }
  hold(time) {
    if (this.native) { this.param.cancelAndHoldAtTime(time); return; }
    // Compatibility schedules only endpoints, never setValueCurveAtTime:
    // cancelling during a native value curve can leave it active and make a
    // replacement event inside that interval invalid.
    const value = this.valueAt(time);
    this.param.cancelScheduledValues(time);
    this.set(value, time);
  }
  mute(time) {
    this.param.cancelScheduledValues(time);
    this.set(0, time);
  }
  set(value, time) {
    this.param.setValueAtTime(value, time);
    if (!this.native) this.points = [[time, value]];
  }
  ramp(value, time) {
    this.param.linearRampToValueAtTime(value, time);
    if (!this.native) this.points.push([time, value]);
  }
  curve(values, start, duration) {
    if (this.native) { this.param.setValueCurveAtTime(values, start, duration); return; }
    this.param.setValueAtTime(values[0], start);
    // Keep the lead-in ramp: the user can pause before this fade begins.
    this.points = this.points.filter(([t]) => t < start);
    this.points.push([start, values[0]]);
    for (let i = 1; i < values.length; i++) this.ramp(values[i], start + duration * i / (values.length - 1));
  }
}
export class Composer {
  constructor(elements, notify = () => {}) {
    this.media = elements; this.notify = notify; this.generation = 0;
    this.running = false; this.t = 0; this.assign = new Map();
    this.stats = {transitions: [], fallbacks: 0}; this.stopBarrier = Promise.resolve();
    this.timer = setInterval(() => this.tick(), 15);
    this.visibility = () => { if (document.hidden) this.pause(); };
    document.addEventListener('visibilitychange', this.visibility);
  }
  active(t) { return this.plan.segments.map((s, n) => ({...s, n})).filter(s => s.start <= t && t < s.end); }
  current() {
    if (!this.running) return this.t;
    // The outgoing media clock remains authoritative. A network stall must not
    // advance the virtual session clock independently of actual media output.
    const s = this.plan.segments[this.leader];
    return Math.min(this.plan.duration, Math.max(this.t, s.start + this.media[this.leader % 2].currentTime - s.from + (this.clockOffset || 0)));
  }
  async load(source, cuts = []) {
    await this.pause(); if (this.url) URL.revokeObjectURL(this.url);
    this.url = typeof source === 'string' ? null : URL.createObjectURL(source);
    this.cuts = cuts; this.plan = makePlan(DURATION, cuts); this.t = 0;
    for (const m of this.media) { m.src = this.url || source; m.preload = 'none'; m.load(); }
    this.assign.clear();
  }
  async graph() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    try {
      const nodes = this.media.map(el => {
        const gain = ctx.createGain();
        const envelope = new GainEnvelope(gain.gain);
        const node = ctx.createMediaElementSource(el);
        node.connect(gain); gain.connect(ctx.destination);
        return {node, gain, envelope};
      });
      this.ctx = ctx; this.nodes = nodes;
    } catch (error) { await ctx.close(); throw error; }
  }
  async ready(m, token) {
    const begin = performance.now();
    while (m.readyState < 3 || m.seeking) {
      if (token !== this.generation) throw Error('Cancelled');
      if (m.error || performance.now() - begin > 30000) throw Error('Buffer timeout');
      await wait(10);
    }
    if (token !== this.generation) throw Error('Cancelled');
  }
  async prepare(s, token, position = s.from) {
    const i = s.n % 2, m = this.media[i];
    if (this.assign.get(i) !== s.n) {
      if (this.running && !m.paused) throw Error('Refusing to seek an active stream');
      if (this.ctx) this.nodes[i].envelope.mute(this.ctx.currentTime);
      m.pause(); m.preload = 'auto'; if (m.readyState === 0) m.load();
      this.assign.set(i, s.n); m.currentTime = position;
    }
    await this.ready(m, token); return m;
  }
  weights(t) {
    const a = this.active(t), values = [0, 0];
    if (a.length === 1) values[a[0].n % 2] = 1;
    if (a.length === 2) { const x = (t - a[1].start) / (a[0].end - a[1].start); values[a[0].n % 2] = Math.cos(x * Math.PI / 2); values[a[1].n % 2] = Math.sin(x * Math.PI / 2); }
    return values;
  }
  silence(ramp = .012) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const node of this.nodes) {
      // Hold the instantaneous value during an overlap on both gain paths.
      node.envelope.hold(now); node.envelope.ramp(0, now + ramp);
    }
  }
  pause() {
    if (this.running) this.t = this.current();
    this.running = false; const token = ++this.generation;
    this.silence();
    this.stopBarrier = wait(this.ctx?.state === 'running' ? 20 : 0).then(() => {
      if (token === this.generation) for (const m of this.media) m.pause();
    });
    return this.stopBarrier;
  }
  async seek(t) {
    await this.pause(); this.t = Math.max(0, Math.min(t, this.plan.duration - .01));
    this.assign.clear();
    // A paused position change does not download or wait for audio. Play owns
    // buffering, cancellation and the eventual explicit start.
  }
  async play() {
    if (this.running) return;
    await this.stopBarrier; const token = ++this.generation;
    await this.graph(); await this.ctx.resume();
    if (token !== this.generation) return;
    const active = this.active(this.t);
    // Resume from the saved virtual position, with both channels muted before
    // any element is started. Never reuse a previous transition's gain.
    this.assign.clear();
    for (const s of active) await this.prepare(s, token, s.from + this.t - s.start);
    await Promise.all(active.map(s => this.media[s.n % 2].play()));
    if (token !== this.generation) return;
    this.leader = active[0].n; this.clockOffset = 0; this.running = true;
    this.key = active.map(s => s.n).join(',');
    const now = this.ctx.currentTime, fadePosition = this.current() + .012;
    const values = this.weights(Math.min(fadePosition, active[0].end - .0001));
    for (let i = 0; i < 2; i++) { const g = this.nodes[i].envelope; g.mute(now); g.ramp(values[i], now + .012); }
    if (active.length === 2) this.fade(active, fadePosition, now + .012, true);
  }
  fade(active, t, start = this.ctx.currentTime, resumed = false) {
    const length = active[0].end - t;
    if (length < .025) throw Error('Insufficient buffered overlap');
    const phase = resumed ? (t - active[1].start) / this.plan.fade : 0;
    for (const s of active) {
      const g = this.nodes[s.n % 2].envelope, curve = new Float32Array(128);
      for (let j = 0; j < curve.length; j++) { const x = phase + (1 - phase) * j / (curve.length - 1); curve[j] = s.n === active[0].n ? Math.cos(x * Math.PI / 2) : Math.sin(x * Math.PI / 2); }
      g.curve(curve, start, length);
    }
  }
  async tick() {
    if (!this.running || this.busy) return;
    const t = this.current();
    if (t >= this.plan.duration - .01) {
      // Small HTML-media clock offsets must never truncate the original ending.
      const last = this.media[this.leader % 2];
      if (last.ended) this.pause();
      return;
    }
    if (this.media[this.leader % 2].readyState < 3 || this.ctx.state !== 'running') { this.fallback('Playback interrupted or buffering'); return; }
    const active = this.active(t), key = active.map(s => s.n).join(',');
    if (key !== this.key) {
      this.busy = true; const token = this.generation, stamp = performance.now();
      try {
        if (active.length === 2) {
          const s = active[1], m = await this.prepare(s, token);
          await m.play(); if (token !== this.generation || !this.running) return;
          this.fade(active, this.current());
        } else {
          this.leader = active[0].n;
          this.t = t;
          this.clockOffset = t - (active[0].start + this.media[this.leader % 2].currentTime - active[0].from);
          for (let i = 0; i < 2; i++) if (i !== this.leader % 2) {
            // Wait for the scheduled fade to finish before recycling this slot.
            const g = this.nodes[i].envelope; const now = this.ctx.currentTime;
            g.hold(now); g.set(0, now); this.media[i].pause();
          }
        }
        this.key = key; this.stats.transitions.push({at: t, latency: performance.now() - stamp});
      } catch (error) { if (token === this.generation) this.fallback(error.message); }
      finally { this.busy = false; }
    }
    const next = this.plan.segments.map((s, n) => ({...s, n})).find(s => s.start > t && s.start - t < 8);
    if (next && !active.some(s => s.n % 2 === next.n % 2) && !this.preloading) {
      this.preloading = true; const token = this.generation;
      this.prepare(next, token).catch(e => { if (token === this.generation) this.fallback(e.message); }).finally(() => { this.preloading = false; });
    }
  }
  fallback(reason) {
    const t = this.current(), s = this.active(t).at(-1), source = s ? s.from + t - s.start : 0;
    this.pause(); this.stats.fallbacks++; this.plan = makePlan(DURATION);
    this.t = Math.max(0, Math.min(source, this.plan.duration - .01)); this.assign.clear();
    this.notify('Full fallback, paused: ' + reason + '. Press Play to continue the original.');
  }
  destroy() {
    this.pause(); clearInterval(this.timer); this.ctx?.close();
    for (const m of this.media) { m.pause(); m.removeAttribute('src'); m.load(); }
    if (this.url) URL.revokeObjectURL(this.url);
    document.removeEventListener('visibilitychange', this.visibility);
  }
}
