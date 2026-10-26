import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GrowthQualityBadge, ExchangeRewardHint, shouldAnnounceExchange } from './exchange-feedback'
describe('quality and payout are separate',()=>{
 it('labels quality even without a payout',()=>{render(<GrowthQualityBadge qualified/>);expect(screen.getByText('高质量回复')).toBeInTheDocument();expect(screen.queryByText(/获得/)).toBeNull()})
 it('hides invalidated quality',()=>{const view=render(<GrowthQualityBadge qualified/>);view.rerender(<GrowthQualityBadge qualified={false}/>);expect(screen.queryByText('高质量回复')).toBeNull()})
 it('shows opportunity not guaranteed XP',()=>{render(<ExchangeRewardHint/>);expect(screen.getByText('有意义的提问、分享和建议，有机会获得经验奖励。')).toBeInTheDocument()})
 it.each([{id:1,qualified:true,xp:0,award_event:null},{id:1,qualified:false,xp:5,award_event:3},{id:2,qualified:true,xp:5,award_event:3},{id:1,qualified:true,xp:5,award_event:null}])('never claims unconfirmed reward %j',item=>expect(shouldAnnounceExchange(item,1)).toBe(false))
 it('announces only submitted content with actual ledger event',()=>expect(shouldAnnounceExchange({id:1,qualified:true,xp:5,award_event:3},1)).toBe(true))
})
