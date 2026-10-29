import { describe, expect, it } from 'vitest'
import { advanceChallengeTime, adjustedChallengeStrength, applyChallengeAction, challengePublicState, challengeRandom, createChallengeState } from './challenge-engine'
import { chooseChallengeBotAction, nextBotActionAt } from './challenge-ai'
const memory = () => createChallengeState({game:'memory',startAt:1000,seed:'test-private-seed',pairCount:6})
describe('authoritative challenge rules', () => {
  it('never exposes dark labels, pairing keys, seed or opponent card identities', () => {
    const state = memory(), view = challengePublicState(state,0,1000)
    const wire = JSON.stringify(view)
    expect(view.cards.every(c => !('label' in c) && !('key' in c))).toBe(true)
    expect(wire).not.toContain(state.seed)
    expect(wire).not.toContain(state.memory[1].ids[0])
    const flipped = applyChallengeAction(state,0,{type:'flip',cardId:state.memory[0].ids[0]},1000)
    expect(challengePublicState(flipped,0,1000).cards[0].label).toBe(state.deck[0].label)
    expect(challengePublicState(flipped,1,1000).cards[0].label).toBeUndefined()
    expect(state.memory[0].open).toEqual([])
  })
  it('shares layout but not progress, validates flip speed and pair cooldown', () => {
    let state = memory()
    const a = 0, b = state.deck.findIndex((c,i) => i !== a && c.key === state.deck[a].key)
    state = applyChallengeAction(state,0,{type:'flip',cardId:state.memory[0].ids[a]},1000)
    expect(() => applyChallengeAction(state,0,{type:'flip',cardId:state.memory[0].ids[b]},1100)).toThrow('too_fast')
    state = applyChallengeAction(state,0,{type:'flip',cardId:state.memory[0].ids[b]},1250)
    expect(state.memory.map(p=>p.pairs)).toEqual([1,0])
    const next = state.memory[0].ids.find((_,i)=> !state.memory[0].matched.includes(i))!
    expect(() => applyChallengeAction(state,0,{type:'flip',cardId:next},1500)).toThrow('too_fast')
    expect(applyChallengeAction(state,0,{type:'flip',cardId:next},1570).memory[0].open).toHaveLength(1)
  })
  it('rejects early play and expires before accepting late progress', () => {
    const state = memory(), action = {type:'flip' as const,cardId:state.memory[0].ids[0]}
    expect(() => applyChallengeAction(state,0,action,999)).toThrow('not_started')
    expect(applyChallengeAction(state,0,action,121000)).toMatchObject({status:'finished',winner:'draw'})
  })
  it('finishes immediately on the last pair and never accepts later actions', () => {
    let state = memory(), time = 1000
    const keys = [...new Set(state.deck.map(c=>c.key))]
    for (const key of keys) {
      for (const i of state.deck.map((c,i)=>c.key === key ? i : -1).filter(i=>i>=0)) {
        state = applyChallengeAction(state,0,{type:'flip',cardId:state.memory[0].ids[i]},time); time += 350
      }
    }
    expect(state).toMatchObject({status:'finished',winner:0})
    expect(applyChallengeAction(state,1,{type:'resign'},time)).toBe(state)
  })
  it('decides an unfinished race by completed pairs at the exact deadline', () => {
    const state = memory(); state.memory[1].pairs = 2
    expect(advanceChallengeTime(state,121000)).toMatchObject({winner:1,finishedAt:121000})
  })
  it('charges only the active chess clock and enforces the 20 second limit', () => {
    let state = createChallengeState({game:'gomoku',startAt:1000,seed:'chess',firstPlayer:0})
    state = applyChallengeAction(state,0,{type:'move',row:7,col:7},11000)
    expect(state.remainingMs).toEqual([110000,120000])
    expect(advanceChallengeTime(state,31000)).toMatchObject({winner:0,status:'finished'})
  })
  it('enforces the cumulative clock when less than a step remains', () => {
    const state = createChallengeState({game:'gomoku',startAt:1000,seed:'chess',firstPlayer:0})
    state.remainingMs[0] = 500
    expect(applyChallengeAction(state,0,{type:'move',row:7,col:7},1500)).toMatchObject({winner:1})
  })
  it('clamps persistent adaptive strength and leaves draws unchanged', () => {
    expect(adjustedChallengeStrength(40,'win')).toBe(48)
    expect(adjustedChallengeStrength(4,'loss')).toBe(0)
    expect(adjustedChallengeStrength(99,'win')).toBe(100)
    expect(adjustedChallengeStrength(40,'draw')).toBe(40)
  })
  it('computer actions are scheduled real flips that cannot depend on hidden faces', () => {
    const state = memory(), at = nextBotActionAt(state,1)
    expect(chooseChallengeBotAction(state,1,at-1)).toBeNull()
    const action = chooseChallengeBotAction(state,1,at)
    const shuffledSecrets = structuredClone(state)
    shuffledSecrets.deck.reverse()
    expect(chooseChallengeBotAction(shuffledSecrets,1,at)).toEqual(action)
    expect(action?.type).toBe('flip')
    const next = applyChallengeAction(state,1,action!,at)
    expect(next.memory[1].open).toHaveLength(1)
  })
  it('moves toward a roughly even win rate against a monotonic simulated skill model', () => {
    const random = challengeRandom('calibration-simulation')
    let strength = 40, wins = 0, samples = 0
    for (let round = 0; round < 10000; round++) {
      const win = random() < 1 - strength / 100
      strength = adjustedChallengeStrength(strength,win ? 'win' : 'loss')
      if (round >= 2000) { samples++; if (win) wins++ }
    }
    expect(wins / samples).toBeGreaterThan(.45)
    expect(wins / samples).toBeLessThan(.55)
  })

})
