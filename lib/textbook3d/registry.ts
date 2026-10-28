/**
 * 3D 物理课本课目登记表。
 *
 * 加新课：先在课本源码目录用 tools/build_split.py 构建，
 * 在这里追加一条，再运行 `node scripts/textbook3d/sync.mjs <dist-split 目录>` 复制静态文件。
 * 详见 docs/textbook3d.md。
 */

/** 静态包版本目录；只在嵌入协议不兼容时升级为 v2，旧版本保留不覆盖。 */
export const TEXTBOOK3D_VERSION = "v1"

/**
 * 共享运行时（three + 模板，带哈希的 JS）和字体的基址，构建时写进每课 HTML。
 * 以后挪到 OSS/CDN：改这里，并用同一个值设 TEXTBOOK3D_ASSET_BASE 重新构建、同步（CDN 需开 CORS）。
 */
export const TEXTBOOK3D_SHARED_BASE = `/textbook3d/${TEXTBOOK3D_VERSION}/shared/`

export type Textbook3dLesson = {
  /** 课号，与静态目录同名，例如 g8a-1-1 = 八年级上册第 1 章第 1 节 */
  id: string
  /** 节标题 */
  title: string
}

export type Textbook3dChapter = {
  id: string
  /** 册次，例如「八年级上册」 */
  volume: string
  /** 章标题，例如「第一章 机械运动」 */
  title: string
  lessons: Textbook3dLesson[]
}

export const TEXTBOOK3D_CHAPTERS: Textbook3dChapter[] = [
  {
    id: "g8a-1",
    volume: "八年级上册",
    title: "第一章　机械运动",
    lessons: [
      { id: "g8a-1-1", title: "长度和时间的测量" },
      { id: "g8a-1-2", title: "运动的描述" },
      { id: "g8a-1-3", title: "运动的快慢" },
      { id: "g8a-1-4", title: "速度的测量" },
    ],
  },
  {
    id: "g8a-2",
    volume: "八年级上册",
    title: "第二章　声现象",
    lessons: [
      { id: "g8a-2-1", title: "声音的产生与传播" },
      { id: "g8a-2-2", title: "声音的特性" },
      { id: "g8a-2-3", title: "声的利用" },
      { id: "g8a-2-4", title: "噪声的危害和控制" },
      { id: "g8a-2-5", title: "跨学科实践：制作隔音房间模型" },
    ],
  },
  {
    id: "g8a-3",
    volume: "八年级上册",
    title: "第三章　物态变化",
    lessons: [
      { id: "g8a-3-1", title: "温度" },
      { id: "g8a-3-2", title: "熔化和凝固" },
      { id: "g8a-3-3", title: "汽化和液化" },
      { id: "g8a-3-4", title: "升华和凝华" },
      { id: "g8a-3-5", title: "跨学科实践：探索厨房中的物态变化问题" },
    ],
  },
  {
    id: "g8a-4",
    volume: "八年级上册",
    title: "第四章　光现象",
    lessons: [
      { id: "g8a-4-1", title: "光的直线传播" },
      { id: "g8a-4-2", title: "光的反射" },
      { id: "g8a-4-3", title: "平面镜成像" },
      { id: "g8a-4-4", title: "光的折射" },
      { id: "g8a-4-5", title: "光的色散" },
    ],
  },
  {
    id: "g8a-5",
    volume: "八年级上册",
    title: "第五章　透镜及其应用",
    lessons: [
      { id: "g8a-5-1", title: "透镜" },
      { id: "g8a-5-2", title: "生活中的透镜" },
      { id: "g8a-5-3", title: "凸透镜成像的规律" },
      { id: "g8a-5-4", title: "眼睛和眼镜" },
      { id: "g8a-5-5", title: "跨学科实践：制作望远镜" },
    ],
  },
  {
    id: "g8a-6",
    volume: "八年级上册",
    title: "第六章　质量与密度",
    lessons: [
      { id: "g8a-6-1", title: "质量" },
      { id: "g8a-6-2", title: "密度" },
      { id: "g8a-6-3", title: "测量液体和固体的密度" },
      { id: "g8a-6-4", title: "密度的应用" },
    ],
  },
  {
    id: "g8b-7",
    volume: "八年级下册",
    title: "第七章　力",
    lessons: [
      { id: "g8b-7-1", title: "力" },
      { id: "g8b-7-2", title: "弹力" },
      { id: "g8b-7-3", title: "重力" },
    ],
  },
  {
    id: "g8b-8",
    volume: "八年级下册",
    title: "第八章　运动和力",
    lessons: [
      { id: "g8b-8-1", title: "牛顿第一定律" },
      { id: "g8b-8-2", title: "二力平衡" },
      { id: "g8b-8-3", title: "摩擦力" },
      { id: "g8b-8-4", title: "同一直线上二力的合成" },
    ],
  },
  {
    id: "g8b-9",
    volume: "八年级下册",
    title: "第九章　压强",
    lessons: [
      { id: "g8b-9-1", title: "压强" },
      { id: "g8b-9-2", title: "液体的压强" },
      { id: "g8b-9-3", title: "大气压强" },
      { id: "g8b-9-4", title: "跨学科实践：制作简易活塞式抽水机" },
      { id: "g8b-9-5", title: "流体压强与流速的关系" },
    ],
  },
  {
    id: "g8b-10",
    volume: "八年级下册",
    title: "第十章　浮力",
    lessons: [
      { id: "g8b-10-1", title: "浮力" },
      { id: "g8b-10-2", title: "阿基米德原理" },
      { id: "g8b-10-3", title: "物体的浮沉条件及应用" },
      { id: "g8b-10-4", title: "跨学科实践：制作微型密度计" },
    ],
  },
  {
    id: "g8b-11",
    volume: "八年级下册",
    title: "第十一章　功和机械能",
    lessons: [
      { id: "g8b-11-1", title: "功" },
      { id: "g8b-11-2", title: "功率" },
      { id: "g8b-11-3", title: "动能和势能" },
      { id: "g8b-11-4", title: "机械能及其转化" },
    ],
  },
  {
    id: "g8b-12",
    volume: "八年级下册",
    title: "第十二章　简单机械",
    lessons: [
      { id: "g8b-12-1", title: "杠杆" },
      { id: "g8b-12-2", title: "跨学科实践：制作简易杆秤" },
      { id: "g8b-12-3", title: "滑轮" },
      { id: "g8b-12-4", title: "机械效率" },
    ],
  },
  {
    id: "g9-13",
    volume: "九年级全一册",
    title: "第十三章　内能",
    lessons: [
      { id: "g9-13-1", title: "热量 比热容" },
      { id: "g9-13-2", title: "分子动理论的初步知识" },
      { id: "g9-13-3", title: "内能" },
    ],
  },
  {
    id: "g9-14",
    volume: "九年级全一册",
    title: "第十四章　内能的利用",
    lessons: [
      { id: "g9-14-1", title: "能量的转化与守恒" },
      { id: "g9-14-2", title: "热机" },
      { id: "g9-14-3", title: "热机的效率" },
      { id: "g9-14-4", title: "跨学科实践：制作简易热机模型" },
    ],
  },
  {
    id: "g9-15",
    volume: "九年级全一册",
    title: "第十五章　电流和电路",
    lessons: [
      { id: "g9-15-1", title: "两种电荷" },
      { id: "g9-15-2", title: "电流和电路" },
      { id: "g9-15-3", title: "串联和并联" },
      { id: "g9-15-4", title: "电流的测量" },
      { id: "g9-15-5", title: "串、并联电路中电流的规律" },
    ],
  },
  {
    id: "g9-16",
    volume: "九年级全一册",
    title: "第十六章　电压　电阻",
    lessons: [
      { id: "g9-16-1", title: "电压" },
      { id: "g9-16-2", title: "串、并联电路中电压的规律" },
      { id: "g9-16-3", title: "电阻" },
      { id: "g9-16-4", title: "变阻器" },
      { id: "g9-16-5", title: "跨学科实践：制作简易调光台灯" },
    ],
  },
  {
    id: "g9-17",
    volume: "九年级全一册",
    title: "第十七章　欧姆定律",
    lessons: [
      { id: "g9-17-1", title: "电流与电压、电阻的关系" },
      { id: "g9-17-2", title: "欧姆定律" },
      { id: "g9-17-3", title: "电阻的测量" },
      { id: "g9-17-4", title: "欧姆定律在串、并联电路中的应用" },
    ],
  },
  {
    id: "g9-18",
    volume: "九年级全一册",
    title: "第十八章　电功率",
    lessons: [
      { id: "g9-18-1", title: "电能　电功" },
      { id: "g9-18-2", title: "电功率" },
      { id: "g9-18-3", title: "跨学科实践：为家庭节约用电提建议" },
      { id: "g9-18-4", title: "焦耳定律" },
    ],
  },
  {
    id: "g9-19",
    volume: "九年级全一册",
    title: "第十九章　生活用电",
    lessons: [
      { id: "g9-19-1", title: "安全用电" },
      { id: "g9-19-2", title: "家庭电路的基本组成" },
      { id: "g9-19-3", title: "跨学科实践：为家庭电路做设计" },
    ],
  },
  {
    id: "g9-20",
    volume: "九年级全一册",
    title: "第二十章　电与磁",
    lessons: [
      { id: "g9-20-1", title: "磁现象　磁场" },
      { id: "g9-20-2", title: "电生磁" },
      { id: "g9-20-3", title: "电磁铁　电磁继电器" },
      { id: "g9-20-4", title: "电动机" },
      { id: "g9-20-5", title: "跨学科实践：制作简易直流电动机" },
      { id: "g9-20-6", title: "磁生电" },
    ],
  },
  {
    id: "g9-21",
    volume: "九年级全一册",
    title: "第二十一章　电磁波及其应用",
    lessons: [
      { id: "g9-21-1", title: "电磁波的海洋" },
      { id: "g9-21-2", title: "广播、电视和移动通信" },
      { id: "g9-21-3", title: "卫星通信和光纤通信" },
    ],
  },
  {
    id: "g9-22",
    volume: "九年级全一册",
    title: "第二十二章　能源与可持续发展",
    lessons: [
      { id: "g9-22-1", title: "能源利用的现状和面临的挑战" },
      { id: "g9-22-2", title: "新能源的发展" },
      { id: "g9-22-3", title: "跨学科实践：为节约能源设计方案" },
    ],
  },
  {
    id: "p1a-1",
    volume: "一年级上册",
    title: "第一单元　周围的植物",
    lessons: [
      { id: "p1a-1-1", title: "我们知道的植物" },
      { id: "p1a-1-2", title: "观察植物" },
      { id: "p1a-1-3", title: "植物长在哪里" },
      { id: "p1a-1-4", title: "给植物画张\"像\"" },
      { id: "p1a-1-5", title: "植物的变化" },
      { id: "p1a-1-6", title: "校园里的植物" },
    ],
  },
  {
    id: "p1a-2",
    volume: "一年级上册",
    title: "第二单元　我们自己",
    lessons: [
      { id: "p1a-2-1", title: "我们的身体" },
      { id: "p1a-2-2", title: "发现生长" },
      { id: "p1a-2-3", title: "游戏中的观察" },
      { id: "p1a-2-4", title: "气味告诉我们" },
      { id: "p1a-2-5", title: "通过感官来发现" },
      { id: "p1a-2-6", title: "观察与比较" },
      { id: "p1a-2-7", title: "做个\"时间胶囊\"" },
    ],
  },
  {
    id: "p1b-1",
    volume: "一年级下册",
    title: "第一单元　身边的物体",
    lessons: [
      { id: "p1b-1-1", title: "观察物体的特征" },
      { id: "p1b-1-2", title: "给物体分类" },
      { id: "p1b-1-3", title: "比较物体的轻重" },
      { id: "p1b-1-4", title: "认识物体的形状" },
      { id: "p1b-1-5", title: "观察一杯水" },
      { id: "p1b-1-6", title: "哪个流动得快" },
      { id: "p1b-1-7", title: "它们去哪里了" },
    ],
  },
  {
    id: "p1b-2",
    volume: "一年级下册",
    title: "第二单元　常见的动物",
    lessons: [
      { id: "p1b-2-1", title: "我们周围的动物" },
      { id: "p1b-2-2", title: "观察一种动物" },
      { id: "p1b-2-3", title: "给蜗牛建个\"家\"" },
      { id: "p1b-2-4", title: "水中的动物" },
      { id: "p1b-2-5", title: "它们吃什么" },
      { id: "p1b-2-6", title: "动物联欢会" },
    ],
  },
  {
    id: "p2a-1",
    volume: "二年级上册",
    title: "第一单元　我们的地球家园",
    lessons: [
      { id: "p2a-1-1", title: "地球家园中有什么" },
      { id: "p2a-1-2", title: "土壤——动植物的乐园" },
      { id: "p2a-1-3", title: "太阳的位置和方向" },
      { id: "p2a-1-4", title: "观察月相" },
      { id: "p2a-1-5", title: "各种各样的天气" },
      { id: "p2a-1-6", title: "不同的季节" },
      { id: "p2a-1-7", title: "做大自然的孩子" },
    ],
  },
  {
    id: "p2a-2",
    volume: "二年级上册",
    title: "第二单元　材料",
    lessons: [
      { id: "p2a-2-1", title: "我们生活的世界" },
      { id: "p2a-2-2", title: "不同材料的餐具" },
      { id: "p2a-2-3", title: "书的历史" },
      { id: "p2a-2-4", title: "神奇的纸" },
      { id: "p2a-2-5", title: "椅子不简单" },
    ],
  },
  {
    id: "p2b-1",
    volume: "二年级下册",
    title: "第一单元　探秘恐龙",
    lessons: [
      { id: "p2b-1-1", title: "恐龙的故事" },
      { id: "p2b-1-2", title: "挖掘恐龙\"化石\"" },
      { id: "p2b-1-3", title: "测量恐龙\"化石\"" },
      { id: "p2b-1-4", title: "拼接恐龙\"化石\"" },
      { id: "p2b-1-5", title: "复原恐龙" },
      { id: "p2b-1-6", title: "制作恐龙模型" },
      { id: "p2b-1-7", title: "我们的恐龙公园" },
    ],
  },
  {
    id: "p2b-2",
    volume: "二年级下册",
    title: "第二单元　玩磁铁",
    lessons: [
      { id: "p2b-2-1", title: "磁铁能吸引什么" },
      { id: "p2b-2-2", title: "比较力量的大小" },
      { id: "p2b-2-3", title: "让小车动起来" },
      { id: "p2b-2-4", title: "隔物吸铁" },
      { id: "p2b-2-5", title: "设计钓鱼玩具" },
      { id: "p2b-2-6", title: "我们来钓鱼" },
    ],
  },
  {
    id: "p3a-1",
    volume: "三年级上册",
    title: "第一单元　天气",
    lessons: [
      { id: "p3a-1-1", title: "我们关心天气" },
      { id: "p3a-1-2", title: "认识气温计" },
      { id: "p3a-1-3", title: "测量气温" },
      { id: "p3a-1-4", title: "测量降水量" },
      { id: "p3a-1-5", title: "观测风" },
      { id: "p3a-1-6", title: "观察云" },
      { id: "p3a-1-7", title: "天气预报" },
      { id: "p3a-1-8", title: "天气的影响" },
    ],
  },
  {
    id: "p3a-2",
    volume: "三年级上册",
    title: "第二单元　水",
    lessons: [
      { id: "p3a-2-1", title: "水到哪里去了" },
      { id: "p3a-2-2", title: "水珠从哪里来" },
      { id: "p3a-2-3", title: "水沸腾了" },
      { id: "p3a-2-4", title: "水结冰了" },
      { id: "p3a-2-5", title: "冰熔化了" },
      { id: "p3a-2-6", title: "水能溶解多少物质" },
      { id: "p3a-2-7", title: "加快溶解" },
      { id: "p3a-2-8", title: "用水分离" },
    ],
  },
  {
    id: "p3a-3",
    volume: "三年级上册",
    title: "第三单元　物体的运动",
    lessons: [
      { id: "p3a-3-1", title: "运动和位置" },
      { id: "p3a-3-2", title: "各种各样的运动" },
      { id: "p3a-3-3", title: "直线运动和曲线运动" },
      { id: "p3a-3-4", title: "相同距离比快慢" },
      { id: "p3a-3-5", title: "相同时间比快慢" },
      { id: "p3a-3-6", title: "运动和能量" },
      { id: "p3a-3-7", title: "设计和制作\"过山车\"" },
      { id: "p3a-3-8", title: "测试\"过山车\"" },
    ],
  },
  {
    id: "p3b-1",
    volume: "三年级下册",
    title: "第一单元　辨别方向",
    lessons: [
      { id: "p3b-1-1", title: "根据太阳辨别方向" },
      { id: "p3b-1-2", title: "利用自然物辨别方向" },
      { id: "p3b-1-3", title: "利用磁铁辨别方向" },
      { id: "p3b-1-4", title: "磁极与方向" },
      { id: "p3b-1-5", title: "制作小磁针" },
      { id: "p3b-1-6", title: "设计指南针" },
      { id: "p3b-1-7", title: "制作指南针" },
      { id: "p3b-1-8", title: "用指南针\"寻宝\"" },
    ],
  },
  {
    id: "p3b-2",
    volume: "三年级下册",
    title: "第二单元　动物的一生",
    lessons: [
      { id: "p3b-2-1", title: "不同种类的动物" },
      { id: "p3b-2-2", title: "动物的繁殖" },
      { id: "p3b-2-3", title: "迎接蚕宝宝的到来" },
      { id: "p3b-2-4", title: "幼蚕在生长" },
      { id: "p3b-2-5", title: "蚕变了新模样" },
      { id: "p3b-2-6", title: "茧中钻出了蚕蛾" },
      { id: "p3b-2-7", title: "昆虫的一生" },
      { id: "p3b-2-8", title: "动物的生命周期" },
    ],
  },
  {
    id: "p3b-3",
    volume: "三年级下册",
    title: "第三单元　只有一个地球",
    lessons: [
      { id: "p3b-3-1", title: "地球是我们的家园" },
      { id: "p3b-3-2", title: "水的星球" },
      { id: "p3b-3-3", title: "地球的卫星" },
      { id: "p3b-3-4", title: "我们来造\"环形山\"" },
      { id: "p3b-3-5", title: "发光发热的太阳" },
      { id: "p3b-3-6", title: "一天中影子的变化" },
      { id: "p3b-3-7", title: "地球的\"兄弟姐妹\"" },
      { id: "p3b-3-8", title: "制作地球科普海报" },
    ],
  },
  {
    id: "p4a-1",
    volume: "四年级上册",
    title: "第一单元　空气",
    lessons: [
      { id: "p4a-1-1", title: "感受空气" },
      { id: "p4a-1-2", title: "空气能占据空间吗" },
      { id: "p4a-1-3", title: "空气占据的空间会改变吗" },
      { id: "p4a-1-4", title: "空气有质量吗" },
      { id: "p4a-1-5", title: "空气流动有力量" },
      { id: "p4a-1-6", title: "我们来做\"热气球\"" },
      { id: "p4a-1-7", title: "风的成因" },
      { id: "p4a-1-8", title: "自制打气筒" },
    ],
  },
  {
    id: "p4a-2",
    volume: "四年级上册",
    title: "第二单元　呼吸与消化",
    lessons: [
      { id: "p4a-2-1", title: "我们的呼吸与消化" },
      { id: "p4a-2-2", title: "认识呼吸器官" },
      { id: "p4a-2-3", title: "呼吸的变化" },
      { id: "p4a-2-4", title: "测量肺活量" },
      { id: "p4a-2-5", title: "口腔里的消化" },
      { id: "p4a-2-6", title: "胃和小肠里的消化" },
      { id: "p4a-2-7", title: "食物在身体里的旅行" },
      { id: "p4a-2-8", title: "呵护我们的器官" },
    ],
  },
  {
    id: "p4a-3",
    volume: "四年级上册",
    title: "第三单元　声音",
    lessons: [
      { id: "p4a-3-1", title: "声音是怎样产生的" },
      { id: "p4a-3-2", title: "声音的强弱" },
      { id: "p4a-3-3", title: "声音的高低" },
      { id: "p4a-3-4", title: "乐器的声音变化" },
      { id: "p4a-3-5", title: "设计我们的乐器" },
      { id: "p4a-3-6", title: "改进我们的乐器" },
      { id: "p4a-3-7", title: "声音的传播" },
      { id: "p4a-3-8", title: "保护听力" },
    ],
  },
  {
    id: "p4b-1",
    volume: "四年级下册",
    title: "第一单元　植物的生长变化",
    lessons: [
      { id: "p4b-1-1", title: "种子里孕育着新生命" },
      { id: "p4b-1-2", title: "种植凤仙花" },
      { id: "p4b-1-3", title: "种子长出了根" },
      { id: "p4b-1-4", title: "茎和叶" },
      { id: "p4b-1-5", title: "凤仙花开花了" },
      { id: "p4b-1-6", title: "果实和种子" },
      { id: "p4b-1-7", title: "种子的传播" },
      { id: "p4b-1-8", title: "凤仙花的一生" },
    ],
  },
  {
    id: "p4b-2",
    volume: "四年级下册",
    title: "第二单元　电路",
    lessons: [
      { id: "p4b-2-1", title: "电和我们的生活" },
      { id: "p4b-2-2", title: "点亮小灯泡" },
      { id: "p4b-2-3", title: "简易电路" },
      { id: "p4b-2-4", title: "电路出故障了" },
      { id: "p4b-2-5", title: "里面是怎样连接的" },
      { id: "p4b-2-6", title: "导体和绝缘体" },
      { id: "p4b-2-7", title: "电路中的开关" },
      { id: "p4b-2-8", title: "模拟安装照明电路" },
    ],
  },
  {
    id: "p4b-3",
    volume: "四年级下册",
    title: "第三单元　岩石与土壤",
    lessons: [
      { id: "p4b-3-1", title: "岩石与土壤的故事" },
      { id: "p4b-3-2", title: "认识几种常见的岩石" },
      { id: "p4b-3-3", title: "岩石的组成" },
      { id: "p4b-3-4", title: "制作岩石和矿物标本" },
      { id: "p4b-3-5", title: "岩石、沙和黏土" },
      { id: "p4b-3-6", title: "观察土壤" },
      { id: "p4b-3-7", title: "比较不同的土壤" },
      { id: "p4b-3-8", title: "岩石、土壤和我们" },
    ],
  },
  {
    id: "p5a-1",
    volume: "五年级上册",
    title: "第一单元　微小世界",
    lessons: [
      { id: "p5a-1-1", title: "研究放大镜" },
      { id: "p5a-1-2", title: "怎样放得更大" },
      { id: "p5a-1-3", title: "用简易显微镜观察" },
      { id: "p5a-1-4", title: "用光学显微镜观察" },
      { id: "p5a-1-5", title: "观察细胞" },
      { id: "p5a-1-6", title: "观察水中的微小生物" },
      { id: "p5a-1-7", title: "微生物与人类" },
    ],
  },
  {
    id: "p5a-2",
    volume: "五年级上册",
    title: "第二单元　工具与技术",
    lessons: [
      { id: "p5a-2-1", title: "各种各样的工具" },
      { id: "p5a-2-2", title: "独轮车省力的秘密" },
      { id: "p5a-2-3", title: "制作独轮车" },
      { id: "p5a-2-4", title: "巧用斜面" },
      { id: "p5a-2-5", title: "妙用滑轮" },
      { id: "p5a-2-6", title: "给小车安装方向盘" },
      { id: "p5a-2-7", title: "社会发展与工具和技术" },
    ],
  },
  {
    id: "p5a-3",
    volume: "五年级上册",
    title: "第三单元　运动和力",
    lessons: [
      { id: "p5a-3-1", title: "拆解我的小车模型" },
      { id: "p5a-3-2", title: "用重物驱动小车" },
      { id: "p5a-3-3", title: "用弹力驱动小车" },
      { id: "p5a-3-4", title: "测量力的大小" },
      { id: "p5a-3-5", title: "摩擦力的比较" },
      { id: "p5a-3-6", title: "制作“月球小车”" },
      { id: "p5a-3-7", title: "评价“月球小车”" },
    ],
  },
  {
    id: "p5a-4",
    volume: "五年级上册",
    title: "第四单元　地球表面的变化",
    lessons: [
      { id: "p5a-4-1", title: "地球的表面" },
      { id: "p5a-4-2", title: "火山喷发对地表的作用" },
      { id: "p5a-4-3", title: "地震对地表的作用" },
      { id: "p5a-4-4", title: "地球表面的岩石" },
      { id: "p5a-4-5", title: "岩石的类别与变化" },
      { id: "p5a-4-6", title: "水对地表的作用" },
      { id: "p5a-4-7", title: "风对地表的作用" },
    ],
  },
  {
    id: "p5b-1",
    volume: "五年级下册",
    title: "第一单元　生物与环境",
    lessons: [
      { id: "p5b-1-1", title: "种子发芽实验" },
      { id: "p5b-1-2", title: "比较种子发芽实验" },
      { id: "p5b-1-3", title: "绿豆苗的生长" },
      { id: "p5b-1-4", title: "蚯蚓的选择" },
      { id: "p5b-1-5", title: "当环境改变了" },
      { id: "p5b-1-6", title: "食物链和食物网" },
      { id: "p5b-1-7", title: "设计和制作生态瓶" },
    ],
  },
  {
    id: "p5b-2",
    volume: "五年级下册",
    title: "第二单元　船的研究",
    lessons: [
      { id: "p5b-2-1", title: "船的历史" },
      { id: "p5b-2-2", title: "用浮的材料造船" },
      { id: "p5b-2-3", title: "用沉的材料造船" },
      { id: "p5b-2-4", title: "增加船的载重量" },
      { id: "p5b-2-5", title: "给船装上动力" },
      { id: "p5b-2-6", title: "设计我们的小船" },
      { id: "p5b-2-7", title: "制作与测试我们的小船" },
    ],
  },
  {
    id: "p5b-3",
    volume: "五年级下册",
    title: "第三单元　环境与我们",
    lessons: [
      { id: "p5b-3-1", title: "地球——宇宙的奇迹" },
      { id: "p5b-3-2", title: "我们面临的环境问题" },
      { id: "p5b-3-3", title: "珍惜水资源" },
      { id: "p5b-3-4", title: "解决垃圾问题" },
      { id: "p5b-3-5", title: "合理利用能源" },
      { id: "p5b-3-6", title: "让资源再生" },
      { id: "p5b-3-7", title: "分析一个实际的环境问题" },
    ],
  },
  {
    id: "p5b-4",
    volume: "五年级下册",
    title: "第四单元　热",
    lessons: [
      { id: "p5b-4-1", title: "温度与水的变化" },
      { id: "p5b-4-2", title: "水的蒸发和凝结" },
      { id: "p5b-4-3", title: "温度不同的物体相互接触" },
      { id: "p5b-4-4", title: "热在金属中的传递" },
      { id: "p5b-4-5", title: "热在水中的传递" },
      { id: "p5b-4-6", title: "哪个传热快" },
      { id: "p5b-4-7", title: "做个保温杯" },
    ],
  },
  {
    id: "p6a-1",
    volume: "六年级上册",
    title: "第一单元　健康生活",
    lessons: [
      { id: "p6a-1-1", title: "生长发育的信息" },
      { id: "p6a-1-2", title: "食物中的营养" },
      { id: "p6a-1-3", title: "营养要均衡" },
      { id: "p6a-1-4", title: "身体的“总指挥”" },
      { id: "p6a-1-5", title: "睡眠要充足" },
      { id: "p6a-1-6", title: "管理我们的情绪" },
      { id: "p6a-1-7", title: "制订健康生活计划" },
    ],
  },
  {
    id: "p6a-2",
    volume: "六年级上册",
    title: "第二单元　光",
    lessons: [
      { id: "p6a-2-1", title: "怎样能看到物体" },
      { id: "p6a-2-2", title: "光是怎样传播的" },
      { id: "p6a-2-3", title: "光能穿透物体吗" },
      { id: "p6a-2-4", title: "光的反射现象" },
      { id: "p6a-2-5", title: "设计潜望镜" },
      { id: "p6a-2-6", title: "制作潜望镜" },
      { id: "p6a-2-7", title: "制造彩虹" },
    ],
  },
  {
    id: "p6a-3",
    volume: "六年级上册",
    title: "第三单元　地球的运动",
    lessons: [
      { id: "p6a-3-1", title: "利用地球模型来研究" },
      { id: "p6a-3-2", title: "昼夜交替的解释" },
      { id: "p6a-3-3", title: "地球如何自转" },
      { id: "p6a-3-4", title: "哪里先迎来黎明" },
      { id: "p6a-3-5", title: "影长的四季变化" },
      { id: "p6a-3-6", title: "地球的公转" },
      { id: "p6a-3-7", title: "四季变化" },
    ],
  },
  {
    id: "p6a-4",
    volume: "六年级上册",
    title: "第四单元　计量时间",
    lessons: [
      { id: "p6a-4-1", title: "时间在流逝" },
      { id: "p6a-4-2", title: "用水计量时间" },
      { id: "p6a-4-3", title: "做个水钟" },
      { id: "p6a-4-4", title: "改进水钟" },
      { id: "p6a-4-5", title: "机械摆钟" },
      { id: "p6a-4-6", title: "制作钟摆" },
      { id: "p6a-4-7", title: "时间与变化" },
    ],
  },
  {
    id: "p6b-1",
    volume: "六年级下册",
    title: "第一单元　小小工程师",
    lessons: [
      { id: "p6b-1-1", title: "了解我们的住房" },
      { id: "p6b-1-2", title: "认识工程" },
      { id: "p6b-1-3", title: "建造塔台" },
      { id: "p6b-1-4", title: "设计塔台模型" },
      { id: "p6b-1-5", title: "制作塔台模型" },
      { id: "p6b-1-6", title: "测试塔台模型" },
      { id: "p6b-1-7", title: "评估改进塔台模型" },
    ],
  },
  {
    id: "p6b-2",
    volume: "六年级下册",
    title: "第二单元　生物的多样性",
    lessons: [
      { id: "p6b-2-1", title: "校园生物大搜索" },
      { id: "p6b-2-2", title: "制作校园生物分布图" },
      { id: "p6b-2-3", title: "形形色色的植物" },
      { id: "p6b-2-4", title: "多种多样的动物" },
      { id: "p6b-2-5", title: "相貌各异的我们" },
      { id: "p6b-2-6", title: "古代生物的多样性" },
      { id: "p6b-2-7", title: "保护生物多样性" },
    ],
  },
  {
    id: "p6b-3",
    volume: "六年级下册",
    title: "第三单元　宇宙",
    lessons: [
      { id: "p6b-3-1", title: "太阳系大家庭" },
      { id: "p6b-3-2", title: "八颗行星" },
      { id: "p6b-3-3", title: "日食" },
      { id: "p6b-3-4", title: "认识星座" },
      { id: "p6b-3-5", title: "夏季星空" },
      { id: "p6b-3-6", title: "浩瀚的宇宙" },
      { id: "p6b-3-7", title: "探索宇宙" },
    ],
  },
  {
    id: "p6b-4",
    volume: "六年级下册",
    title: "第四单元　物质的变化",
    lessons: [
      { id: "p6b-4-1", title: "厨房里的物质与变化" },
      { id: "p6b-4-2", title: "产生气体的变化" },
      { id: "p6b-4-3", title: "发现变化中的新物质" },
      { id: "p6b-4-4", title: "变化中伴随的现象" },
      { id: "p6b-4-5", title: "地球家园的化学变化" },
      { id: "p6b-4-6", title: "生命体中的化学变化" },
      { id: "p6b-4-7", title: "美丽的化学变化" },
    ],
  },
]

export const TEXTBOOK3D_LESSON_ID = /^(?:g8[ab]|g9|p[1-6][ab])-\d+-\d+$/

export function listTextbook3dLessons() {
  return TEXTBOOK3D_CHAPTERS.flatMap((chapter) =>
    chapter.lessons.map((lesson, index) => ({ ...lesson, chapter, number: index + 1 })),
  )
}

export function getTextbook3dLesson(id: string) {
  const lessons = listTextbook3dLessons()
  const index = lessons.findIndex((lesson) => lesson.id === id)
  if (index < 0) return null
  return { ...lessons[index], prev: lessons[index - 1] ?? null, next: lessons[index + 1] ?? null }
}

/** 同源静态包地址；只由登记表生成，不接受外部传入的 URL。 */
export function textbook3dSrc(id: string) {
  if (!TEXTBOOK3D_LESSON_ID.test(id)) throw new Error(`invalid textbook3d lesson id: ${id}`)
  return `/textbook3d/${TEXTBOOK3D_VERSION}/${id}/index.html?embed=1`
}

/** 只接受已登记的课号，其他一律返回 null。用于课程课时 content 和项目 interactive_url。 */
export function resolveTextbook3dLessonId(value: unknown): string | null {
  if (typeof value !== "string") return null
  return getTextbook3dLesson(value) ? value : null
}

/** 项目的 interactive_url 形如 /textbook3d/v1/<课号>/ 或 /textbook3d/v1/<课号>/index.html，解析出已登记的课号。 */
export function textbook3dLessonIdFromUrl(url: unknown): string | null {
  if (typeof url !== "string") return null
  const match = url.match(/^\/textbook3d\/v\d+\/((?:g8[ab]|g9|p[1-6][ab])-\d+-\d+)(?:\/(?:index\.html)?)?$/)
  return match ? resolveTextbook3dLessonId(match[1]) : null
}

