import { VoiceNoise } from './voice-noise';
import { VoiceEffects, type VoiceEffect } from './voice-effects';
import type { Session } from './room';
import type { VoiceMember, VoiceSignal, VoiceView } from './voice-types';

type Peer = { pc: RTCPeerConnection; instance: string; call: string; audio: HTMLAudioElement; started: number; attempts: number };
export type VoiceSnapshot = {
  status: 'off' | 'joining' | 'joined'; error: string; muted: boolean; speakers: boolean;
  members: Record<string, VoiceMember>; connections: Record<string, RTCPeerConnectionState>;
  speaking: Record<string, boolean>; devices: { id: string; label: string }[]; device: string; blocked: boolean; effect: VoiceEffect; effectsAvailable: boolean; effectBusy: boolean; effectError: boolean; noiseActive: boolean; noiseBusy: boolean; noiseError: boolean;
};
export const emptyVoice = (): VoiceSnapshot => ({ status: 'off', error: '', muted: false, speakers: true, members: {}, connections: {}, speaking: {}, devices: [], device: 'default', blocked: false, effect: 'natural', effectsAvailable: false, effectBusy: false, effectError: false, noiseActive: false, noiseBusy: false, noiseError: false });

/** Audio stays on WebRTC. The HTTP endpoint carries room presence and SDP only. */
export class VoiceClient {
  private instance = crypto.randomUUID();
  private stream?: MediaStream;
  private context?: AudioContext;
  private effects?: VoiceEffects;
  private noise?: VoiceNoise;
  private get cleanStream() { return this.noise?.stream || this.stream!; }
  private outgoing?: MediaStream;
  private mediaChanges: Promise<void> = Promise.resolve();
  private meters = new Map<string, { source: MediaStreamAudioSourceNode; analyser: AnalyserNode }>();
  private peers = new Map<string, Peer>();
  private timer?: ReturnType<typeof setTimeout>;
  private meterTimer?: ReturnType<typeof setInterval>;
  private closed = false;
  private registration?: Promise<VoiceView>;
  private leaving?: Promise<void>;
  private cursor = 0;
  private iceServers: RTCIceServer[] = [];
  private lastSync = Date.now();
  private snapshot = emptyVoice();
  private pageHide = () => { this.emit({ ...emptyVoice() }); this.close(); };
  private platformPaused = false;
  private pauseAudio = (event?: Event) => {
    if (event?.type === 'yandex-platform-pause') this.platformPaused = !!(event as CustomEvent<boolean>).detail;
    this.applyMute();
    this.peers.forEach(peer => { void this.playRemote(peer.audio); });
  };
  private deviceChange = () => void this.listDevices();
  constructor(private session: Session, private update: (state: VoiceSnapshot) => void) {}
  private emit(patch: Partial<VoiceSnapshot> = {}) {
    if (this.closed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.update(this.snapshot);
  }
  private async api(op: string, extra: Record<string, unknown> = {}, keepalive = false): Promise<VoiceView> {
    const response = await fetch((window.__gameApiBase||'')+'/api/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.session, instance: this.instance, op, muted: this.snapshot.muted, ...extra }),
      keepalive, signal: AbortSignal.timeout(10000) });
    const data = await response.json() as VoiceView & { error?: string };
    if (!response.ok) throw Error(data.error || 'unavailable');
    return data;
  }
  async join(previousLeave: Promise<void> = Promise.resolve()) {
    this.emit({ status: 'joining', error: '' });
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw Error('unsupported');
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) { try { this.context = new AudioCtx({sampleRate:48000}); } catch { try { this.context = new AudioCtx(); } catch {} } void this.context?.resume().catch(() => {}); }
      // Automatic gain can amplify a room's noise during pauses. Keep echo
      // cancellation and browser suppression, but never boost a quiet input.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: {ideal:1}, echoCancellation: true, noiseSuppression: true, autoGainControl: false }, video: false });
      if (this.closed) { stream.getTracks().forEach(t => t.stop()); return; }
      this.stream = stream;
      this.watchMicrophone(stream);
      // Natural voice must never depend on an AudioContext or a DSP module.
      this.outgoing = stream;
      this.emit({ effectsAvailable: !!this.context?.audioWorklet && typeof AudioWorkletNode !== 'undefined' });
      if (this.context) this.context.onstatechange = () => {
        if (!this.closed && this.context?.state !== 'running' && this.outgoing !== this.stream) { void this.setNoise(false); this.recoverNatural(); }
      };
      if (this.closed) return;
      await previousLeave;
      if (this.closed) return;
      this.registration = this.api('join');
      const view = await this.registration;
      if (this.closed) return;
      this.iceServers = view.iceServers || [];
      this.lastSync = Date.now();
      this.emit({ status: 'joined' });
      this.addMeter(this.session.playerId, stream);
      this.meterTimer = setInterval(() => this.measure(), 180);
      window.addEventListener('pagehide', this.pageHide);
      window.addEventListener('yandex-platform-pause', this.pauseAudio);
      document.addEventListener('visibilitychange', this.pauseAudio);
      navigator.mediaDevices.addEventListener('devicechange', this.deviceChange);
      void this.listDevices();
      this.receive(view);
      this.schedule();
      if (this.snapshot.effectsAvailable) void this.setNoise(true);
      else this.emit({noiseError:true});
    } catch (e) { if (!this.closed) this.fail(e instanceof Error ? e.name === 'Error' ? e.message : e.name : 'unavailable'); }
  }
  private schedule() { if (!this.closed) this.timer = setTimeout(() => void this.poll(), 1000); }
  private async poll() {
    try {
      let view: VoiceView;
      try { view = await this.api('sync', { after: this.cursor }); }
      catch (e) { if (e instanceof Error && e.message === 'rejoin') view = await this.api('join', { after: this.cursor }); else throw e; }
      if (this.closed) return;
      this.lastSync = Date.now();
      this.emit({ error: '' });
      this.receive(view);
    } catch (e) {
      if (this.closed) return;
      const error = e instanceof Error ? e.message : 'unavailable';
      if (error === 'forbidden' || error === 'already-connected' || Date.now() - this.lastSync > 20000) { this.fail(error); return; }
      this.emit({ error: 'reconnecting' });
    }
    this.schedule();
  }
  private receive(view: VoiceView) {
    this.emit({ members: view.members });
    for (const [id, peer] of this.peers) if (view.members[id]?.instance !== peer.instance) this.dropPeer(id);
    for (const [id, member] of Object.entries(view.members)) {
      if (id === this.session.playerId || this.session.playerId > id) continue;
      const old = this.peers.get(id);
      if (!old) void this.offer(id, member.instance, 1);
      else if (old.pc.connectionState !== 'connected' && Date.now() - old.started > 18000 && old.attempts < 3) {
        const attempt = old.attempts + 1; this.dropPeer(id); void this.offer(id, member.instance, attempt);
      } else if (Date.now() - old.started > 20000 && old.pc.connectionState !== 'connected') {
        this.emit({ connections: { ...this.snapshot.connections, [id]: 'failed' } });
      }
    }
    // Polls are sequential; each signal is consumed once, including across rejoin.
    for (const signal of view.signals) if (view.members[signal.from]?.instance === signal.fromInstance) void this.signal(signal);
    this.cursor = Math.max(this.cursor, view.cursor);
  }
  private createPeer(id: string, instance: string, call: string, attempts: number) {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const audio = new Audio(); audio.autoplay = true; audio.hidden = true; audio.setAttribute('playsinline', ''); audio.muted = !this.snapshot.speakers; document.body.appendChild(audio);
    const peer: Peer = { pc, instance, call, audio, started: Date.now(), attempts };
    this.peers.set(id, peer);
    const outgoing = this.outgoing || this.stream;
    outgoing?.getAudioTracks().forEach(track => { track.enabled = !this.snapshot.muted; pc.addTrack(track, outgoing); });
    this.emit({ connections: { ...this.snapshot.connections, [id]: 'connecting' } });
    pc.onconnectionstatechange = () => { if (this.peers.get(id) === peer) this.emit({ connections: { ...this.snapshot.connections, [id]: pc.connectionState } }); };
    pc.ontrack = event => {
      if (this.closed || this.peers.get(id) !== peer) return;
      const remote = event.streams[0] || new MediaStream([event.track]); audio.srcObject = remote;
      this.addMeter(id, remote);
      void this.playRemote(audio);
    };
    return peer;
  }
  private async gather(pc: RTCPeerConnection) {
    if (pc.iceGatheringState === 'complete') return;
    await new Promise<void>(resolve => {
      const done = () => { clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', check); pc.removeEventListener('connectionstatechange', check); resolve(); };
      const check = () => { if (pc.iceGatheringState === 'complete' || pc.connectionState === 'closed') done(); };
      const timer = setTimeout(done, 6000);
      pc.addEventListener('icegatheringstatechange', check); pc.addEventListener('connectionstatechange', check); check();
    });
  }
  private async sendDescription(id: string, peer: Peer, type: 'offer' | 'answer') {
    await this.gather(peer.pc);
    if (this.closed || this.peers.get(id) !== peer) return;
    const payload = { to: id, toInstance: peer.instance, call: peer.call, type, sdp: peer.pc.localDescription?.sdp };
    try { await this.api('signal', payload); }
    catch (e) { if (e instanceof Error && e.message === 'forbidden') throw e; if (!this.closed && this.peers.get(id) === peer) await this.api('signal', payload); }
  }
  private async offer(id: string, instance: string, attempts: number) {
    if (this.closed) return;
    const peer = this.createPeer(id, instance, crypto.randomUUID(), attempts);
    try { await peer.pc.setLocalDescription(await peer.pc.createOffer()); await this.sendDescription(id, peer, 'offer'); }
    catch (e) { this.peerError(id, peer, e); }
  }
  private async signal(signal: VoiceSignal) {
    if (this.closed) return;
    let peer = this.peers.get(signal.from);
    try {
      if (signal.type === 'offer') {
        if (peer?.call === signal.call) return;
        this.dropPeer(signal.from);
        peer = this.createPeer(signal.from, signal.fromInstance, signal.call, 1);
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        if (this.closed || this.peers.get(signal.from) !== peer) return;
        await peer.pc.setLocalDescription(await peer.pc.createAnswer());
        await this.sendDescription(signal.from, peer, 'answer');
      } else if (peer?.call === signal.call && peer.instance === signal.fromInstance && peer.pc.signalingState === 'have-local-offer') {
        await peer.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
      }
    } catch (e) { if (peer) this.peerError(signal.from, peer, e); }
  }
  private peerError(id: string, peer: Peer, error: unknown) {
    if (this.closed) return;
    if (error instanceof Error && error.message === 'forbidden') { this.fail('forbidden'); return; }
    if (this.peers.get(id) === peer) this.emit({ connections: { ...this.snapshot.connections, [id]: 'failed' } });
  }
  private applyMute() {
    const muted = this.snapshot.muted || this.platformPaused || document.hidden;
    this.stream?.getAudioTracks().forEach(track => { track.enabled = !muted; });
    this.outgoing?.getAudioTracks().forEach(track => { track.enabled = !muted; });
    this.noise?.setMuted(muted);
    this.effects?.setMuted(muted || this.outgoing !== this.effects.stream);
    for (const peer of this.peers.values()) peer.pc.getSenders().forEach(sender => { if (sender.track) sender.track.enabled = !muted; });
  }
  toggleMute() {
    this.emit({ muted: !this.snapshot.muted, speaking: { ...this.snapshot.speaking, [this.session.playerId]: false } });
    this.applyMute();
    if (!this.snapshot.muted) void this.context?.resume().catch(() => {});
  }
  toggleSpeakers() {
    this.emit({ speakers: !this.snapshot.speakers, blocked: false });
    this.peers.forEach(peer => { void this.playRemote(peer.audio); });
  }
  private async playRemote(audio: HTMLAudioElement) {
    audio.muted = this.closed || !this.snapshot.speakers || this.platformPaused || document.hidden;
    if (audio.muted) { audio.pause(); return; }
    try {
      await audio.play();
      // A play promise may finish after the user has pressed mute or left.
      if (this.closed || !this.snapshot.speakers || this.platformPaused || document.hidden) { audio.muted = true; audio.pause(); }
    } catch { if (!this.closed && this.snapshot.speakers) this.emit({ blocked: true }); }
  }
  async unlock() {
    void this.context?.resume().catch(() => {});
    this.emit({ blocked: false });
    await Promise.all([...this.peers.values()].map(peer => this.playRemote(peer.audio)));
  }
  private async switchOutgoing(stream: MediaStream) {
    if (this.closed) return;
    const previous = this.outgoing || this.stream!;
    this.outgoing = stream; this.applyMute();
    const track = stream.getAudioTracks()[0];
    const senders = [...this.peers.values()].flatMap(peer => peer.pc.getSenders()).filter(sender => sender.track?.kind === 'audio');
    const results = await Promise.allSettled(senders.map(sender => sender.replaceTrack(track)));
    if (this.closed) return;
    if (results.some(result => result.status === 'rejected')) {
      this.outgoing = previous;
      // Include peers added during the replacement so all participants hear the same source.
      const rollback = await Promise.allSettled([...this.peers.values()].flatMap(peer => peer.pc.getSenders()).filter(sender => sender.track?.kind === 'audio').map(sender => sender.replaceTrack(previous.getAudioTracks()[0])));
      this.applyMute();
      if (rollback.some(result => result.status === 'rejected')) this.fail('unavailable');
      throw Error('replace-track');
    }
    this.applyMute();
    this.addMeter(this.session.playerId,stream);
  }
  private recoverNatural() {
    if (this.closed) return;
    const failed = this.effects;
    void this.selectEffect('natural').then(() => {
      if (failed && this.effects === failed) { failed.close(); this.effects = undefined; }
      this.emit({ effectError: true });
    });
  }
  selectEffect(effect: VoiceEffect): Promise<void> {
    if (this.closed) return Promise.resolve();
    // Resume during the user gesture, before the queued asynchronous replacement.
    const resume = effect === 'natural' ? Promise.resolve() : this.context?.resume();
    void resume?.catch(() => {});
    // Changing a voice must not reset the independent noise-filter state.
    this.emit({ effectBusy: true, effectError: false });
    const change = async () => {
      if (this.closed || !this.stream) return;
      try {
        if (effect === 'natural') await this.switchOutgoing(this.cleanStream);
        else {
          if (!this.context || !this.snapshot.effectsAvailable) throw Error('effects-unavailable');
          await Promise.race([resume, new Promise<never>((_, reject) => { const id = setTimeout(() => reject(Error('audio-paused')), 3000); resume?.finally(() => clearTimeout(id)).catch(() => {}); })]);
          if (this.closed) return;
          if (this.context.state !== 'running') throw Error('audio-paused');
          if (!this.effects) {
            const effects = await VoiceEffects.create(this.context, this.cleanStream);
            if (this.closed) { effects.close(); return; }
            this.effects = effects; effects.onFailure = () => this.recoverNatural();
          }
          // Only report the selected voice after the audio thread accepts it.
          await this.effects.setEffect(effect);
          if (this.closed) return;
          await this.switchOutgoing(this.effects.stream);
        }
        this.emit({ effect });
      } catch {
        if (!this.closed && this.stream) {
          try { await this.switchOutgoing(this.cleanStream); } catch { this.fail('unavailable'); }
          // Retry with a fresh processor after a failed acknowledgement instead
          // of keeping a dead effect node for the rest of the conversation.
          this.effects?.close(); this.effects = undefined;
          this.emit({ effect: 'natural', effectError: true });
        }
      } finally { this.emit({ effectBusy: false }); }
    };
    this.mediaChanges = this.mediaChanges.then(change, change);
    return this.mediaChanges;
  }
  setNoise(enabled: boolean): Promise<void> {
    if (this.closed) return Promise.resolve();
    const resume = enabled ? this.context?.resume() : Promise.resolve(); void resume?.catch(() => {});
    this.emit({noiseBusy:true,noiseError:false});
    const change = async () => {
      if (this.closed || !this.stream) return;
      const old = this.noise, oldBase = this.cleanStream;
      try {
        if (enabled && !old) {
          if (!this.context) throw Error('noise-unsupported');
          let timer:ReturnType<typeof setTimeout>|undefined;
          try { await Promise.race([resume,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('noise-paused')),3000)})]); } finally { clearTimeout(timer); }
          const noise = await VoiceNoise.create(this.context,this.stream);
          if (this.closed) { noise.close(); return; }
          this.noise = noise; noise.onFailure = () => { void this.setNoise(false).then(()=>this.emit({noiseError:true})); };
        } else if (!enabled) this.noise = undefined;
        this.effects?.replaceInput(this.cleanStream);
        if (this.outgoing === oldBase) await this.switchOutgoing(this.cleanStream);
        this.applyMute(); if (!enabled) old?.close();
        this.emit({noiseActive:!!this.noise});
      } catch {
        const failed = this.noise; this.noise = old;
        this.effects?.replaceInput(oldBase);
        if (!this.closed && this.outgoing === failed?.stream) { try { await this.switchOutgoing(oldBase); } catch { this.fail('unavailable'); } }
        if (failed !== old) failed?.close();
        this.emit({noiseActive:!!old,noiseError:true});
      } finally { this.emit({noiseBusy:false}); }
    };
    this.mediaChanges = this.mediaChanges.then(change,change); return this.mediaChanges;
  }
  private async listDevices() {
    try { const all = await navigator.mediaDevices.enumerateDevices(); this.emit({ devices: all.filter(d => d.kind === 'audioinput').map(d => ({ id: d.deviceId, label: d.label })) }); } catch { /* Device selection is optional. */ }
  }
  private watchMicrophone(stream: MediaStream) {
    stream.getAudioTracks().forEach(track => { track.onended = () => { if (this.stream === stream && !this.closed) this.fail('microphone-ended'); }; });
  }
  selectDevice(device: string): Promise<void> {
    const change = async () => {
      if (this.closed) return;
      let replacement: MediaStream | undefined;
      try {
        replacement = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: device === 'default' ? undefined : { exact: device }, channelCount: {ideal:1}, echoCancellation: true, noiseSuppression: true, autoGainControl: false }, video: false });
        if (this.closed) { replacement.getTracks().forEach(track => track.stop()); return; }
        replacement.getAudioTracks().forEach(track => { track.enabled = !this.snapshot.muted; });
        const old = this.stream!;
        this.noise?.replaceInput(replacement);
        this.effects?.replaceInput(this.noise?.stream || replacement);
        try { if (this.outgoing === old) await this.switchOutgoing(replacement); }
        catch (error) { this.noise?.replaceInput(old); this.effects?.replaceInput(this.noise?.stream || old); throw error; }
        if (this.closed) { replacement.getTracks().forEach(track => track.stop()); return; }
        this.stream = replacement; this.applyMute(); old.getTracks().forEach(track => track.stop());
        this.watchMicrophone(replacement); this.addMeter(this.session.playerId, this.outgoing || replacement); this.emit({ device, error: '' });
      } catch { replacement?.getTracks().forEach(track => track.stop()); this.emit({ error: 'device' }); }
    };
    this.mediaChanges = this.mediaChanges.then(change, change);
    return this.mediaChanges;
  }
  private addMeter(id: string, stream: MediaStream) {
    this.removeMeter(id);
    try { if (this.context) { const source = this.context.createMediaStreamSource(stream), analyser = this.context.createAnalyser(); analyser.fftSize = 512; source.connect(analyser); this.meters.set(id, { source, analyser }); } } catch { /* Speech indicators do not affect the call. */ }
  }
  private removeMeter(id: string) { const meter = this.meters.get(id); meter?.source.disconnect(); meter?.analyser.disconnect(); this.meters.delete(id); }
  private measure() {
    const speaking: Record<string, boolean> = {};
    for (const [id, { analyser }] of this.meters) {
      const data = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(data);
      const rms = Math.sqrt(data.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / data.length);
      speaking[id] = rms > .025 && (id === this.session.playerId ? !this.snapshot.muted : !this.snapshot.members[id]?.muted);
    }
    if (JSON.stringify(speaking) !== JSON.stringify(this.snapshot.speaking)) this.emit({ speaking });
  }
  private dropPeer(id: string) {
    const peer = this.peers.get(id); if (!peer) return;
    this.peers.delete(id); peer.pc.ontrack = null; peer.pc.onconnectionstatechange = null; peer.pc.close();
    peer.audio.pause(); peer.audio.srcObject = null; peer.audio.remove(); this.removeMeter(id);
    const connections = { ...this.snapshot.connections }; delete connections[id]; this.emit({ connections });
  }
  private fail(error: string) { this.emit({ status: 'off', error, members: {}, connections: {}, speaking: {} }); this.close(); }
  close() {
    if (this.closed) return this.leaving || Promise.resolve();
    this.closed = true; clearTimeout(this.timer); clearInterval(this.meterTimer);
    window.removeEventListener('pagehide', this.pageHide); window.removeEventListener('yandex-platform-pause', this.pauseAudio); document.removeEventListener('visibilitychange', this.pauseAudio); navigator.mediaDevices?.removeEventListener('devicechange', this.deviceChange);
    this.stream?.getTracks().forEach(t => t.stop());
    for (const id of this.peers.keys()) this.dropPeer(id);
    for (const id of this.meters.keys()) this.removeMeter(id);
    if (this.context) this.context.onstatechange = null;
    this.effects?.close(); this.noise?.close();
    void this.context?.close().catch(() => {});
    // Finish any pending registration before leaving, so an immediate reconnect
    // cannot collide with the previous generation or leave its microphone seat behind.
    this.leaving = Promise.resolve(this.registration).catch(() => {}).then(() => this.api('leave', {}, true)).then(() => {}, () => {});
    return this.leaving;
  }
}
