export interface BirdObservationLocationPreset {
  id: string
  name: string
  description: string
  latitude: number
  longitude: number
}

export const birdObservationLocationPresets: BirdObservationLocationPreset[] = [
  {
    id: 'olympic-forest-park-south',
    name: '奥林匹克森林公园南园湿地',
    description: '湿地与林缘交错，适合入门观察水鸟和常见林鸟',
    latitude: 40.0095,
    longitude: 116.3962,
  },
  {
    id: 'beihai-park-lake',
    name: '北海公园湖区',
    description: '路线短、到达方便，适合第一次练习看湖面和岸边鸟',
    latitude: 39.9312,
    longitude: 116.3899,
  },
  {
    id: 'summer-palace-lake',
    name: '颐和园昆明湖区',
    description: '空间开阔，适合观察鸭类、鸥类和鹭类',
    latitude: 39.9999,
    longitude: 116.2755,
  },
  {
    id: 'protective-moat',
    name: '北京护城河沿线',
    description: '沿线可多点停留，适合补充城市水域观察线索',
    latitude: 39.9291,
    longitude: 116.4171,
  },
  {
    id: 'campus-greenbelt',
    name: '校园绿地',
    description: '最容易连续复访，适合晨间短时观察',
    latitude: 39.9042,
    longitude: 116.4074,
  },
]
