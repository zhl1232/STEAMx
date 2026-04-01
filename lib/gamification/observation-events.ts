/** 浏览器自定义事件名：成功提交鸟类观察后派发，由游戏化层监听并刷新统计 */
export const OBSERVATION_CREATED_EVENT = 'steam:observation-created'

export function dispatchObservationCreated(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OBSERVATION_CREATED_EVENT))
}
