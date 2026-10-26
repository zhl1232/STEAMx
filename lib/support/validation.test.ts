import {describe,it,expect} from 'vitest'
import {imageMime,uuid,cursor} from './validation'
describe('private support attachments',()=>{
  it('identifies file bytes independently of claimed MIME',()=>{
    const png=new Uint8Array(24);png.set([137,80,78,71,13,10,26,10]);expect(imageMime(png)).toBe('image/png')
    expect(imageMime(new Uint8Array([255,216,255,217]))).toBe('image/jpeg')
    const webp=new TextEncoder().encode('RIFF1234WEBPVP8 ');expect(imageMime(webp)).toBe('image/webp')
  })
  it('rejects active content, unsupported formats, empty or oversized files',()=>{
    for(const bytes of [new TextEncoder().encode('<svg onload="evil()"/>'),new TextEncoder().encode('<script>bad</script>'),new Uint8Array(),new Uint8Array(5*1024*1024+1)])expect(()=>imageMime(bytes)).toThrow()
  })
})
describe('support identifiers and cursors',()=>{
  it('rejects unbounded and malformed sequence values',()=>{expect(cursor(null)).toBe(null);expect(cursor('42')).toBe(42);for(const n of ['-1','Infinity','1.5','abc','9007199254740992'])expect(()=>cursor(n)).toThrow()})
  it('requires a UUID for client idempotency and context',()=>{expect(uuid('00441431-6789-4abc-8def-012345678901')).toBe('00441431-6789-4abc-8def-012345678901');expect(()=>uuid('bad')).toThrow();expect(()=>uuid({})).toThrow()})
})
