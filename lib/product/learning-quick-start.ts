import type { LearningTopicSlug } from '@/lib/seo/learning-topics'

/** 只概括已有指南，不推断课程的年龄、用时、难度或套装兼容性。 */
export const LEARNING_QUICK_START = {
  blocks: {
    summary: '挑一个想搭的作品，先核对零件，再跟着步骤一起搭。',
    materials: '已有积木、平整桌面；选课后核对该课时的零件清单。',
    safety: '由成人按孩子的使用能力选择零件并陪伴；不要把小零件放入口中。',
    steps: ['搭两面矮墙，一面接缝对齐，一面错开接缝。', '保持积木数量、高度和厚度一致，用相近的力轻推，比较哪里松动。', '只加宽底座，再试一次，看看连接和倾倒有什么不同。'],
    action: '挑一个积木作品',
    directActivity: false,
  },
  scratch: {
    summary: '先让一个角色动起来，再加一句话或一个按键。',
    materials: '优先用有鼠标和键盘的电脑；手机可先看课程步骤。',
    safety: '先运行一个小动作，再增加玩法；不需要提前记住所有积木。',
    steps: ['选择一个角色，用开始事件连接移动和说话积木。', '运行一次，看看角色是否按预想行动。', '改成按键触发，再运行比较。'],
    action: '选择 Scratch 课程',
    directActivity: false,
  },
  science: {
    summary: '从下面选一个科学项目，先看材料和步骤，再和孩子一起试。',
    materials: '按所选项目的材料清单准备，先确认手边的材料和操作空间。',
    safety: '成人陪伴；涉及加热、用电、锋利工具或化学材料时，先核对要求，由成人承担相应操作。',
    steps: ['选一个项目，打开详情核对材料和操作要求。', '跟着项目步骤尝试，记录观察到的变化。', '对照记录说出发现，再决定下一次想验证什么。'],
    action: '选择一个科学项目',
    directActivity: false,
  },
  nature: {
    summary: '找一棵容易再找到的树，看看它今天是什么样子。',
    materials: '熟悉且允许停留的安全地点；纸笔或手机可选，不必先买设备。',
    safety: '孩子由成人陪同，留在安全步道；不追赶、不投喂、不采摘，不触碰或品尝不认识的生物，不靠近巢穴。',
    steps: ['从安全的位置看叶片、花或果实，说出一处细节。', '画下来或拍张照片，记下时间、地点和一句发现。', '过几天回到同一位置，看看有什么变化。'],
    action: '开始这次观察',
    directActivity: true,
  },
} satisfies Record<LearningTopicSlug, {
  summary: string
  materials: string
  safety: string
  steps: [string, string, string]
  action: string
  directActivity: boolean
}>
