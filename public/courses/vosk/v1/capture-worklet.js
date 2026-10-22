/* Bounded speech segmentation. No decoding or PCM on the 3D main thread. */
class BuildingVoskCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.frame=new Float32Array(Math.round(sampleRate*.02))
    this.pre=new Float32Array(this.frame.length*15)
    this.queue=[];this.inflight=null;this.sequence=0;this.epoch=0;this.segment=0
    this.enabled=false;this.heartbeatSamples=0;this.lastFrame=null;this.gapFrames=0;this.activeGapFrames=0;this.failed=false;this.maxQueued=0;this.totalCaptured=0;this.totalSent=0
    this.resetSpeech()
    this.port.onmessage=({data})=>{
      if(data.type==='connect'){
        this.audioPort=data.port
        this.audioPort.onmessage=({data:reply})=>{
          if(reply.type!=='ack'||reply.id!==this.inflight?.id)return
          this.inflight=null;this.drain()
        }
        this.drain()
      }else if(data.type==='state'){
        this.enabled=data.enabled;this.epoch=data.epoch;this.lastFrame=null
        this.queue=[];this.failed=false;this.resetSpeech()
        this.enqueue({type:'reset'})
      }else if(data.type==='stats')this.port.postMessage({type:'stats',id:data.id,...this.stats()})
    }
  }
  stats(){return {totalCaptured:this.totalCaptured,totalSent:this.totalSent,maxQueued:this.maxQueued,queued:this.queue.length,inflight:!!this.inflight,failed:this.failed,gapFrames:this.gapFrames,activeGapFrames:this.activeGapFrames,audioTime:currentTime}}
  resetSpeech(){
    this.frameLength=0;this.preIndex=0;this.pre.fill(0);this.active=false;this.quiet=0;this.armed=false
    this.length=0;this.silence=0;this.voiced=0;this.chunk=new Float32Array(this.frame.length*5);this.chunkLength=0
  }
  enqueue(message){
    if(this.failed)return
    // At most 12 jobs (<= 1.2s PCM) + one 100ms in flight. Overload invalidates the session.
    if(this.queue.length>=12){
      this.failed=true;this.queue=[];this.resetSpeech()
      this.port.postMessage({type:'overflow'});return
    }
    this.queue.push({...message,id:++this.sequence,epoch:this.epoch,segment:this.segment})
    this.maxQueued=Math.max(this.maxQueued,this.queue.length);this.drain()
  }
  drain(){
    if(this.inflight||!this.audioPort||!this.queue.length)return
    const job=this.queue.shift();this.inflight={id:job.id}
    this.audioPort.postMessage(job,job.samples?[job.samples.buffer]:[])
    if(job.type==='chunk')this.totalSent++
  }
  append(frame){
    for(let i=0;i<frame.length;i++){
      this.chunk[this.chunkLength++]=frame[i]
      if(this.chunkLength===this.chunk.length)this.flush()
    }
  }
  flush(){
    if(!this.chunkLength)return
    this.enqueue({type:'chunk',samples:this.chunk.slice(0,this.chunkLength),sampleRate})
    this.chunkLength=0
  }
  acceptFrame(audioEnd){
    let power=0
    for(const value of this.frame)power+=value*value
    const voice=Math.sqrt(power/this.frame.length)>=.012
    this.totalCaptured++
    if(!this.armed){
      this.quiet=voice?0:this.quiet+1
      if(this.quiet>=33)this.armed=true
      return
    }
    if(!this.active&&!voice){
      this.pre.set(this.frame,this.preIndex);this.preIndex=(this.preIndex+this.frame.length)%this.pre.length;return
    }
    if(!this.active){
      this.active=true;this.segment++;this.enqueue({type:'begin',sampleRate})
      this.append(this.pre.subarray(this.preIndex));this.append(this.pre.subarray(0,this.preIndex));this.length=this.pre.length
    }
    this.append(this.frame);this.length+=this.frame.length
    this.silence=voice?0:this.silence+1
    if(voice)this.voiced++
    if(this.length>sampleRate*6){
      this.flush();this.enqueue({type:'cancel',reason:'too-long'});this.resetSpeech();return
    }
    if(this.silence<33)return
    this.flush();this.enqueue({type:'end',valid:this.voiced>=15,speechStart:this.pre.length/sampleRate,speechEnd:this.length/sampleRate-this.silence*.02,duration:this.length/sampleRate,audioEnd,capturedAt:Date.now()})
    // Already observed the quiet boundary; don't require a second quiet interval.
    this.resetSpeech();this.armed=true
  }
  process(inputs,outputs){
    for(const output of outputs)for(const channel of output)channel.fill(0)
    const input=inputs[0]?.[0]
    if(input){
      if(this.lastFrame!==null&&currentFrame>this.lastFrame){
        const gap=currentFrame-this.lastFrame;this.gapFrames+=gap
        // Startup/idle graph gaps require quiet arming again; they aren't lost speech.
        if(this.active){this.activeGapFrames+=gap;this.failed=true;this.queue=[];this.port.postMessage({type:'interrupted'})}
        this.resetSpeech()
      }
      this.lastFrame=currentFrame+input.length
    }
    this.heartbeatSamples+=input?.length||0
    if(this.heartbeatSamples>=sampleRate){this.heartbeatSamples=0;this.port.postMessage({type:'heartbeat',at:Date.now(),stats:this.stats()})}
    if(!input||!this.enabled||this.failed)return true
    for(let i=0;i<input.length;i++){
      this.frame[this.frameLength++]=input[i]
      if(this.frameLength===this.frame.length){this.frameLength=0;this.acceptFrame(currentTime+(i+1)/sampleRate)}
    }
    return true
  }
}
registerProcessor('building-vosk-capture',BuildingVoskCapture)
