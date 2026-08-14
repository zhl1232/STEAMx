import type { StudentProfileSnapshot, TutorGlobalSurface, TutorGreeting, TutorSceneContext } from '@/lib/ai/tutor/types'

const CHALLENGE_QUICK_PROMPTS: Record<string, string[]> = {
  observe: ['这步我该观察什么？', '怎么把观察写清楚？', '我还缺哪些信息？'],
  design: ['方案怎么选更好？', '我的设计合理吗？', '下一步先画什么？'],
  build_test: ['测试要注意什么？', '数据怎么记录？', '失败了怎么办？'],
  iterate: ['怎么改进更有效？', '取舍怎么说清楚？', '对比前后差异怎么写？'],
  generic: ['这步重点是什么？', '我卡住了怎么办？', '给我一个小动作'],
}

/** global 场景按页面定制开场白，避免「每个页面都说同一句话」 */
const GLOBAL_SURFACE_GREETINGS: Record<
  Exclude<TutorGlobalSurface, 'home'>,
  (name: string) => TutorGreeting
> = {
  explore: (name) => ({
    message: `嗨 ${name}！在找新项目呀～告诉我你想玩什么：科学实验、手工制作还是编程，我帮你挑一个合适的。`,
    quickPrompts: ['推荐一个适合我的项目', '有什么简单好上手的？', '我想做科学小实验'],
  }),
  nature: (name) => ({
    message: `你好 ${name}！我是小迪 🌿 想去认识身边的鸟、虫子还是大树？我可以教你怎么观察、怎么记录。`,
    quickPrompts: ['第一次观察从哪开始？', '怎么拍出能识别的照片？', '观察笔记怎么写？'],
  }),
  create: (name) => ({
    message: `嗨 ${name}！想接一个项目挑战，还是学一门技能课程？我帮你挑个合适的开始。`,
    quickPrompts: ['哪个挑战适合新手？', '项目挑战怎么玩？', '该先学哪门课？'],
  }),
  courses: (name) => ({
    message: `你好 ${name}！我是小迪 💻 想按课表系统学编程、搭建还是其他本领？挑一门技能课程开始吧。`,
    quickPrompts: ['新手该选哪门课？', 'Scratch 能做什么？', '学完能做出什么？'],
  }),
  community: (name) => ({
    message: `嗨 ${name}！想接一个项目挑战，还是学一门技能课程？我帮你挑个合适的开始。`,
    quickPrompts: ['哪个挑战适合新手？', '项目挑战怎么玩？', '该先学哪门课？'],
  }),
  playground: (name) => ({
    message: `你好呀 ${name}！游戏时间到～这些小游戏里都藏着数学和逻辑的小秘密，玩不过的可以来问我。`,
    quickPrompts: ['2048 有什么技巧？', '数独入门教教我', '五子棋怎么布局？'],
  }),
  profile: (name) => ({
    message: `嗨 ${name}！这里是你的成长小天地，我可以陪你把本周探索计划走起来。`,
    quickPrompts: ['带我看看本周计划', '先做哪一步？', '我的薄弱项怎么练？'],
  }),
  users: (name) => ({
    message: `你好 ${name}！在看同学的主页呀～看到喜欢的作品，自己也可以动手试一个。`,
    quickPrompts: ['我也想做类似的作品', '帮我找同款项目', '怎么向他学习？'],
  }),
}

export function buildTutorGreeting(
  profile: StudentProfileSnapshot,
  scene: TutorSceneContext,
): TutorGreeting {
  const name = profile.displayName

  if (scene.contextType === 'challenge' && scene.stageIndex != null) {
    const kind = scene.stageKind ?? 'generic'
    const prompts = CHALLENGE_QUICK_PROMPTS[kind] ?? CHALLENGE_QUICK_PROMPTS.generic
    return {
      message: `你好呀 ${name}！我是小迪 👋 正在陪你做「${scene.title}」。我记得你各阶段的产出，可以从下面挑一个问题，或者说「带我开始这一步」。`,
      quickPrompts: prompts.slice(0, 3),
    }
  }

  if (scene.contextType === 'project') {
    return {
      message: `嗨 ${name}！我是小迪～ 你在看《${scene.title}》。想从哪一步开始？我可以帮你理清思路、拆解材料。`,
      quickPrompts: ['这个项目难在哪？', '第一步该做什么？', '材料都准备好了吗？'],
    }
  }

  if (scene.contextType === 'observation') {
    return {
      message: `你好 ${name}！我是小迪 🌿 这条观察记录我可以帮你看：怎么描述特征、怎么写观察笔记。`,
      quickPrompts: ['怎么描述这个物种？', '观察笔记怎么写？', '我还该记录什么？'],
    }
  }

  if (scene.contextType === 'species') {
    return {
      message: `你好 ${name}！我是小迪 🌿 你现在在看「${scene.title}」的物种档案。我可以帮你认特征、找观察点、写观察笔记。`,
      quickPrompts: ['怎么认出它？', '什么时候最容易看到？', '观察笔记怎么写？'],
    }
  }

  if (scene.contextType === 'course') {
    return {
      message: `你好 ${name}！我是小迪 💻 「${scene.title}」里有不懂的 Scratch 步骤都可以问我。`,
      quickPrompts: ['这课卡在哪一步？', '帮我理一下思路', '下一步该做什么？'],
    }
  }

  // global：先按页面给针对性开场白，首页再走个性化兜底
  if (scene.surface && scene.surface !== 'home') {
    const build = GLOBAL_SURFACE_GREETINGS[scene.surface]
    if (build) return build(name)
  }

  if (profile.recentActivity.includes('探索中')) {
    return {
      message: `你好 ${name}！我是小迪 👋 看起来你有项目在进行中。想继续探索，还是找新的方向？`,
      quickPrompts: ['我该继续哪个项目？', '帮我补短板', '推荐一个适合我的'],
    }
  }

  if (profile.radarSummary && profile.text.includes('相对薄弱')) {
    return {
      message: `嗨 ${name}！我是小迪～ 根据你的 STEAM 雷达，我可以帮你找适合补短板的项目。`,
      quickPrompts: ['我的薄弱项怎么练？', '推荐一个入门项目', '今天做什么好？'],
    }
  }

  return {
    message: `你好呀 ${name}！我是小迪 👋 史迪姆平台的 AI 学习导师。探索、项目挑战、自然观察、技能课程，我都能陪你。`,
    quickPrompts: ['今天做什么好？', '帮我找个项目', '我该怎么开始？'],
  }
}

export function buildStartStagePrompt(stageTitle: string) {
  return `带我开始「${stageTitle}」这一步：先用一两句话说清这步的重点，再给我第一个可以马上做的小动作。`
}
