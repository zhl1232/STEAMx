import { existsSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  getTextbook3dLesson,
  listTextbook3dLessons,
  resolveTextbook3dLessonId,
  TEXTBOOK3D_LESSON_ID,
  TEXTBOOK3D_SHARED_BASE,
  TEXTBOOK3D_VERSION,
  textbook3dLessonIdFromUrl,
  textbook3dSrc,
} from "./registry"

describe("textbook3d registry", () => {
  const lessons = listTextbook3dLessons()

  it("每个登记的课都有唯一合法课号和已复制的静态包", () => {
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length)
    for (const lesson of lessons) {
      expect(lesson.id).toMatch(TEXTBOOK3D_LESSON_ID)
      expect(existsSync(join(process.cwd(), "public/textbook3d", TEXTBOOK3D_VERSION, lesson.id, "index.html"))).toBe(true)
    }
  })

  it("给出前后节并拒绝未知课号", () => {
    const first = getTextbook3dLesson(lessons[0].id)
    expect(first?.prev).toBeNull()
    expect(first?.next?.id).toBe(lessons[1].id)
    expect(getTextbook3dLesson("../etc")).toBeNull()
  })

  it("只生成同源嵌入地址", () => {
    expect(textbook3dSrc("g8a-1-1")).toBe(`/textbook3d/${TEXTBOOK3D_VERSION}/g8a-1-1/index.html?embed=1`)
    expect(() => textbook3dSrc("https://evil.example/x")).toThrow()
  })

  it("课时 HTML 很小，引用的共享运行时和字体都在 shared/ 里", () => {
    const sharedDir = join(process.cwd(), "public/textbook3d", TEXTBOOK3D_VERSION, "shared")
    for (const lesson of lessons) {
      const file = join(process.cwd(), "public/textbook3d", TEXTBOOK3D_VERSION, lesson.id, "index.html")
      expect(statSync(file).size).toBeLessThan(64 * 1024)
      const html = readFileSync(file, "utf8")
      const refs = [...html.matchAll(new RegExp(`${TEXTBOOK3D_SHARED_BASE}([\\w.-]+)`, "g"))].map((m) => m[1])
      expect(refs.some((ref) => ref.startsWith(`${lesson.id}-`) && ref.endsWith(".js"))).toBe(true)
      for (const ref of refs) {
        const path = join(sharedDir, ref)
        expect(existsSync(path)).toBe(true)
        if (ref.endsWith(".js")) {
          for (const [, dep] of readFileSync(path, "utf8").matchAll(/["']\.\/([\w-]+\.js)["']/g)) {
            expect(existsSync(join(sharedDir, dep))).toBe(true)
          }
        }
      }
    }
  })

  it("只接受已登记课号和同源课本地址", () => {
    expect(resolveTextbook3dLessonId("g8a-1-1")).toBe("g8a-1-1")
    expect(resolveTextbook3dLessonId("g9a-9-9")).toBeNull()
    expect(resolveTextbook3dLessonId(42)).toBeNull()
    expect(textbook3dLessonIdFromUrl("/textbook3d/v1/g8a-2-3/")).toBe("g8a-2-3")
    expect(textbook3dLessonIdFromUrl("/textbook3d/v1/g8a-2-3/index.html")).toBe("g8a-2-3")
    expect(textbook3dLessonIdFromUrl("/textbook3d/v1/g8a-2-3")).toBe("g8a-2-3")
    expect(textbook3dLessonIdFromUrl("https://evil.example/textbook3d/v1/g8a-2-3/")).toBeNull()
    expect(textbook3dLessonIdFromUrl(undefined)).toBeNull()
  })
})
