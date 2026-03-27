export interface BirdObservationSection {
  title: string
  description?: string
  bullets?: string[]
}

export interface BirdObservationResource {
  slug: string
  title: string
  summary: string
  sections: BirdObservationSection[]
}

export interface BirdObservationTopicCopy {
  channelTitle: string
  topicTitle: string
  topicSubtitle: string
  primaryCta: string
  secondaryCta: string
}

export interface BirdObservationLocationPreset {
  id: string
  name: string
  description: string
  latitude: number
  longitude: number
}

export const birdObservationTopicCopy: BirdObservationTopicCopy = {
  channelTitle: '自然观察',
  topicTitle: '北京春季观鸟',
  topicSubtitle: '从能反复到达的校园、公园和社区开始，先认识常见鸟、学会基本观察方法，再完成你的第一条真实观察记录。',
  primaryCta: '看新手路径',
  secondaryCta: '先认识常见鸟',
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

export const birdObservationResources: BirdObservationResource[] = [
  {
    slug: 'birding-basics',
    title: '鸟类观察入门',
    summary: '先学会看什么、怎么记，再去完成第一次鸟类观察。',
    sections: [
      {
        title: '观察前先记住',
        bullets: [
          '第一次不需要跑远，先从身边能反复到达的地方开始。',
          '第一次不追求认出很多鸟，先稳定认住一种常见鸟就够了。',
          '第一次也不必写很长，先把时间、地点、物种和行为写清楚。',
        ],
      },
      {
        title: '建议装备',
        bullets: [
          '图鉴：帮助快速识别和核对关键特征。',
          '双筒望远镜：优先选择 8 倍或 10 倍，适合大多数入门观察。',
          '笔记本：现场记录时间、地点、数量和行为。',
          '手机或相机：用于必要的影像补证，不必把拍照当作唯一目标。',
        ],
      },
      {
        title: '观察顺序',
        bullets: [
          '先静看 3 到 5 分钟，不急着举起相机。',
          '先分辨环境和活动方式，再尝试辨认物种。',
          '先看鸟在做什么，再判断它是什么。',
          '优先记录最容易确认的信息，再补充细节。',
        ],
      },
      {
        title: '记录原则',
        bullets: [
          '先客观描述，再做判断。',
          '现场优先记录事实，不急着下结论。',
          '语音记录可以替代部分文字记录。',
          '影像记录要服务于观察，不要反过来挤占观察本身。',
        ],
      },
    ],
  },
  {
    slug: 'beijing-locations',
    title: '北京入门观察地点',
    summary: '先选能反复到达、能安静停留的地点，不必一开始就追热门观鸟点。',
    sections: [
      {
        title: '优先场景',
        bullets: [
          '城市公园湖区：适合看鸭类、鹭类和常见水鸟。',
          '湿地公园边缘：适合站定观察，不必来回走动。',
          '校园绿地：适合晨间观察和连续记录。',
          '社区树阵和灌丛：适合积累身边常见鸟清单。',
          '景观河道、湖岸和稳定水面：适合补充城市水域线索。',
          '近郊水库和湿地：适合进阶观察，但不是首期必需。',
        ],
      },
      {
        title: '北京可直接参考的地点类型',
        bullets: [
          '颐和园的大型湖区环境。',
          '北海公园等城市公园水域。',
          '奥林匹克森林公园及周边湿地环境。',
          '护城河、景观河道等线性水域。',
        ],
      },
      {
        title: '选点建议',
        bullets: [
          '优先选择能重复到达的地点。',
          '优先选择可以安静停留 20 到 40 分钟的位置。',
          '第一次观察不必追求稀有鸟，先从常见鸟开始。',
        ],
      },
    ],
  },
  {
    slug: 'common-waterbirds',
    title: '常见水鸟参考清单',
    summary: '从更容易在公园和湿地里看到的鸟种开始，先建立场景感和识别感。',
    sections: [
      {
        title: '首批建议物种',
        bullets: [
          '小䴙䴘：几乎有水面就可能见到，擅长潜水。',
          '普通鸬鹚：常潜水捕鱼，也常张翅晾晒。',
          '苍鹭：常在水边静立等待猎物，晨昏较活跃。',
          '大白鹭：常出现在公园湿地与景观水域。',
          '白鹭：在浅水中活动明显，适合初学者观察。',
          '池鹭：喜植被丰富水域，走走停停觅食。',
          '夜鹭：黄昏和傍晚更活跃，城市水域也可能见到。',
          '绿头鸭：冬春常见，适合做行为观察。',
        ],
      },
      {
        title: '观察时先看什么',
        bullets: [
          '它是在水上游、在浅水走，还是在岸边停？',
          '体型更像鸭、鹭，还是更像潜水鸟？',
          '它是在觅食、梳羽、休息，还是在争斗或求偶？',
        ],
      },
    ],
  },
  {
    slug: 'record-template',
    title: '常见观察记录模板',
    summary: '第一步是把观察记录写清楚，不需要一开始就做得很复杂。',
    sections: [
      {
        title: '基础记录项',
        bullets: [
          '观察时间',
          '观察地点',
          '天气和环境',
          '看到的鸟',
          '数量',
          '行为',
          '是否拍到照片或视频',
          '自己不确定的问题',
        ],
      },
      {
        title: '可直接使用的记录句式',
        bullets: [
          '今天在____，我观察到____只____。',
          '它们主要出现在____环境中。',
          '我看到的行为包括____。',
          '我还不确定的是____，下次想继续观察____。',
        ],
      },
      {
        title: '注意事项',
        bullets: [
          '不要为了写记录而错过观察本身。',
          '不确定的内容可以明确写“待确认”。',
          '比起写很多主观感受，先写清楚事实更重要。',
        ],
      },
    ],
  },
]

export const birdObservationResourceMap = Object.fromEntries(
  birdObservationResources.map((resource) => [resource.slug, resource]),
) as Record<string, BirdObservationResource>
