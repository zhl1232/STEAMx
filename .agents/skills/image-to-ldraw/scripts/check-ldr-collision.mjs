import { readdir, readFile } from 'node:fs/promises'
import { resolve, join, basename } from 'node:path'
import { loadPartMetadata, resolveAssembly } from './ldraw-common.mjs'

async function main() {
  const modelsDir = resolve(process.cwd(), 'scripts/ldraw-models')
  const mpdDir = resolve(process.cwd(), 'public/courses/ldraw')

  const files = await readdir(modelsDir)
  const ldrFiles = files.filter(f => f.endsWith('.ldr') && !f.includes('duplo_') && /^[45]-/.test(f))

  const partMetadata = await loadPartMetadata()
  let hasErrors = false
  
  for (const ldrFile of ldrFiles) {
    const slug = basename(ldrFile, '.ldr')
    const mpdPath = join(mpdDir, `${slug}.mpd`)
    let mpdExists = false
    try {
      await readFile(mpdPath)
      mpdExists = true
    } catch (e) {
      // no mpd
    }
    
    if (mpdExists) continue
    
    const ldrPath = join(modelsDir, ldrFile)
    const content = await readFile(ldrPath, 'utf8')
    const lines = content.split('\n')
    
    const placements = []
    let index = 1
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('1 ')) {
        const parts = trimmed.split(/\s+/)
        const partId = parts[parts.length - 1]
        
        placements.push({
          id: `line_${index}`,
          partId: partId,
          color: parseInt(parts[1], 10),
          anchor: {
            type: 'ldrawLine',
            line: trimmed
          },
          // To satisfy validation, we declare manual support
          support: { type: 'manual', reason: 'ldr import' }
        })
        index++
      }
    }
    
    const assembly = {
      model: ldrFile,
      placements
    }
    
    try {
      const validation = resolveAssembly(assembly, partMetadata)
      const collisions = validation.errors.filter(e => e.includes('collides with') || e.includes('penetrates'))
      if (collisions.length > 0) {
        console.log(`\n❌ [${ldrFile}] has ${collisions.length} collision(s):`)
        collisions.forEach(err => console.log(`  - ${err}`))
        hasErrors = true
      } else {
        console.log(`✅ [${ldrFile}] OK`)
      }
    } catch (e) {
      console.log(`\n⚠️ [${ldrFile}] Failed to validate: ${e.message}`)
      hasErrors = true
    }
  }
}

main().catch(console.error)
