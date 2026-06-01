/** Action types mirrored from @scratch/scratch-gui reducers (UMD bundle has no exports). */
const RETURN_TO_SHOWING = 'scratch-gui/project-state/RETURN_TO_SHOWING'
const DONE_LOADING_VM_WITHOUT_ID =
  'scratch-gui/project-state/DONE_LOADING_VM_WITHOUT_ID'
const CLOSE_MODAL = 'scratch-gui/modals/CLOSE_MODAL'
const MODAL_LOADING_PROJECT = 'loadingProject'
const SET_PLAYER = 'scratch-gui/mode/SET_PLAYER'
const SET_FULL_SCREEN = 'scratch-gui/mode/SET_FULL_SCREEN'
const UPDATE_TARGET_LIST = 'scratch-gui/targets/UPDATE_TARGET_LIST'
const ACTIVATE_DECK = 'scratch-gui/cards/ACTIVATE_DECK'

let guiDispatch = null
let guiSynced = false

export function registerGuiDispatch(dispatch) {
  guiDispatch = dispatch
}

export function unregisterGuiDispatch() {
  guiDispatch = null
  guiSynced = false
}

/** Push VM targets into redux when vm-listener might skip updates (embed edge cases). */
export function forceReduxTargetsFromVm(vm) {
  if (!guiDispatch || !vm?.runtime?.targets) return
  const targetList = vm.runtime.targets
    .filter(
      (target) =>
        !Object.prototype.hasOwnProperty.call(target, 'isOriginal') ||
        target.isOriginal,
    )
    .map((target) => target.toJSON())
  guiDispatch({
    type: UPDATE_TARGET_LIST,
    targets: targetList,
    editingTarget: vm.editingTarget ? vm.editingTarget.id : null,
  })
}

/**
 * After host bootstrap loads the VM, scratch-gui redux may stay in FETCHING_NEW_DEFAULT
 * so fetchingProject stays true and the Loader blocks clicks (sprite/backdrop libraries).
 */
export function syncGuiProjectReady() {
  if (guiSynced) return true
  if (!guiDispatch) return false
  guiDispatch({ type: DONE_LOADING_VM_WITHOUT_ID })
  guiDispatch({ type: RETURN_TO_SHOWING })
  guiDispatch({ type: CLOSE_MODAL, modal: MODAL_LOADING_PROJECT })
  guiDispatch({ type: SET_PLAYER, isPlayerOnly: false })
  guiDispatch({ type: SET_FULL_SCREEN, isFullScreen: false })
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.scratchReady = '1'
  }
  guiSynced = true
  return true
}

/**
 * 直接打开某个官方教程的图文卡片（deck）。
 * deckId 必须是 Scratch GUI tutorials 库的 key，如 'tell-a-story'、'pong-game'。
 * 返回 false 表示 dispatch 尚不可用（GUI 未就绪），调用方可回退到打开全部教程。
 */
export function activateTutorialDeck(deckId) {
  if (!guiDispatch || !deckId) return false
  guiDispatch({ type: ACTIVATE_DECK, activeDeckId: deckId, step: 0 })
  return true
}
