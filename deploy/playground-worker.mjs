import { setTimeout as delay } from 'node:timers/promises'
const stop=new AbortController()
process.once('SIGTERM',()=>stop.abort());process.once('SIGINT',()=>stop.abort())
const secret=process.env.CRON_SECRET||process.env.INTERNAL_API_SECRET
if(!secret)throw new Error('Missing internal API secret')
while(!stop.signal.aborted){try{const response=await fetch(`${process.env.PLAYGROUND_WORKER_BASE_URL||'http://steam-app:3000'}/api/internal/playground/tick`,{method:'POST',headers:{authorization:`Bearer ${secret}`},signal:AbortSignal.any([stop.signal,AbortSignal.timeout(10000)])});if(!response.ok)console.error('playground tick HTTP',response.status)}catch(error){if(!stop.signal.aborted)console.error('playground tick failed',error.message)}try{await delay(200,undefined,{signal:stop.signal})}catch{break}}
