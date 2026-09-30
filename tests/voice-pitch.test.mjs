import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const code=(await readFile('public/audio/voice-pitch-worklet.js','utf8')).replace(/^import .*;\n/,'');
for(const rate of [44100,48000]){
 let Processor;const messages=[];
 vm.runInNewContext(code,{sampleRate:rate,Float32Array,Math,AudioWorkletProcessor:class{constructor(){this.port={onmessage:null,postMessage(message){messages.push(message)}}}},registerProcessor(_name,p){Processor=p}});
 for(const [semitones,formants] of [[0,0],[2.5,.8],[4,1.2],[-2.5,-.8]]){
  const processor=new Processor();
  for(let n=0;n<200&&!processor.engine;n++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.ok(processor.engine,'Actual pitch WASM initialized');
  processor.port.onmessage({data:{semitones,formants,request:42}});
  const result=[];let sample=0;
  for(let block=0;block<Math.ceil(rate/128);block++){
   const input=Float32Array.from({length:128},()=>.25*Math.sin(2*Math.PI*220*sample++/rate)),output=new Float32Array(128);
   assert.equal(processor.process([[input]],[[output]]),true);
   if(block>rate*.3/128)result.push(...output);
   assert.ok(output.every(Number.isFinite));assert.ok(output.every(n=>Math.abs(n)<=1));
  }
  let peak=0,frequency=0;
  for(let hz=140;hz<=380;hz++){
   let re=0,im=0;for(let i=0;i<result.length;i++){const phase=2*Math.PI*hz*i/rate;re+=result[i]*Math.cos(phase);im-=result[i]*Math.sin(phase)}
   const power=re*re+im*im;if(power>peak){peak=power;frequency=hz;}
  }
  const expected=220*2**(semitones/12);
  assert.ok(Math.abs(frequency-expected)<3,`${rate} Hz, semitones ${semitones}: expected ${expected}, got ${frequency}`);
  assert.ok(messages.some(m=>m.ready),'Ready only after audio rendering');assert.ok(messages.some(m=>m.applied===42),'Audio thread acknowledges the selected profile');
  // The old dry/wet chorus retained a second unshifted fundamental. Reject it.
  if(semitones){let re=0,im=0;for(let i=0;i<result.length;i++){re+=result[i]*Math.cos(2*Math.PI*220*i/rate);im+=result[i]*Math.sin(2*Math.PI*220*i/rate)}assert.ok((re*re+im*im)/peak<.01,'No second unshifted voice');}
  let resets=0;const reset=processor.engine._reset;processor.engine._reset=()=>{resets++;reset()};
  processor.port.onmessage({data:{muted:false}});assert.equal(resets,0,'Repeated unmuted state must not reset speech');
  processor.port.onmessage({data:{muted:true}});const output=new Float32Array(128);processor.process([[new Float32Array(128).fill(.5)]],[[output]]);assert.ok(output.every(v=>v===0));
  processor.port.onmessage({data:{muted:false}});
  for(let b=0;b<60;b++){processor.process([[new Float32Array(128)]],[[output]]);assert.ok(output.every(v=>v===0),'No previous speech may leak after unmute');}
  processor.port.onmessage({data:{stop:true}});assert.equal(processor.process([[]],[[output]]),false);
  console.log(`PASS actual pitch WASM ${rate} Hz: ${semitones} semitones, measured ${frequency} Hz, no dry-voice doubling, exact mute and cleared buffers.`);
 }
}
