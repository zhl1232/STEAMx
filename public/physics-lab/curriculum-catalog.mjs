import { EXPLORATIONS, TOPICS } from './exploration-model.mjs';
import { LESSONS } from './learning-model.mjs';

export const SCHOOL_STAGES = [
  { id: 'primary', name: '小学科学', description: '从声音、光、冷热、磁铁和简单电路出发，观察现象，试着只改变一个条件。' },
  { id: 'middle', name: '初中物理', description: '探究力学、声光热、电路、电功率与电磁现象，用测量和记录比较规律。' },
  { id: 'high', name: '高中物理', description: '进一步研究运动与相互作用、能量与动量、电场磁场、电磁感应、振动与波。' },
];

const aliases = {
  mixing: '热交换 热平衡 冷热变化', heating: '比热容 升温 热量',
  magnets: '指南针 磁铁 磁极 吸引 排斥', circuit: '简单电路 串联 并联 欧姆定律 电功率',
  optics: '镜面反射 凸透镜 凹透镜 焦距', field: '电场 场强 电势 库仑定律',
  induction: '电磁感应 法拉第定律 楞次定律', force: '牛顿第二定律 摩擦力',
  energy: '自由落体 能量 动能 重力势能 机械能守恒', collision: '动量守恒 弹性 非弹性 碰撞',
  'phase-change': '冰 熔化 沸腾 物态变化', projectile: '平抛 斜抛 抛体运动',
  'uniform-motion': '速度 路程 时间 匀速', 'accelerated-motion': '加速度 匀变速 运动图像',
  pendulum: '摆 周期 简谐运动', 'spring-energy': '弹簧振子 振动 简谐运动',
  hydrostatic: '液体压强 水压 大气压 绝对压强 表压', hydraulic: '液压 帕斯卡定律',
  'electric-power': '焦耳定律 电功 电热 电能', electromagnet: '电磁铁 螺线管',
};

const normalize = value => String(value || '').normalize('NFKC').trim().toLowerCase();
export function filterExperiments({ stage = 'all', topic = 'all', query = '' } = {}) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return EXPLORATIONS.filter(experiment => {
    if (stage !== 'all' && !experiment.stages.includes(stage)) return false;
    if (topic !== 'all' && experiment.topic !== topic) return false;
    const subject = TOPICS.find(item => item.id === experiment.topic);
    const searchable = normalize([experiment.title, experiment.goal, experiment.question, experiment.formula,
      subject?.name, aliases[experiment.id], ...(experiment.keywords || [])].join(' '));
    return words.every(word => searchable.includes(word));
  }).sort((a, b) => TOPICS.findIndex(topic => topic.id === a.topic) - TOPICS.findIndex(topic => topic.id === b.topic));
}

// Task levels describe challenge difficulty. These explicit stage recommendations
// keep that separate from the school-stage filter used by the experiment catalog.
const circuitStages = {
  light: ['primary', 'middle', 'high'], switch: ['primary', 'middle', 'high'],
  voltage: ['primary', 'middle', 'high'], series: ['primary', 'middle', 'high'],
  parallel: ['primary', 'middle', 'high'], repair: ['primary', 'middle', 'high'],
  ohm_u: ['middle', 'high'], ohm_r: ['middle', 'high'],
  series_r: ['middle', 'high'], parallel_r: ['middle', 'high'],
  power_u: ['middle', 'high'], power_r: ['middle', 'high'],
  divider: ['high'], loaded_divider: ['high'], current_split: ['high'],
  mixed: ['high'], network_power: ['high'], max_power: ['high'],
};
const circuitAliases = {
  ohm_u: '欧姆定律 电压 电流 正比例', ohm_r: '欧姆定律 电阻 电流 反比例',
  series_r: '等效电阻 串联', parallel_r: '等效电阻 并联',
  power_u: '电功率 电压', power_r: '电功率 电阻',
  current_split: '分流 节点电流守恒', max_power: '内阻 最大功率',
};

export function filterCircuitLessons({ stage = 'all', topic = 'all', query = '', includeAll = false } = {}) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  // A task remains a guided activity, even when it shares the same directory.
  if ((!words.length && !includeAll) || !['all', 'electric'].includes(topic)) return [];
  return LESSONS.filter(lesson => {
    if (stage !== 'all' && !circuitStages[lesson.id]?.includes(stage)) return false;
    const searchable = normalize([lesson.title, lesson.goal, lesson.question, lesson.steps,
      circuitAliases[lesson.id], ...lesson.hints].join(' '));
    return words.every(word => searchable.includes(word));
  });
}
