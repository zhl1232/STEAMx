import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GomokuBoard } from "./gomoku-board";

describe("GomokuBoard", () => {
  it("renders stones, candidate marks, and helper lines", () => {
    render(
      <GomokuBoard
        ariaLabel="活三图解"
        blackStones={[
          { r: 7, c: 6, label: "1" },
          { r: 7, c: 7 },
          { r: 7, c: 8 },
        ]}
        whiteStones={[{ r: 8, c: 7, label: "白" }]}
        marks={[
          { r: 7, c: 5, label: "A", tone: "danger" },
          { r: 7, c: 9, label: "B", tone: "danger", kind: "ring" },
        ]}
        lines={[
          {
            from: { r: 7, c: 5 },
            to: { r: 7, c: 9 },
            tone: "danger",
            dashed: true,
          },
        ]}
      />,
    );

    expect(screen.getByRole("img", { name: "活三图解" })).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("白")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("supports optional interactive point clicks", () => {
    const onPointClick = vi.fn();
    render(
      <GomokuBoard
        ariaLabel="训练棋盘"
        onPointClick={onPointClick}
        getPointAriaLabel={(point) => `选择 ${point.r},${point.c}`}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "选择 7,7" }));

    expect(screen.getByRole("group", { name: "训练棋盘" })).toBeInTheDocument();
    expect(onPointClick).toHaveBeenCalledWith({ r: 7, c: 7 });
  });
});
