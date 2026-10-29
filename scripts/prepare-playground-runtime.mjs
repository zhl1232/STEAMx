import { readFile,mkdir,writeFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { pathToFileURL } from 'node:url'
export async function preparePlaygroundRuntime(){
 const output=new URL('../.next/playground-runtime/',import.meta.url);await mkdir(output,{recursive:true})
 for(const name of ['challenge-engine','challenge-ai','gomoku-engine','memory-levels']){
  const source=await readFile(new URL(`../lib/playground/${name}.ts`,import.meta.url),'utf8')
  const code=stripTypeScriptTypes(source,{mode:'strip'}).replace(/from (['"])\.\/([^'"]+)\1/g,(_,quote,path)=>`from ${quote}./${path}.mjs${quote}`)
  await writeFile(new URL(`${name}.mjs`,output),code)
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await preparePlaygroundRuntime()
