import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GomokuBoard } from "./gomoku-board";
import { createEmptyBoard } from "@/lib/playground/gomoku-online";

describe("playground GomokuBoard", () => {
    it("renders stones on intersection controls instead of grid cells", () => {
        const board = createEmptyBoard();
        board[7][7].value = "black";

        render(<GomokuBoard board={board} onCellClick={vi.fn()} confirmPlacement={false} />);

        const centerPoint = screen.getByRole("button", {
            name: "第 8 行第 8 列已有黑子",
        });

        expect(centerPoint).toHaveClass("absolute");
        expect(centerPoint).toHaveStyle({
            left: "50%",
            top: "50%",
        });
        expect(screen.getByRole("button", { name: "在第 1 行第 1 列交点落子" })).toHaveStyle({
            left: "0%",
            top: "0%",
        });
    });

    it("requires tapping the same empty intersection twice when confirm placement is enabled", async () => {
        const user = userEvent.setup();
        const board = createEmptyBoard();
        const handleCellClick = vi.fn();

        render(
            <GomokuBoard
                board={board}
                onCellClick={handleCellClick}
                confirmPlacement={true}
            />,
        );

        const firstPoint = screen.getByRole("button", {
            name: "在第 1 行第 1 列交点定位，再次点击确认落子",
        });

        await user.click(firstPoint);

        expect(handleCellClick).not.toHaveBeenCalled();
        expect(
            screen.getByRole("button", {
                name: "第 1 行第 1 列交点已定位，再次点击确认落子",
            }),
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", {
                name: "第 1 行第 1 列交点已定位，再次点击确认落子",
            }),
        );

        expect(handleCellClick).toHaveBeenCalledTimes(1);
        expect(handleCellClick).toHaveBeenCalledWith(0, 0);
    });

    it("changes the pending intersection instead of placing when a different point is tapped", async () => {
        const user = userEvent.setup();
        const board = createEmptyBoard();
        const handleCellClick = vi.fn();

        render(
            <GomokuBoard
                board={board}
                onCellClick={handleCellClick}
                confirmPlacement={true}
            />,
        );

        await user.click(
            screen.getByRole("button", {
                name: "在第 1 行第 1 列交点定位，再次点击确认落子",
            }),
        );
        await user.click(
            screen.getByRole("button", {
                name: "在第 1 行第 2 列交点定位，再次点击确认落子",
            }),
        );

        expect(handleCellClick).not.toHaveBeenCalled();
        expect(
            screen.getByRole("button", {
                name: "第 1 行第 2 列交点已定位，再次点击确认落子",
            }),
        ).toBeInTheDocument();
    });

    it("draws one small ring-3 on each winning stone without button ring-3 classes", () => {
        const board = createEmptyBoard();
        const winLine = Array.from({ length: 5 }, (_, index) => {
            const point = { row: 7, col: 3 + index };
            board[point.row][point.col].value = "black";
            return point;
        });

        const { container } = render(
            <GomokuBoard
                board={board}
                winLine={winLine}
                onCellClick={vi.fn()}
                confirmPlacement={false}
            />,
        );

        expect(container.querySelectorAll(".gomoku-win-ring")).toHaveLength(5);
        expect(container.querySelector(".gomoku-win-wave-fill")).toBeNull();
        expect(container.querySelector(".gomoku-win-wave-soft")).toBeNull();
        expect(container.querySelector(".gomoku-win-wave-outline")).toBeNull();
        expect(
            screen.getByRole("button", { name: "第 8 行第 4 列已有黑子" }),
        ).not.toHaveClass("ring-2");
    });
});
