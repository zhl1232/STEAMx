/** 首页 / 探索页：移动端两列竖版项目卡网格 */
export const COMPACT_VERTICAL_PROJECT_GRID_CLASS =
  "grid grid-cols-2 auto-rows-fr items-stretch gap-2 md:gap-3 min-[1480px]:grid-cols-3";

export const COMPACT_VERTICAL_PROJECT_CARD_CLASS =
  "h-full max-md:[&>div]:rounded-[14px] max-md:[&>div>div:last-child]:gap-1.5 max-md:[&>div>div:last-child]:p-2.5";

/** Explore cards use container width so embedded rails and the main list share one layout contract. */
export const EXPLORE_PROJECT_GRID_CLASS =
  "grid grid-cols-1 auto-rows-fr items-stretch gap-2.5 md:grid-cols-2 md:gap-3 @min-[48rem]:grid-cols-3 @min-[72rem]:grid-cols-4";

/** 手机端：参考图 C 左图右字列表卡——中性浅边框、去阴影。电脑端保持原竖卡。 */
export const EXPLORE_PROJECT_CARD_CLASS =
  "h-full max-md:hover:translate-y-0! max-md:[&>div]:rounded-[14px] max-md:[&>div]:border-[#e2e7ee] max-md:[&>div]:bg-white max-md:[&>div]:shadow-none max-md:dark:[&>div]:border-white/[0.12] max-md:dark:[&>div]:bg-white/[0.04]";
