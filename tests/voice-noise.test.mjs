import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const filename='public/audio/rnnoise/processor.js';
const source=(await readFile(filename,'utf8')).replaceAll('import.meta.url',JSON.stringify('https://game.test/audio/rnnoise/processor.js'));
for(const rate of [44100,48000]) {
let Processor,ready=false;
const scope={WebAssembly,console,TextDecoder,TextEncoder,URL,performance,setTimeout,clearTimeout,sampleRate:rate,
 AudioWorkletProcessor:class{constructor(){this.port={postMessage(message){if(message?.ready)ready=true;},addEventListener(){},start(){}}}},
 registerProcessor(name,implementation){if(name==='business-rnnoise')Processor=implementation}};
vm.runInNewContext(source,scope,{filename});
const bytes=await readFile('public/audio/rnnoise/rnnoise.wasm');
const processor=new Processor({processorOptions:{wasmBinary:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),maxChannels:1}});
for(let n=0;n<200&&!processor.state;n++)await new Promise(resolve=>setTimeout(resolve,10));
assert.ok(processor.state,'Actual WASM model must initialize');
let random=12345,inputEnergy=0,outputEnergy=0,samples=0,at=0;
const start=performance.now();
for(let block=0;block<1875;block++){
 const input=Float32Array.from({length:128},()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return (random/4294967296-.5)*.04+.006*Math.sin(at++*2*Math.PI*110/rate);});
 const output=new Float32Array(128);assert.equal(processor.process([[input]],[[output]],{}),true);
 assert.ok(output.every(Number.isFinite));
 if(block>750)for(let i=0;i<128;i++){inputEnergy+=input[i]**2;outputEnergy+=output[i]**2;samples++}
}
assert.ok(ready,'Readiness message emitted after actual processor starts');
const reduction=10*Math.log10(inputEnergy/outputEnergy);
assert.ok(reduction>30,`Stationary noise reduction was only ${reduction.toFixed(1)} dB`);
processor.port.onmessage({data:{muted:true}});const silence=new Float32Array(128);processor.process([[new Float32Array(128).fill(.5)]],[[silence]]);assert.ok(silence.every(v=>v===0));
processor.port.onmessage({data:{muted:false}});for(let n=0;n<30;n++){processor.process([[new Float32Array(128)]],[[silence]]);assert.ok(silence.every(v=>v===0),'No buffered speech after unmute');}
processor.destroy();assert.equal(processor.process([[]],[[new Float32Array(128)]],{}),false);
console.log(`PASS actual RNNoise WASM ${rate} Hz: ${reduction.toFixed(1)} dB hiss + fan noise reduction, readiness, finite samples, shutdown. Five seconds processed in ${Math.round(performance.now()-start)} ms. This is a signal test, not a live-device listening test.`);

}
