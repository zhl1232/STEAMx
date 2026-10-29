import 'server-only'
import { Worker } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { access } from 'node:fs/promises'
import type { ChallengeAction, ChallengeState } from './challenge-engine'
export async function isolatedChallengeBot(state:ChallengeState):Promise<ChallengeAction|null>{
 const modulePath=resolve(process.cwd(),'.next/playground-runtime/challenge-ai.mjs')
 await access(modulePath)
 return new Promise((resolveAction,reject)=>{
  const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');import(workerData.url).then(m=>parentPort.postMessage(m.chooseChallengeBotAction(workerData.state,1,Date.now()))).catch(e=>{throw e})`,{eval:true,execArgv:[],workerData:{url:pathToFileURL(modulePath).href,state},resourceLimits:{maxOldGenerationSizeMb:128}})
  const timer=setTimeout(()=>{void worker.terminate();reject(new Error('computer_timeout'))},2500)
  worker.once('message',(action:ChallengeAction|null)=>{clearTimeout(timer);void worker.terminate();resolveAction(action)})
  worker.once('error',error=>{clearTimeout(timer);reject(error)})
  worker.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(new Error('computer_worker_exit'))})
 })
}
