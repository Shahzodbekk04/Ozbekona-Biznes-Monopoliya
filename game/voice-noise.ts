/** Local RNNoise inference; audio and model stay in the browser. */
export class VoiceNoise {
  onFailure?: () => void;
  private source: MediaStreamAudioSourceNode;
  private output: MediaStreamAudioDestinationNode;
  private gate: GainNode;
  private silent: GainNode;
  private static modules = new WeakMap<AudioContext, Promise<void>>();
  private static binary?: Promise<ArrayBuffer>;
  readonly ready: Promise<void>;
  private constructor(private context: AudioContext, private processor: AudioWorkletNode, input: MediaStream) {
    this.ready = new Promise<void>((resolve,reject) => {
      const timer = setTimeout(() => reject(Error('noise-not-ready')), 4000);
      processor.port.onmessage = ({data}) => {
        if (data?.ready) { clearTimeout(timer); resolve(); }
        if (data?.failed) { clearTimeout(timer); reject(Error('noise-failed')); this.onFailure?.(); }
      };
      processor.onprocessorerror = () => { clearTimeout(timer); reject(Error('noise-failed')); this.onFailure?.(); };
    });
    this.source = context.createMediaStreamSource(input); this.output = context.createMediaStreamDestination(); this.output.channelCount = 1;
    this.gate = context.createGain(); this.silent = context.createGain(); this.silent.gain.value = 0;
    this.source.connect(processor); processor.connect(this.gate); this.gate.connect(this.output);
    this.gate.connect(this.silent); this.silent.connect(context.destination);
  }
  static async create(context: AudioContext, input: MediaStream) {
    if (![44100,48000].includes(context.sampleRate) || !context.audioWorklet || context.state !== 'running') throw Error('noise-unsupported');
    let module = this.modules.get(context);
    if (!module) { module = context.audioWorklet.addModule('/audio/rnnoise/processor.js?v=2'); this.modules.set(context,module); void module.catch(() => this.modules.delete(context)); }
    if (!this.binary) this.binary = fetch('/audio/rnnoise/rnnoise.wasm', {signal:AbortSignal.timeout(8000)}).then(response => { if (!response.ok) throw Error('noise-load'); return response.arrayBuffer(); }).catch(error => { this.binary = undefined; throw error; });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let binary: ArrayBuffer;
    try { [,binary] = await Promise.race([Promise.all([module,this.binary]),new Promise<never>((_,reject) => { timer = setTimeout(() => reject(Error('noise-timeout')),8000); })]); }
    finally { clearTimeout(timer); }
    if (context.state !== 'running') throw Error('audio-paused');
    const node = new VoiceNoise(context,new AudioWorkletNode(context,'business-rnnoise',{channelCount:1,channelCountMode:'explicit',numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],processorOptions:{wasmBinary:binary,maxChannels:1}}),input);
    try { await node.ready; return node; } catch(error) { node.close(); throw error; }
  }
  get stream() { return this.output.stream; }
  setMuted(muted:boolean) { this.gate.gain.setValueAtTime(muted?0:1,this.context.currentTime); this.stream.getAudioTracks().forEach(track => { track.enabled = !muted; }); this.processor.port.postMessage({muted}); }
  replaceInput(input:MediaStream) { const next = this.context.createMediaStreamSource(input); next.connect(this.processor); this.source.disconnect(); this.source = next; }
  close() { this.onFailure=undefined; this.processor.onprocessorerror=null; this.processor.port.postMessage('destroy'); this.source.disconnect(); this.processor.disconnect(); this.gate.disconnect(); this.silent.disconnect(); this.stream.getTracks().forEach(track=>track.stop()); }
}
