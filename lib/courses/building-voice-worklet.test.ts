import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const script=readFileSync('public/courses/vosk/v1/capture-worklet.js','utf8')
type AudioJob = { type: string; id: number; samples?: Float32Array }
type Reply = { type: string; id: number }
type Port = { onmessage: (event: { data: Reply }) => void; postMessage: (message: AudioJob) => void }
type Control = { type: string; port?: Port; epoch?: number; enabled?: boolean }
type Processor = {
 port: { onmessage: (event: { data: Control }) => void }
 process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean
 failed: boolean; maxQueued: number; activeGapFrames: number; queue: AudioJob[]
}
function fixture(rate=16000,delay=0){
 let Processor!: new () => Processor
 let at=0
 const acks: Array<{at:number;id:number}>=[],events: Array<{type:string}>=[],messages: AudioJob[]=[]
 const globals={Float32Array,Date,sampleRate:rate,currentTime:0,currentFrame:0,AudioWorkletProcessor:class {port={postMessage:(m: {type:string})=>events.push(m)}},registerProcessor:(_: string,c: new () => Processor)=>Processor=c}
 runInNewContext(script,globals)
 const p=new Processor(),port: Port={onmessage:()=>{},postMessage:(m: AudioJob)=>{messages.push(m);acks.push({at:at+delay,id:m.id})}}
 p.port.onmessage({data:{type:'connect',port}});p.port.onmessage({data:{type:'state',epoch:1,enabled:true}})
 function feed(ms: number,amplitude=0){
  const count=Math.round(rate*ms/1000)
  for(let offset=0;offset<count;offset+=128){
   while(acks[0]?.at<=at){const ack=acks.shift()!;port.onmessage({data:{type:'ack',id:ack.id}})}
   globals.currentTime=at/1000;globals.currentFrame=Math.round(at/1000*rate)
   p.process([[Float32Array.from({length:Math.min(128,count-offset)},(_,n)=>amplitude*Math.sin(2*Math.PI*440*(offset+n)/rate))]],[[new Float32Array(128)]])
   at+=Math.min(128,count-offset)/rate*1000
  }
 }
 return {p,port,feed,events,messages,setDelay:(n: number)=>delay=n,gap:(ms: number)=>at+=ms}
}
describe('bounded local speech capture',()=>{
it.each([16000,44100,48000])('preserves complete %s Hz speech with bounded buffers',(rate)=>{
 const f=fixture(rate);f.feed(800);f.feed(1000,.1);f.feed(1000)
 assert.equal(f.messages.filter((m)=>m.type==='end').length,1)
 assert.equal(f.messages.filter((m)=>m.type==='chunk').reduce((n,m)=>n+(m.samples?.length??0),0),Math.round(rate*1.96))
 assert.equal(f.events.filter((m)=>m.type==='overflow').length,0)
})
it('absorbs a 500 ms transient inference stall without losing samples',()=>{
 const f=fixture();f.feed(800);f.setDelay(500);f.feed(120,.1);f.setDelay(0);f.feed(880,.1);f.feed(1300)
 assert.equal(f.messages.filter((m)=>m.type==='end').length,1)
 assert.equal(f.messages.filter((m)=>m.type==='chunk').reduce((n,m)=>n+(m.samples?.length??0),0),31360)
 assert.ok(f.p.maxQueued<=12);assert.ok(!f.p.failed)
})
it('fails closed on sustained overload instead of growing its queue',()=>{
 const f=fixture();f.feed(800);f.setDelay(5000);f.feed(3000,.1);f.feed(1000)
 assert.ok(f.p.failed);assert.equal(f.events.filter((m)=>m.type==='overflow').length,1)
 assert.equal(f.p.queue.length,0);assert.equal(f.messages.filter((m)=>m.type==='end').length,0)
})
it('discards overlong speech and navigation fragments',()=>{
 const f=fixture();f.feed(800);f.feed(10000,.1);f.feed(1000)
 assert.equal(f.messages.filter((m)=>m.type==='cancel').length,1);assert.equal(f.messages.filter((m)=>m.type==='end').length,0)
 f.feed(700,.1);f.p.port.onmessage({data:{type:'state',epoch:2,enabled:true}});f.feed(1000)
 assert.equal(f.messages.filter((m)=>m.type==='end').length,0)
 f.feed(1000,.1);f.feed(1000);assert.equal(f.messages.filter((m)=>m.type==='end').length,1)
})
it('re-arms after idle gaps but reports a gap inside active speech',()=>{
 const f=fixture();f.feed(800);f.gap(32);f.feed(1000)
 assert.ok(!f.p.failed)
 f.feed(600,.1);f.gap(32);f.feed(20,.1)
 assert.ok(f.p.failed);assert.equal(f.p.activeGapFrames,512)
 assert.equal(f.events.filter((m)=>m.type==='interrupted').length,1)
 assert.equal(f.messages.filter((m)=>m.type==='end').length,0)
})
})
