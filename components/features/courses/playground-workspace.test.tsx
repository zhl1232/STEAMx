import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlaygroundWorkspace } from "./playground-workspace";
import type { CourseLessonRow } from "@/lib/courses/types";

vi.mock("@/lib/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

vi.mock("@/lib/context/login-prompt-context", () => ({
  useLoginPrompt: () => ({ promptLogin: vi.fn() }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} data-testid="playground-link">
      {children}
    </a>
  ),
}));

const lesson: CourseLessonRow = {
  id: 101,
  course_id: 7,
  title: "认识棋盘",
  lesson_type: "playground",
  content: {
    summary: "建立规则",
    track: "foundation",
    playground: {
      gameKey: "gomoku",
      practiceHref: "/playground/gomoku",
      practiceCta: "去和 AI 下一局",
    },
  },
  steps: [
    {
      title: "看看 15×15 棋盘",
      description: "15×15 格子，连成 5 子获胜。",
      hint: "注意是 5 子。",
    },
    {
      title: "观察威胁与机会",
      description: "同时看自己和对手。",
      checklist: ["能说出胜负规则"],
    },
    {
      title: "到游乐场试一局",
      description: "选入门难度走完一局。",
    },
  ],
  resources: [],
  starter_project_path: null,
  sort_order: 1,
  duration_minutes: 15,
  created_at: "2026-06-26T00:00:00.000Z",
  updated_at: "2026-06-26T00:00:00.000Z",
};

describe("PlaygroundWorkspace", () => {
  it("renders the first step description and hint without the practice link", () => {
    render(
      <PlaygroundWorkspace
        courseId={7}
        lesson={lesson}
        activeStepIndex={0}
        onStepChange={vi.fn()}
        initialCompleted={false}
      />,
    );

    // 步骤标题在主面板（heading）和右侧步骤列表里都出现，按 heading 角色取主面板的
    expect(screen.getByRole("heading", { name: "看看 15×15 棋盘" })).toBeInTheDocument();
    expect(screen.getByText("15×15 格子，连成 5 子获胜。")).toBeInTheDocument();
    expect(screen.getByText("注意是 5 子。")).toBeInTheDocument();
    expect(screen.getByText("基础必学")).toBeInTheDocument();

    expect(screen.queryByTestId("playground-link")).not.toBeInTheDocument();
    expect(screen.queryByText("去和 AI 下一局")).not.toBeInTheDocument();

    // 首步不显示「完成这课」，显示「下一步」
    expect(screen.getByRole("button", { name: /下一步/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /完成这课/ })).not.toBeInTheDocument();
  });

  it("shows checklist items for the active step", () => {
    render(
      <PlaygroundWorkspace
        courseId={7}
        lesson={lesson}
        activeStepIndex={1}
        onStepChange={vi.fn()}
        initialCompleted={false}
      />,
    );

    expect(screen.getByText("能说出胜负规则")).toBeInTheDocument();
  });

  it("renders structured Gomoku board visuals from the active step", () => {
    const visualLesson: CourseLessonRow = {
      ...lesson,
      steps: [
        {
          title: "识别活三",
          description: "活三两端都空。",
          visuals: [
            {
              type: "gomoku_board",
              caption: "活三：A/B 都是扩展点",
              blackStones: [
                { r: 7, c: 6 },
                { r: 7, c: 7 },
                { r: 7, c: 8 },
              ],
              marks: [
                { r: 7, c: 5, label: "A", tone: "danger" },
                { r: 7, c: 9, label: "B", tone: "danger" },
              ],
              lines: [
                {
                  from: { r: 7, c: 5 },
                  to: { r: 7, c: 9 },
                  tone: "danger",
                  dashed: true,
                },
              ],
            },
          ],
        },
      ],
    };

    render(
      <PlaygroundWorkspace
        courseId={7}
        lesson={visualLesson}
        activeStepIndex={0}
        onStepChange={vi.fn()}
        initialCompleted={false}
      />,
    );

    expect(screen.getByText("活三：A/B 都是扩展点")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "活三：A/B 都是扩展点" })).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("renders a Gomoku best-move training exercise and reveals feedback", () => {
    const trainingLesson: CourseLessonRow = {
      ...lesson,
      steps: [
        {
          title: "先挡立即成五",
          description: "白方下一手能连五，黑方必须先防守。",
          training: {
            type: "gomoku_best_move",
            prompt: "黑方第一选在哪里？",
            player: "black",
            blackStones: [{ r: 8, c: 6 }],
            whiteStones: [
              { r: 7, c: 5 },
              { r: 7, c: 6 },
              { r: 7, c: 7 },
              { r: 7, c: 8 },
            ],
            bestMoves: [{ r: 7, c: 4, label: "A", reason: "先挡白方左端成五点。" }],
            candidateMoves: [
              { r: 7, c: 4, label: "A", reason: "先挡白方左端成五点。" },
              { r: 8, c: 7, label: "B", reason: "连接自己，但漏掉白方成五。" },
            ],
            explanation: "白方第 8 行已经四连，黑方必须先挡 A。",
            correctFeedback: "对，先挡成五点",
            wrongFeedback: "还不是第一选",
          },
        },
      ],
    };

    render(
      <PlaygroundWorkspace
        courseId={7}
        lesson={trainingLesson}
        activeStepIndex={0}
        onStepChange={vi.fn()}
        initialCompleted={false}
      />,
    );

    expect(screen.getByText("第一选训练")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "黑方第一选在哪里？" })).toBeInTheDocument();
    expect(screen.getByText("先找第一选")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "选择第 9 行第 8 列" }));

    expect(screen.getByText("还不是第一选")).toBeInTheDocument();
    expect(screen.getByText("白方第 8 行已经四连，黑方必须先挡 A。")).toBeInTheDocument();
    expect(screen.getByText(/A · 第 8 行第 5 列/)).toBeInTheDocument();
  });

  it("shows the complete button on the last step and calls the complete API", async () => {
    const onCompleted = vi.fn();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ alreadyCompleted: false }), { status: 200 }),
      );

    const { rerender } = render(
      <PlaygroundWorkspace
        courseId={7}
        lesson={lesson}
        activeStepIndex={2}
        onStepChange={vi.fn()}
        initialCompleted={false}
        onCompleted={onCompleted}
      />,
    );

    expect(screen.getByRole("button", { name: /完成这课/ })).toBeInTheDocument();
    expect(screen.getByTestId("playground-link")).toHaveAttribute("href", "/playground/gomoku");
    expect(screen.getByText("去和 AI 下一局")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /完成这课/ }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/courses/7/lessons/101/complete",
        expect.objectContaining({ method: "POST" }),
      );
      expect(onCompleted).toHaveBeenCalled();
    });

    // 完成后按钮切换为「已完成」
    rerender(
      <PlaygroundWorkspace
        courseId={7}
        lesson={lesson}
        activeStepIndex={2}
        onStepChange={vi.fn()}
        initialCompleted={false}
        onCompleted={onCompleted}
      />,
    );

    fetchSpy.mockRestore();
  });

  it("falls back to a generic practice link when gameKey is unknown", () => {
    const unknownLesson: CourseLessonRow = {
      ...lesson,
      content: { playground: { gameKey: "mystery" } },
    };
    render(
      <PlaygroundWorkspace
        courseId={7}
        lesson={unknownLesson}
        activeStepIndex={2}
        onStepChange={vi.fn()}
        initialCompleted={false}
      />,
    );

    expect(screen.getByTestId("playground-link")).toHaveAttribute("href", "/playground");
  });

  it("falls back to a generic practice link when the playground block is missing", () => {
    const emptyLesson: CourseLessonRow = {
      ...lesson,
      content: {},
    };
    render(
      <PlaygroundWorkspace
        courseId={7}
        lesson={emptyLesson}
        activeStepIndex={2}
        onStepChange={vi.fn()}
        initialCompleted={false}
      />,
    );

    // 缺失 playground 配置块不应静默链到 /playground/gomoku
    expect(screen.getByTestId("playground-link")).toHaveAttribute("href", "/playground");
  });

  it("shows the complete button even when there are no steps", () => {
    const noStepsLesson: CourseLessonRow = {
      ...lesson,
      steps: [],
    };
    render(
      <PlaygroundWorkspace
        courseId={7}
        lesson={noStepsLesson}
        activeStepIndex={0}
        onStepChange={vi.fn()}
        initialCompleted={false}
      />,
    );

    // 0 步课时应直接出现「完成这课」，而不是只显示「下一步」
    expect(screen.getByRole("button", { name: /完成这课/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /下一步/ })).not.toBeInTheDocument();
  });
});
