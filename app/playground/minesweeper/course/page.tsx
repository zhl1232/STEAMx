"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import { ChevronRight, ChevronLeft, BookOpen, Lightbulb } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { practicePuzzles } from "./lessons-data"
import { BoardIllustration } from "./lesson-figures"
import { PracticeBoard } from "./practice-board"

const LESSON_COUNT = 9

function buildLessons() {
  return [
    {
      title: "第 1 课：游戏目的与基本规则",
      phase: "上篇 图解扫雷入门",
      content: (
        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <p>欢迎来到《扫雷解局学》。我们要学习的，是如何像福尔摩斯一样，利用每一格提供的线索，通过纯粹的逻辑推理找出所有地雷。</p>

          <div className="bg-muted/30 p-5 rounded-2xl border border-border space-y-4">
            <h3 className="font-bold text-foreground text-base">数字的核心密码</h3>
            <p>扫雷里最重要的线索就是<strong>数字</strong>。每一个数字，都代表它<strong>周围一圈（最多8个）的方块里，到底藏着几颗雷。</strong></p>

            <div className="flex flex-col sm:flex-row gap-6 mt-4">
              <div className="flex-1 space-y-2">
                <div className="flex justify-center mb-2">
                  <BoardIllustration
                    grid={[
                      ["?", "?", "?"],
                      ["?", "1", "?"],
                      ["?", "?", "?"]
                    ]}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">数字在中间，被周围 <strong>8</strong> 个格子包围。这 8 个里面刚好有 1 颗雷。</p>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-center mb-2">
                  <BoardIllustration
                    grid={[
                      ["1", "?"],
                      ["?", "?"]
                    ]}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">数字在角落，周围只有 <strong>3</strong> 个格子了。这 3 个里面刚好有 1 颗雷。</p>
              </div>
            </div>
          </div>

          <div className="bg-primary/5 p-5 rounded-2xl border border-primary/20">
            <h3 className="font-bold text-primary text-base mb-2">操作小结</h3>
            <ul className="space-y-2 text-sm list-disc pl-4 marker:text-primary/50">
              <li><strong>左键：</strong> 挖开未知方块，如果是雷就爆炸，如果安全就会显示数字。</li>
              <li><strong>右键：</strong> 插上一面红旗 <span className="inline-block translate-y-[2px]">🚩</span>，表示你确信这里是雷（这是解题的辅助标记）。</li>
              <li><strong>同时双击左右键（最常用）：</strong> 当一个数字周围“插上的旗子数”已经满足它的数字时，双击它，它会<strong>一秒帮你挖开周围剩下所有的未知方块</strong>！</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "第 2 课：法则 一 与 法则 二",
      phase: "上篇 图解扫雷入门",
      content: (
        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <p>根据上面学的规则，我们很容易总结出新手扫雷的两条万能法则。用这两条法则，你就能通过很大一部分初级地图了。</p>

          <div className="bg-muted/30 p-5 rounded-2xl border border-border space-y-4">
            <h3 className="font-bold text-foreground text-base">法则 一：当 剩余空位 = 数字</h3>
            <p className="mb-2">如果你发现某个数字周围<strong>还没挖开的格子数量</strong>，恰好等于<strong>这个数字本身</strong>，那不用怀疑，这些剩下的格子全都是雷，赶紧插上红旗！</p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
              <BoardIllustration
                grid={[
                  ["0", "1", "1"],
                  ["1", "3", "?"],
                  ["1", "?", "?"]
                ]}
              />
              <div className="text-2xl text-muted-foreground">👉</div>
              <BoardIllustration
                grid={[
                  ["0", "1", "1"],
                  ["1", "3", "flag"],
                  ["1", "flag", "flag"]
                ]}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">图中的“3”，周围只剩下 3 个未知格。根据法则一，如果周围还没挖开的格子数恰好等于数字本身，那毫无疑问，它们全都是雷。</p>
          </div>

          <div className="bg-muted/30 p-5 rounded-2xl border border-border space-y-4">
            <h3 className="font-bold text-foreground text-base">法则 二：当 已标红旗 = 数字</h3>
            <p className="mb-2">如果某个数字周围，你已经插上了足够多正确的红旗（红旗数=数字），说明它周围的雷已经找齐了。那它周围剩下的未知格子绝对非常安全，闭着眼睛挖（或者双击）！</p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
              <BoardIllustration
                grid={[
                  ["0", "0", "0"],
                  ["1", "1", "?"],
                  ["flag", "?", "?"]
                ]}
              />
              <div className="text-2xl text-muted-foreground">👉</div>
              <BoardIllustration
                grid={[
                  ["0", "0", "0"],
                  ["1", "1", "safe"],
                  ["flag", "safe", "safe"]
                ]}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">图中的“1”，左下角已经标出了一面红旗。既然它的1颗雷找到了，剩下的带“?”的格子就全是安全的了。</p>
          </div>
        </div>
      )
    },
    {
      title: "第 3 课：把未知框起来（什么是集合）",
      phase: "中篇 核心技巧进阶",
      content: (
        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <p>遇到复杂情况时，一眼看不出哪里有雷，怎么办？从这里开始，我们引入一个超强的辅助工具：<strong>画圈圈（也就是集合的思维）</strong>。</p>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center my-6">
            <div className="flex flex-col items-center gap-2">
              <BoardIllustration
                grid={[
                  ["?", "safe", "safe"],
                  ["?", "3", "1"],
                  ["?", "?", "?"]
                ]}
                circles={[
                  { r: 1, c: 1, color: "border-red-500" }
                ]}
                highlights={[
                  { r: 0, c: 0, bg: "bg-red-500/20" },
                  { r: 1, c: 0, bg: "bg-red-500/20" },
                  { r: 2, c: 0, bg: "bg-red-500/20" },
                  { r: 2, c: 1, bg: "bg-red-500/20" },
                  { r: 2, c: 2, bg: "bg-red-500/20" }
                ]}
              />
              <span className="text-xs font-bold text-red-500">红圈(3) 管辖 5个未知</span>
            </div>

            <div className="text-2xl text-muted-foreground font-light px-2">与</div>

            <div className="flex flex-col items-center gap-2">
              <BoardIllustration
                grid={[
                  ["?", "safe", "safe"],
                  ["?", "3", "1"],
                  ["?", "?", "?"]
                ]}
                circles={[
                  { r: 1, c: 2, color: "border-green-500" }
                ]}
                highlights={[
                  { r: 2, c: 1, bg: "bg-green-500/20" },
                  { r: 2, c: 2, bg: "bg-green-500/20" }
                ]}
              />
              <span className="text-xs font-bold text-green-600">绿圈(1) 管辖 2个未知</span>
            </div>
          </div>

          <div className="space-y-3">
            <p>我们用颜色把数字<strong>周围所有的【未知格子】</strong>高亮出来，这就形成了一个个“集合”。把格子捆绑考虑，我们就能算出隐藏信息：</p>
            <ul className="space-y-2 list-disc pl-4 marker:text-muted-foreground">
              <li><span className="text-red-500 font-bold">红圈(3)</span>：由于中间是3，说明左图红色的 <strong>5个位置里，必定藏着 3 颗雷</strong>。</li>
              <li><span className="text-green-600 font-bold">绿圈(1)</span>：由于右边是1，说明右图绿色的 <strong>2个位置里，必定藏着 1 颗雷</strong>。</li>
            </ul>
            <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex gap-3 text-primary mt-4">
              <Lightbulb className="shrink-0 animate-pulse mt-0.5" />
              <div className="space-y-2">
                <p><strong>神奇的魔法出现了（当大圈包含小圈）：</strong></p>
                <p>仔细看！绿圈的2个位置，是不是完完全全属于红圈里的其中2个？这就叫<strong>【包含关系】</strong>。</p>
                <p>由于这2个重叠的格子里必定有 1 颗雷（因为绿圈说它有1颗），而红圈总共需要 3 颗雷；<strong>那另外的 2 颗雷去哪了？</strong> 当然只能在未重叠的地方！</p>
                <p>得出结论：最左边那一列红圈独有的 3 个问号里，刚好包含了剩下的 3-1 = <strong>2 颗雷</strong>！虽然现在还不能马上确定点开谁，但这就把雷的概率极大地缩小了。这就是整个高阶扫雷（大圈减小圈）的核心基础逻辑！</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "第 4 课：排除法（大圈减小圈求安全）",
      phase: "中篇 核心技巧进阶",
      content: (
        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <p>排除法是扫雷最基础的高级操作。如果 <strong>小圈被大圈完全包含，并且两个圈的【雷数相等】</strong>，那么大圈多长出来的那些方块，一定安全！</p>

          <div className="bg-muted/30 p-5 rounded-2xl border border-border">
            <h3 className="font-bold text-foreground text-base mb-4 text-center">基础边 11 排除</h3>
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
              <BoardIllustration
                grid={[
                  ["?", "?", "?"],
                  ["1", "1", "safe"]
                ]}
                circles={[
                  { r: 1, c: 0, color: "border-red-500" },
                  { r: 1, c: 1, color: "border-gray-800 dark:border-gray-500" }
                ]}
                highlights={[
                  { r: 0, c: 0, bg: "bg-red-500/20" },
                  { r: 0, c: 1, bg: "bg-red-500/20" },
                  { r: 0, c: 2, bg: "bg-gray-500/30" }
                ]}
              />
              <div className="text-2xl text-muted-foreground">👉</div>
              <BoardIllustration
                grid={[
                  ["?", "?", "safe"],
                  ["1", "1", "safe"]
                ]}
                circles={[
                  { r: 1, c: 0, color: "border-red-500" },
                  { r: 1, c: 1, color: "border-gray-800 dark:border-gray-500" }
                ]}
              />
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <p>看最常见的平边11，如上图：</p>
              <ul className="list-decimal pl-4 space-y-1">
                <li>由于左侧和下方是边界（或都是安全的已知区域），<span className="text-red-500 font-bold">红圈(1)</span>只囊括了上方紧挨着的 2 个未知格子，这里面一定有 1 颗雷。</li>
                <li><span className="font-bold">黑圈(1)</span>囊括了红圈的那 2 个格子，以及它自己右上角的格子，共 3 个未知格。这 3 格共有 1 颗雷！</li>
                <li><strong>推理：</strong>既然红圈那 2 格里必定有唯一的一颗雷，而且黑圈总共也只需这 1 颗雷，那么这颗雷肯定长在红圈的范围内。</li>
                <li><strong>结论：</strong>黑圈多出来的右上角那 1 个格子，绝对装不下额外的雷了。因此多出的那一格<strong>必定安全</strong>（左推右，最右边的格必安全，如右图上方绿字所示）！</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "第 5 课：排除法的常见形式",
      phase: "中篇 核心技巧进阶",
      content: (
        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <p>排除法不只是两个纯“1”凑一起才能用，只要你算清剩余的雷数，并且保证其中一个圈被另一个圈全包进去，就能发威。</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-muted/30 p-4 flex flex-col items-center gap-3 rounded-xl border border-border">
              <p className="font-bold">带雷的 11 (其实数字是2和3)</p>
              <div className="flex gap-2 items-center">
                <BoardIllustration
                  grid={[
                    ["flag", "2", "1"],
                    ["?", "?", "?"]
                  ]}
                  circles={[
                    { r: 0, c: 1, color: "border-gray-800 dark:border-gray-500" },
                    { r: 0, c: 2, color: "border-red-500" }
                  ]}
                  highlights={[
                    { r: 1, c: 1, bg: "bg-red-500/20" },
                    { r: 1, c: 2, bg: "bg-red-500/20" },
                    { r: 1, c: 0, bg: "bg-gray-500/30" }
                  ]}
                />
                <span>👉</span>
                <BoardIllustration
                  grid={[
                    ["flag", "2", "1"],
                    ["safe", "?", "?"]
                  ]}
                  circles={[
                    { r: 0, c: 1, color: "border-gray-800 dark:border-gray-500" },
                    { r: 0, c: 2, color: "border-red-500" }
                  ]}
                />
              </div>
              <p className="text-xs">
                右侧的<span className="text-red-500 font-bold">红圈(1)</span>囊括右下方的 2 个未知格，有 1 雷。<br />
                左侧的<span className="font-bold">黑圈(2)</span>旁边有 1 面红旗，它剩下的 3 个未知格里也只有 1 雷！<br />
                黑圈包裹了红圈，雷数又相等，所以黑圈多出的左下角那格绝对安全！
              </p>
            </div>

            <div className="bg-muted/30 p-4 flex flex-col items-center gap-3 rounded-xl border border-border">
              <p className="font-bold">平边 1-1-1 (两头安全)</p>
              <div className="flex gap-2 items-center">
                <BoardIllustration
                  grid={[
                    ["?", "?", "?"],
                    ["1", "1", "1"]
                  ]}
                  circles={[
                    { r: 1, c: 0, color: "border-red-500" },
                    { r: 1, c: 1, color: "border-gray-800 dark:border-gray-500" }
                  ]}
                  highlights={[
                    { r: 0, c: 0, bg: "bg-red-500/20" },
                    { r: 0, c: 1, bg: "bg-red-500/20" },
                    { r: 0, c: 2, bg: "bg-gray-500/30" }
                  ]}
                />
                <span>👉</span>
                <BoardIllustration
                  grid={[
                    ["safe", "?", "safe"],
                    ["1", "1", "1"]
                  ]}
                  circles={[
                    { r: 1, c: 0, color: "border-red-500" },
                    { r: 1, c: 1, color: "border-gray-800 dark:border-gray-500" }
                  ]}
                />
              </div>
              <p className="text-xs">
                左侧<span className="text-red-500 font-bold">红圈(1)</span>囊括了其上方的 2 个格子，有 1 雷。<br />
                中间<span className="font-bold">黑圈(1)</span>囊括了其上方的 3 个格子，也是 1 雷。<br />
                黑圈比红圈多出右上角那格，多出的格子不可能有雷，绝对安全！同理用右侧的 1 推理，左上角也必定安全。
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "第 6 课：确认法（大圈减小圈求雷）",
      phase: "中篇 核心技巧进阶",
      content: (
        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <p>确认法和排除法是好兄弟。当你看到 <strong>大圈包含小圈</strong> 时：<br />
            算一下大圈比小圈 <strong>多了几个未知格</strong>，再算一下 <strong>多了几颗雷</strong>。如果它们刚好相等，那么多出来的格子必定全是雷！</p>

          <div className="bg-muted/30 p-5 rounded-2xl border border-border">
            <h3 className="font-bold text-foreground text-base mb-4 text-center">基础边 12 确认</h3>
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
              <BoardIllustration
                grid={[
                  ["?", "?", "?"],
                  ["1", "2", "safe"]
                ]}
                circles={[
                  { r: 1, c: 0, color: "border-red-500" },
                  { r: 1, c: 1, color: "border-gray-800 dark:border-gray-500" }
                ]}
                highlights={[
                  { r: 0, c: 0, bg: "bg-red-500/20" },
                  { r: 0, c: 1, bg: "bg-red-500/20" },
                  { r: 0, c: 2, bg: "bg-gray-500/30" }
                ]}
              />
              <div className="text-2xl text-muted-foreground">👉</div>
              <BoardIllustration
                grid={[
                  ["?", "?", "flag"],
                  ["1", "2", "safe"]
                ]}
                circles={[
                  { r: 1, c: 0, color: "border-red-500" },
                  { r: 1, c: 1, color: "border-gray-800 dark:border-gray-500" }
                ]}
              />
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <ul className="list-decimal pl-4 space-y-1">
                <li>由于底部和左侧是墙壁，<span className="text-red-500 font-bold">红圈(1)</span>只有其上方的 2 个未知格，藏了 1 雷。</li>
                <li><span className="font-bold">黑圈(2)</span>包含了红圈的 2 个未知格，再加上自己右上角的 1 个未知格，共 3 个未知格。这 3 格里藏了 2 雷。</li>
                <li><strong>找差别：</strong>黑圈的范围比红圈多出了最右上的 <strong>1 格</strong>，同时雷数也刚好比红圈多了 <strong>1 雷 (2 - 1 = 1)</strong>。</li>
                <li><strong>结论：</strong>差的这一颗雷，只能塞在差的这一个格子里。所以多出来的最右上的那一格，必定是红旗！这就是<strong>确认法</strong>。</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "第 7 课：确认法的变种",
      phase: "中篇 核心技巧进阶",
      content: (
        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <p>只要满足条件，你可以推导出很多奇妙的确认变种。</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-muted/30 p-4 flex flex-col items-center gap-3 rounded-xl border border-border">
              <p className="font-bold">带雷的 12</p>
              <div className="flex gap-2 items-center">
                <BoardIllustration
                  grid={[
                    ["flag", "3", "1"],
                    ["?", "?", "?"]
                  ]}
                  circles={[
                    { r: 0, c: 2, color: "border-red-500" },
                    { r: 0, c: 1, color: "border-gray-800 dark:border-gray-500" }
                  ]}
                  highlights={[
                    { r: 1, c: 1, bg: "bg-red-500/20" },
                    { r: 1, c: 2, bg: "bg-red-500/20" },
                    { r: 1, c: 0, bg: "bg-gray-500/30" }
                  ]}
                />
                <span>👉</span>
                <BoardIllustration
                  grid={[
                    ["flag", "3", "1"],
                    ["flag", "?", "?"]
                  ]}
                  circles={[
                    { r: 0, c: 2, color: "border-red-500" },
                    { r: 0, c: 1, color: "border-gray-800 dark:border-gray-500" }
                  ]}
                />
              </div>
              <p className="text-xs">
                右侧<span className="text-red-500 font-bold">红圈(1)</span>有 2 个未知格，藏 1 雷。<br />
                中间的 3 旁边有个红旗，剩下 3 个未知格还需 2 雷，变成了<span className="font-bold">黑圈(2)</span>！<br />
                黑圈包裹红圈，3 格减 2 格 = 多出 1 格，2 雷减 1 雷 = 差 1 雷。多出的左下那一格，必是红旗！
              </p>
            </div>

            <div className="bg-muted/30 p-4 flex flex-col items-center gap-3 rounded-xl border border-border">
              <p className="font-bold">平边 1-3</p>
              <div className="flex gap-2 items-center">
                <BoardIllustration
                  grid={[
                    ["safe", "?", "?", "?"],
                    ["safe", "1", "3", "?"]
                  ]}
                  circles={[
                    { r: 1, c: 1, color: "border-red-500" },
                    { r: 1, c: 2, color: "border-gray-800 dark:border-gray-500" }
                  ]}
                  highlights={[
                    { r: 0, c: 1, bg: "bg-red-500/20" },
                    { r: 0, c: 2, bg: "bg-red-500/20" },
                    { r: 0, c: 3, bg: "bg-gray-500/30" },
                    { r: 1, c: 3, bg: "bg-gray-500/30" }
                  ]}
                />
                <span>👉</span>
                <BoardIllustration
                  grid={[
                    ["safe", "?", "?", "flag"],
                    ["safe", "1", "3", "flag"]
                  ]}
                  circles={[
                    { r: 1, c: 1, color: "border-red-500" },
                    { r: 1, c: 2, color: "border-gray-800 dark:border-gray-500" }
                  ]}
                />
              </div>
              <p className="text-xs">
                左侧有安全区（如左上），<span className="text-red-500 font-bold">红圈(1)</span>只管剩下右上两格。<br />
                右侧<span className="font-bold">黑圈(3)</span>管 4 个未知格。<br />
                黑圈比红圈多出 2 个格子，也正好多了 2 颗雷 (3 - 1 = 2)。因此黑圈独有的这 2 格全都是雷！
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "第 8 课：经典定式 —— 1-2-1",
      phase: "中篇 核心技巧进阶",
      content: (
        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <p>这是扫雷里极其常用的经典定式！当你在边界上看到一排未知格，旁边紧挨着依次排列着 <strong>1、2、1</strong> 三个数字时，就可以直接套用结论。</p>

          <div className="bg-muted/30 p-5 rounded-2xl border border-border">
            <h3 className="font-bold text-foreground text-base mb-4 text-center">经典的 1-2-1</h3>
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
              <BoardIllustration
                grid={[
                  ["?", "?", "?"],
                  ["1", "2", "1"]
                ]}
                circles={[
                  { r: 1, c: 0, color: "border-blue-500" },
                  { r: 1, c: 1, color: "border-red-500" },
                  { r: 1, c: 2, color: "border-blue-500" }
                ]}
                highlights={[
                  { r: 0, c: 0, bg: "bg-blue-500/20" },
                  { r: 0, c: 1, bg: "bg-red-500/20" },
                  { r: 0, c: 2, bg: "bg-blue-500/20" }
                ]}
              />
              <div className="text-2xl text-muted-foreground">👉</div>
              <BoardIllustration
                grid={[
                  ["flag", "safe", "flag"],
                  ["1", "2", "1"]
                ]}
                circles={[
                  { r: 1, c: 0, color: "border-blue-500" },
                  { r: 1, c: 1, color: "border-red-500" },
                  { r: 1, c: 2, color: "border-blue-500" }
                ]}
              />
            </div>
            <div className="mt-4 space-y-2 text-sm text-center font-bold">
              <p className="text-blue-500 dark:text-blue-400">两侧 1 各自的独有格（A、C），必定是雷！</p>
              <p className="text-red-500 dark:text-red-400">2 正对的中间格（B），两个 1 共享它，必定安全！</p>
            </div>
          </div>

          <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex gap-3 text-primary">
            <Lightbulb className="shrink-0 mt-0.5" />
            <div className="space-y-2 text-xs">
              <p><strong>拆分推导（为什么这样？）</strong></p>
              <ul className="list-decimal pl-4 space-y-1">
                <li>设三格从左到右为 A、B、C。<span className="text-blue-500 font-bold">左1</span>说 A+B=1；<span className="text-blue-500 font-bold">右1</span>说 B+C=1；<span className="text-red-500 font-bold">中2</span>说 A+B+C=2。</li>
                <li>A+B=1 代入 A+B+C=2 → <strong>C=1（C 是雷）</strong></li>
                <li>B+C=1 且 C=1 → <strong>B=0（B 安全）</strong></li>
                <li>A+B=1 且 B=0 → <strong>A=1（A 是雷）</strong></li>
              </ul>
              <p>结论唯一确定，无需猜测！</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "第 9 课：1-2-1 定式的大号变种",
      phase: "中篇 核心技巧进阶",
      content: (
        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <p>定式“12”，这个词里1和2讲的是它们实际需要的雷数，并不局限只占领那么一点格子。“1”的部分其实可以很长很宽，同样能触发这个神作。</p>

          <div className="bg-muted/30 p-5 rounded-2xl border border-border">
            <h3 className="font-bold text-foreground text-base mb-4 text-center">拉长的 1</h3>
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
              <BoardIllustration
                grid={[
                  ["?", "?", "?", "?", "?"],
                  ["1", "1", "2", "1", ""]
                ]}
                circles={[
                  { r: 1, c: 0, color: "border-blue-500" },
                  { r: 1, c: 1, color: "border-blue-500" },
                  { r: 1, c: 2, color: "border-red-500" },
                  { r: 1, c: 3, color: "border-blue-500" }
                ]}
                highlights={[
                  { r: 0, c: 0, bg: "bg-blue-500/20" },
                  { r: 0, c: 1, bg: "bg-gray-500/20" },
                  { r: 0, c: 2, bg: "bg-gray-500/20" },
                  { r: 0, c: 3, bg: "bg-blue-500/20" }
                ]}
              />
              <div className="text-2xl text-muted-foreground">👉</div>
              <BoardIllustration
                grid={[
                  ["safe", "flag", "safe", "flag", "safe"],
                  ["1", "1", "2", "1", ""]
                ]}
                circles={[
                  { r: 1, c: 0, color: "border-blue-500" },
                  { r: 1, c: 1, color: "border-blue-500" },
                  { r: 1, c: 2, color: "border-red-500" },
                  { r: 1, c: 3, color: "border-blue-500" }
                ]}
              />
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <p>设五个未知格从左到右为 A B C D E，逐步推导：</p>
              <ul className="list-decimal pl-4 space-y-1">
                <li><span className="text-blue-500 font-bold">左1(c=0)</span>：A+B=1；<span className="text-blue-500 font-bold">左1(c=1)</span>：A+B+C=1 → 两式相减得 <strong>C=0（C 安全）</strong></li>
                <li><span className="text-red-500 font-bold">2(c=2)</span>：B+C+D=2，C=0 → B+D=2 → <strong>B=1，D=1（均为雷）</strong></li>
                <li><span className="text-blue-500 font-bold">右1(c=3)</span>：C+D+E=1，C=0，D=1 → <strong>E=0（E 安全）</strong></li>
                <li>由 A+B=1，B=1 → <strong>A=0（A 安全）</strong></li>
              </ul>
              <p className="text-muted-foreground pt-1">"1"的部分可以向外无限延展，推导链照样成立。</p>
            </div>
          </div>

          <div className="pt-4 mt-6 text-center border-t border-border">
            <p className="text-primary font-black text-lg">— 扫雷基础核心技已传授完毕 —</p>
            <p className="text-muted-foreground mt-2">融会贯通“拆分”、“排除”，熟背“12定式”。通过本课程的每课实操练习，你的扫雷水平必定超神。更高阶的死猜概率论，我们顶峰相见！</p>
          </div>
        </div>
      )
    }
  ]
}

export default function CoursePage() {
  const [currentLesson, setCurrentLesson] = useState(0)

  const lessons = useMemo(() => buildLessons(), [])
  const puzzle = practicePuzzles[currentLesson]

  const goNext = () => {
    if (currentLesson < LESSON_COUNT - 1) setCurrentLesson((i) => i + 1)
  }
  const goPrev = () => {
    if (currentLesson > 0) setCurrentLesson((i) => i - 1)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* 顶部：返回 + 标题 */}
      <div className="shrink-0 border-b border-border bg-card/50 backdrop-blur-xl px-4 py-3 flex items-center gap-4 z-10 sticky top-0">
        <Link
          href="/playground/minesweeper"
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> 返回游乐场
        </Link>
        <div className="flex-1 flex items-center justify-end md:justify-start gap-2 min-w-0">
          <BookOpen className="w-5 h-5 text-primary shrink-0 hidden md:block" />
          <h1 className="text-base md:text-lg font-bold truncate">扫雷解局学</h1>
        </div>
      </div>

      {/* 进度与课时导航 */}
      <div className="shrink-0 px-4 py-3 space-y-3 border-b border-border bg-muted/20">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>学习进度</span>
          <span className="font-mono font-bold text-primary">{Math.round(((currentLesson + 1) / LESSON_COUNT) * 100)}%</span>
        </div>
        <div className="w-full bg-muted h-2 rounded-full overflow-hidden border border-border/50">
          <motion.div
            className="bg-primary h-full rounded-full"
            initial={false}
            animate={{ width: `${((currentLesson + 1) / LESSON_COUNT) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar touch-pan-x snap-x snap-mandatory">
          {Array.from({ length: LESSON_COUNT }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrentLesson(i)}
              className={`shrink-0 w-9 h-9 rounded-xl text-sm font-bold transition-all snap-start ${i === currentLesson
                ? "bg-primary text-primary-foreground shadow-md scale-105"
                : "bg-background border border-border hover:bg-muted text-muted-foreground"
                }`}
              title={lessons[i]?.title}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* 正文：讲解 + 图 + 练习 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 md:py-8 max-w-3xl mx-auto w-full text-base sm:text-[inherit]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentLesson}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            <div>
              <span className="text-xs font-black bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-wider mb-4 inline-block">
                {lessons[currentLesson]?.phase}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-4 leading-tight">{lessons[currentLesson]?.title}</h2>
              <div className="w-16 h-1.5 bg-primary rounded-full mb-8" />
              {lessons[currentLesson]?.content}
            </div>

            {currentLesson > 0 && (
              <div className="mt-12">
                {puzzle ? (
                  <PracticeBoard puzzle={puzzle} />
                ) : (
                  <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden shadow-inner hidden">
                    {/* 暂时隐藏没有练习的关卡 */}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 底部：上一课 / 下一课 */}
      <div className="shrink-0 border-t border-border px-4 py-5 flex items-center justify-between gap-4 bg-background z-10 sticky bottom-0">
        <button
          onClick={goPrev}
          disabled={currentLesson === 0}
          className="flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl transition-all disabled:opacity-30 enabled:hover:bg-accent text-foreground border border-transparent enabled:hover:border-border"
        >
          <ChevronLeft className="w-4 h-4" /> 上一课
        </button>
        <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/50 border border-border px-3 py-1.5 rounded-lg hidden sm:block">
          第 {currentLesson + 1} 课 / 共 {LESSON_COUNT} 课
        </span>
        <button
          onClick={goNext}
          disabled={currentLesson === LESSON_COUNT - 1}
          className="flex items-center gap-2 px-5 py-3 text-sm font-bold bg-primary text-primary-foreground rounded-xl transition-all disabled:opacity-30 enabled:hover:opacity-90 shadow-md shadow-primary/20"
        >
          下一课 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
