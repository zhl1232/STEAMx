/** 课件页统一按钮样式：圆角胶囊/圆形、半透明、同一高度（h-10）。 */
export const pill =
    "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue))]";
/** 普通背景上的次要按钮 */
export const pillQuiet = "bg-foreground/[0.06] text-foreground hover:bg-foreground/10";
/** 主按钮 */
export const pillPrimary = "bg-[hsl(var(--brand-blue))] text-white hover:brightness-110";
/** 叠在课件/3D 画面上的按钮（亮暗都看得清） */
export const pillGlass = "bg-background/80 text-foreground shadow-sm ring-1 ring-border/60 backdrop-blur-md hover:bg-background/90";
/** 叠在深色课件区上的按钮 */
export const pillOnDark = "bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-md hover:bg-black/60";
/** 只有图标的圆形按钮 */
export const circle = "w-10 px-0";
