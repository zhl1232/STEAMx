import { describe, expect, it } from "vitest"
import { OBSERVATION_IDS, OBSERVATION_LESSON, OBSERVATION_PLANTS } from "./observation-plants"

describe("observation lesson content", () => {
  it("preserves the shipped lesson's three observation records and two pages", () => {
    expect(OBSERVATION_LESSON.id).toBe("p1a-1-2")
    expect(OBSERVATION_LESSON.pageTitles).toHaveLength(2)
    expect(OBSERVATION_IDS).toEqual(["leaf", "stem", "flower"])
    expect(OBSERVATION_PLANTS.map((part) => part.record)).toEqual([
      ["叶", "绿色，扁扁的", "有叶脉"],
      ["茎", "直直的", "连着叶和根"],
      ["花", "颜色鲜艳", "有花瓣"],
    ])
  })

  it("retains the observation question and drawing task without inventing screen touch or mastery", () => {
    const { question } = OBSERVATION_LESSON
    expect(question.options[question.correctIndex]).toBe("眼睛和手")
    expect(question.answer).toContain("不能随便尝")
    expect(OBSERVATION_LESSON.methods.find((method) => method.action === "摸")?.detail).toBe("光滑还是粗糙")
    expect(OBSERVATION_LESSON.touchNote).toContain("接触真实植物")
    expect(OBSERVATION_LESSON.challenge).toBe("画一画你观察的植物。")
    expect(OBSERVATION_LESSON.recordNote).toContain("不判断你是否已经掌握")
  })
})
