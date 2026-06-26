import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GomokuOnlineView } from "./gomoku-online-view";

const { authState, joinRoomMock } = vi.hoisted(() => ({
    authState: {
        loading: false,
        user: { id: "user-1" } as { id: string } | null,
    },
    joinRoomMock: vi.fn(),
}));

vi.mock("canvas-confetti", () => ({
    default: vi.fn(),
}));

vi.mock("@/lib/context/auth-context", () => ({
    useAuth: () => authState,
}));

vi.mock("@/lib/context/gamification-context", () => ({
    useGamification: () => ({
        checkBadges: vi.fn(),
    }),
}));

vi.mock("@/hooks/playground/use-gomoku-online", () => ({
    useGomokuOnline: () => ({
        phase: "idle",
        winner: null,
        myColor: null,
        stats: { wins: 0 },
        board: [],
        currentTurn: "black",
        isMyTurn: false,
        isFinished: false,
        winLine: null,
        moveCount: 0,
        placing: false,
        error: null,
        joinRoom: joinRoomMock,
        makeMove: vi.fn(),
        leaveRoom: vi.fn(),
        reset: vi.fn(),
    }),
}));

vi.mock("@/components/features/playground/gomoku-online-lobby", () => ({
    GomokuOnlineLobby: () => <div data-testid="gomoku-online-lobby" />,
}));

describe("GomokuOnlineView invite bootstrap", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authState.loading = false;
        authState.user = { id: "user-1" };
        window.localStorage.clear();
    });

    it("waits for auth to finish before joining an invite room", async () => {
        authState.loading = true;
        authState.user = null;

        const { rerender } = render(<GomokuOnlineView initialRoomCode="es63jd" />);

        expect(joinRoomMock).not.toHaveBeenCalled();

        authState.loading = false;
        authState.user = { id: "user-1" };
        rerender(<GomokuOnlineView initialRoomCode="es63jd" />);

        await waitFor(() => {
            expect(joinRoomMock).toHaveBeenCalledWith("ES63JD");
        });
        expect(joinRoomMock).toHaveBeenCalledTimes(1);
    });

    it("does not consume invite bootstrap while the visitor is anonymous", () => {
        authState.loading = false;
        authState.user = null;

        const { rerender } = render(<GomokuOnlineView initialRoomCode="ES63JD" />);
        rerender(<GomokuOnlineView initialRoomCode="ES63JD" />);

        expect(joinRoomMock).not.toHaveBeenCalled();
    });
});
