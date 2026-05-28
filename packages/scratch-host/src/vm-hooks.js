import { forceReduxTargetsFromVm } from './gui-sync.js'

/**
 * Serialize VM mutations (loadProject vs addSprite must not overlap).
 * Do NOT call syncTargetsToGui from loadProject — that caused reload loops.
 */

const ADD_SPRITE_TIMEOUT_MS = 45000

function createVmChain() {
  let tail = Promise.resolve()

  function chain(operation) {
    const run = tail.then(operation)
    tail = run.catch((err) => {
      console.error('[scratch-host] vm chain error:', err)
    })
    return run
  }

  return { chain }
}

/**
 * @param {import('@scratch/scratch-vm')} vm
 * @param {{
 *   syncTargetsToGui: (vm: unknown) => void
 *   drawStage: (vm: unknown) => void
 * }} helpers
 */
export function attachVmHooks(vm, helpers) {
  if (vm.__steamScratchHooks) return
  vm.__steamScratchHooks = true

  const { syncTargetsToGui, drawStage } = helpers
  const { chain } = createVmChain()

  const originalLoadProject = vm.loadProject.bind(vm)
  const originalAddSprite = vm.addSprite.bind(vm)
  const originalAddBackdrop =
    typeof vm.addBackdrop === 'function' ? vm.addBackdrop.bind(vm) : null

  vm.loadProject = function loadProjectChained(projectData) {
    return chain(() => originalLoadProject(projectData))
  }

  let addSpriteInFlight = null

  vm.addSprite = function addSpriteWrapped(input) {
    vm.__steamUserTouched = true

    if (addSpriteInFlight) {
      console.warn('[scratch-host] addSprite already in progress, reusing promise')
      return addSpriteInFlight
    }

    addSpriteInFlight = chain(() => {
      const before = vm.runtime?.targets?.length ?? 0
      console.info('[scratch-host] addSprite start', { before })

      const work = Promise.race([
        originalAddSprite(input),
        new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error(`addSprite timed out after ${ADD_SPRITE_TIMEOUT_MS}ms`)),
            ADD_SPRITE_TIMEOUT_MS,
          )
        }),
      ])

      return work
        .then((result) => {
          const after = vm.runtime?.targets?.length ?? 0
          console.info('[scratch-host] addSprite ok', { before, after })
          syncTargetsToGui(vm)
          forceReduxTargetsFromVm(vm)
          drawStage(vm)
          return result
        })
        .catch((err) => {
          console.error('[scratch-host] addSprite failed:', err)
          throw err
        })
    }).finally(() => {
      addSpriteInFlight = null
    })

    return addSpriteInFlight
  }

  if (originalAddBackdrop) {
    vm.addBackdrop = function addBackdropWrapped(md5ext, backdropObject) {
      vm.__steamUserTouched = true
      return chain(() =>
        originalAddBackdrop(md5ext, backdropObject)
          .then((result) => {
            console.info('[scratch-host] addBackdrop ok')
            syncTargetsToGui(vm)
            forceReduxTargetsFromVm(vm)
            drawStage(vm)
            return result
          })
          .catch((err) => {
            console.error('[scratch-host] addBackdrop failed:', err)
            throw err
          }),
      )
    }
  }
}
