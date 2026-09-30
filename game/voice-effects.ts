export type VoiceEffect = 'natural' | 'girl' | 'child' | 'man';
export const VOICE_EFFECTS: Record<VoiceEffect, { semitones: number; formants: number; highpass: number; tone: number; gain: number }> = {
  natural: { semitones: 0, formants: 0, highpass: 70, tone: 2200, gain: 0 },
  girl: { semitones: 2.5, formants: .8, highpass: 85, tone: 2200, gain: .5 },
  child: { semitones: 4, formants: 1.2, highpass: 95, tone: 2600, gain: .5 },
  man: { semitones: -2.5, formants: -.8, highpass: 65, tone: 1800, gain: 0 },
};

/** Pitch effects run on the audio thread; the game never handles audio buffers. */
export class VoiceEffects {
  onFailure?: () => void;
  readonly ready: Promise<void>;
  private silentOutput: GainNode;
  private static modules = new WeakMap<AudioContext, Promise<void>>();
  private source: MediaStreamAudioSourceNode;
  private highpass: BiquadFilterNode;
  private tone: BiquadFilterNode;
  private gate: GainNode;
  private destination: MediaStreamAudioDestinationNode;
  private nextRequest = 0;
  private pending = new Map<number,{resolve:()=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  constructor(private context: AudioContext, private processor: AudioWorkletNode, input: MediaStream) {
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('effect-not-rendering')), 6000);
      processor.port.onmessage = event => {
        if (event.data?.ready) { clearTimeout(timer); resolve(); }
        if (event.data?.failed) { clearTimeout(timer); reject(Error('effect-init-error')); this.onFailure?.(); }
        const request = this.pending.get(event.data?.applied);
        if (request) { clearTimeout(request.timer); this.pending.delete(event.data.applied); request.resolve(); }
      };
      processor.onprocessorerror = () => {
        clearTimeout(timer); reject(Error('effect-render-error'));
        for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(Error('effect-render-error')); }
        this.pending.clear(); this.onFailure?.();
      };
    });
    this.source = context.createMediaStreamSource(input);
    this.highpass = context.createBiquadFilter(); this.highpass.type = 'highpass';
    this.tone = context.createBiquadFilter(); this.tone.type = 'peaking'; this.tone.Q.value = .8;
    this.gate = context.createGain(); this.destination = context.createMediaStreamDestination(); this.destination.channelCount = 1;
    // Keep the rendering graph active without ever playing the local microphone.
    this.silentOutput = context.createGain(); this.silentOutput.gain.value = 0;
    this.gate.connect(this.silentOutput); this.silentOutput.connect(context.destination);
    this.source.connect(processor); processor.connect(this.highpass); this.highpass.connect(this.tone); this.tone.connect(this.gate); this.gate.connect(this.destination);
    this.highpass.frequency.value = VOICE_EFFECTS.natural.highpass;
    this.tone.frequency.value = VOICE_EFFECTS.natural.tone;
  }
  static async create(context: AudioContext, stream: MediaStream) {
    if (!context.audioWorklet || typeof AudioWorkletNode === 'undefined') throw Error('effects-unavailable');
    let module = this.modules.get(context);
    if (!module) { module = context.audioWorklet.addModule('/audio/voice-pitch-worklet.js?v=5'); this.modules.set(context, module); void module.catch(() => this.modules.delete(context)); }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([module, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('effect-load-timeout')), 6000); })]); }
    finally { clearTimeout(timer); }
    if (context.state !== 'running') throw Error('audio-paused');
    const effects = new VoiceEffects(context, new AudioWorkletNode(context, 'business-voice-pitch', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' }), stream);
    try { await effects.ready; return effects; } catch (error) { effects.close(); throw error; }
  }
  get stream() { return this.destination.stream; }
  setEffect(effect: VoiceEffect): Promise<void> {
    const preset = VOICE_EFFECTS[effect], time = this.context.currentTime;
    this.highpass.frequency.setTargetAtTime(preset.highpass, time, .02);
    this.tone.frequency.setTargetAtTime(preset.tone, time, .02); this.tone.gain.setTargetAtTime(preset.gain, time, .02);
    const request=++this.nextRequest;
    return new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(request);reject(Error('effect-not-applied'));},3000);
      this.pending.set(request,{resolve,reject,timer});
      this.processor.port.postMessage({semitones:preset.semitones,formants:preset.formants,request});
    });
  }
  setMuted(muted: boolean) {
    this.gate.gain.cancelScheduledValues(this.context.currentTime); this.gate.gain.setValueAtTime(muted ? 0 : 1, this.context.currentTime);
    this.stream.getAudioTracks().forEach(track => { track.enabled = !muted; });
    this.processor.port.postMessage({ muted });
  }
  replaceInput(stream: MediaStream) {
    const source = this.context.createMediaStreamSource(stream); source.connect(this.processor);
    this.source.disconnect(); this.source = source;
  }
  close() {
    this.onFailure = undefined; this.processor.onprocessorerror = null;
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(Error('effect-closed')); }
    this.pending.clear();
    this.source.disconnect(); this.processor.port.postMessage({ stop: true }); this.processor.disconnect(); this.processor.port.close();
    this.highpass.disconnect(); this.tone.disconnect(); this.gate.disconnect(); this.silentOutput.disconnect(); this.stream.getTracks().forEach(track => track.stop());
  }
}
