import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { getTextbook3dLesson, listTextbook3dLessons, TEXTBOOK3D_LESSON_ID, TEXTBOOK3D_VERSION, textbook3dSrc } from "./registry"

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
})
