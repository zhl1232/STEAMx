import type { Project, ProjectFaqItem } from '@/lib/mappers/types'
import { effectiveUpdatedAt } from './effective-updated-at'

export const LED_CARD_REFERENCE_NOTE = '开合行程、接触稳定性和亮度尚未实物验证，需按所用材料试装调整。'
export const LED_CARD_REFERENCES = [
  { label: '开合联动滑片原理（英文，可选）', href: 'https://chibitronics.com/rainbow-pop-up-card/' },
  { label: '纸条铰接滑动开关（英文，第 65 页，可选）', href: 'https://citytechnology.org/wp-content/uploads/2024/05/ElectroCity.pdf#page=65' },
] as const

const faq: ProjectFaqItem[] = [
  {
    question: '打开后不亮？',
    answer: '① 看铜桥是否同时碰到 A、B；② 核对 LED 与电池座正负极；③ 检查电阻和引线接头是否压紧。按顺序一次改一处。',
  },
  {
    question: '合上后仍然亮？',
    answer: '① 看铜桥是否完全退到空白区；② 调整铜桥位置或缩短铜桥；③ 检查 A、B 之间是否被多余铜箔连通。',
  },
  {
    question: '时亮时不亮？',
    answer: '① 调整纸滑道，让铜桥轻贴触点且能顺畅移动；② 压牢松动接头；③ 再连续开合检查。若必须手压才亮，继续调整接触。',
  },
]

/** Project 149 public copy only; retain source identity and use the generated cover. */
export function applyLedCardContent(project: Project): Project {
  if (Number(project.id) !== 149) return project
  return {
    ...project,
    updatedAt: effectiveUpdatedAt(project),
    image: '/projects/generated/project-0149-led-star-cover-20261008.webp',
    description: '用铜箔、LED 和纽扣电池做一张打开会亮、合上会灭的贺卡，把亲手制作的祝福送给家人朋友。',
    videoUrl: null,
    materials: [
      '对折卡纸、装饰纸',
      '导电背胶铜箔胶带（铺线路、触点和滑片铜桥）',
      '红色 LED 1 颗',
      '330 Ω 电阻 1 只',
      'CR2032 3 V 电池 1 颗',
      '薄型 CR2032 封闭电池座 1 个（正负引线、螺钉固定盖、须工具开启）',
      '硬卡纸条（做拉条和两条纸滑道）',
      '透明胶带（固定接头、滑道和电池座）',
      '剪刀、尺、铅笔、彩笔；适配电池仓的螺丝刀',
    ],
    steps: [
      {
        title: '画图案',
        image_url: '/projects/steps/project-0149-design-blue-20261008.webp',
        description: '把卡纸对折，画好图案，选一个位置让 LED 发光。电路和电池座留在右页，折痕旁留出开关活动的位置。',
      },
      {
        title: '贴电路',
        image_url: '/projects/steps/project-0149-copper-blue-20261008.webp',
        description: '先不装电池，按下方顺序贴铜箔，线路不要交叉。开关处留两个互不相连的触点 A、B，再给电阻和 LED 各留一个断口。',
        checkpoint: '电池＋ → A → 铜桥 → B → 330 Ω → LED＋ → LED− → 电池−',
      },
      {
        title: '装灯',
        image_url: '/projects/steps/project-0149-led-blue-20261008.webp',
        description: '把 LED 放到图案的发光位置，长脚接正极（以器件标记为准）。让 LED、电阻和电池座引线分别接到对应铜箔上，金属贴住铜面，再用透明胶带压牢。电阻两端不要另铺铜箔。',
      },
      {
        title: '做开关',
        image_url: '/assets/projects/led-card-slider.svg',
        description: '把硬纸条左端用胶带铰接在左页，接点能转动；右段穿过右页两条纸盖条下，盖条只粘两端。\n不装电池，开合并标出纸条的两个位置，再在底面贴铜桥：打开同时碰到 A、B，合上完全退开。\n调整条长和盖条松紧，让纸条轻贴触点、随封面顺畅往返，不用手推拉。',
      },
      {
        title: '测试装饰',
        image_url: '/projects/steps/project-0149-decorate-blue-20261008.webp',
        description: '把电池座固定在右页边缘、遮住裸接头，装电池并锁紧仓盖后测试开合。用装饰纸盖住线路，留出滑道和电池仓螺钉的位置，再试一次。电池由成人保管与装卸，调整前取出；发热立即停用，不叠放或改用可充电电池。',
        checkpoint: '打开：持续亮；合上：熄灭；不用手压。',
      },
    ],
    problem_statement: '怎样让收卡的人一打开贺卡，祝福图案就亮起来，合上又自动熄灭？',
    reflection: '请收卡的人试着开合贺卡，看看灯能否稳定亮灭。',
    faq: faq.map(item => ({ ...item })),
  }
}
