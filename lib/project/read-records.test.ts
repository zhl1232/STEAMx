import { expect, it, vi } from 'vitest'
import { readProjectRecords } from './read-records'
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status})
it('throws for list failure and can retry to load existing records', async () => {
 const fetcher=vi.fn().mockResolvedValueOnce(json({},503)).mockResolvedValueOnce(json({journeys:[{id:7,status:'active'}]})).mockResolvedValueOnce(json({journey:{status:'active'},records:[{id:9}]}))
 await expect(readProjectRecords(149,7,undefined,fetcher)).rejects.toThrow('列表读取失败')
 await expect(readProjectRecords(149,7,undefined,fetcher)).resolves.toMatchObject({id:7,records:[{id:9}]})
})
it('does not turn detail or malformed response failure into empty records', async () => {
 const fetcher=vi.fn().mockResolvedValueOnce(json({journeys:[{id:7,status:'active'}]})).mockResolvedValueOnce(json({},500))
 await expect(readProjectRecords(149,7,undefined,fetcher)).rejects.toThrow('探索记录读取失败')
 await expect(readProjectRecords(149,null,undefined,vi.fn().mockResolvedValue(json({})))).rejects.toThrow('格式无效')
})
it('returns an empty result only for a successful empty list', async () => {
 await expect(readProjectRecords(149,null,undefined,vi.fn().mockResolvedValue(json({journeys:[]})))).resolves.toEqual({id:null,status:null,records:[]})
})
