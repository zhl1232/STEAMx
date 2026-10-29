import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryOnlineView } from "./memory-online-view";

const mocks = vi.hoisted(() => ({ online: {} as Record<string, unknown>, checkBadges: vi.fn() }));
vi.mock("@/hooks/playground/use-memory-online", () => ({ useMemoryOnline: () => mocks.online }));
vi.mock("@/lib/context/auth-context", () => ({ useAuth: () => ({ user: { id: "host" }, loading: false }) }));
vi.mock("@/lib/context/gamification-context", () => ({ useGamification: () => ({ checkBadges: mocks.checkBadges }) }));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

describe("memory online interface", () => {
    beforeEach(() => {
        mocks.online = {
            phase: "idle", resultSeq: 0, lastResult: null, matchId: null, myRole: null,
            scores: { host: 0, guest: 0 }, currentTurn: "host", stats: { wins: 0 },
            createRoom: vi.fn(), joinRoom: vi.fn(), reconnect: vi.fn(), opponentRole: () => "guest",
        };
        localStorage.clear();
    });

    it("creates knowledge matches with the selected theme and pair count without a duplicate empty board", () => {
        render(<MemoryOnlineView />);
        expect(screen.queryByText("创建房间或输入房间码，开始在线比拼记忆力。")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "萌宠" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "力学" }));
        fireEvent.click(screen.getByRole("button", { name: "8 对" }));
        fireEvent.click(screen.getByRole("button", { name: "创建房间" }));
        expect(mocks.online.createRoom).toHaveBeenCalledWith("mechanics", "hard");
    });

    it("shows concept display text on first-flip and paired cards while keeping other cards hidden", () => {
        mocks.online = {
            ...mocks.online, phase: "playing", myRole: "host", columns: 4, isMyTurn: true,
            firstFlip: { id: "term", symbol: "mechanics:force" },
            deck: [
                { id: "term", symbol: "mechanics:force", label: "力", face: "term", matched: null },
                { id: "def", symbol: "mechanics:force", label: "改变物体运动状态的作用", face: "def", matched: null },
                { id: "matched", symbol: "mechanics:gravity", label: "重力", face: "term", matched: "guest" },
            ],
        };
        render(<MemoryOnlineView />);
        expect(screen.getByRole("button", { name: "名词：力" })).toHaveTextContent("力");
        expect(screen.getByRole("button", { name: "未翻开的牌" })).toHaveTextContent("");
        expect(screen.queryByText("改变物体运动状态的作用")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "名词：重力" })).toHaveTextContent("重力");
        expect(screen.queryByText("mechanics:force")).not.toBeInTheDocument();
    });

    it("resolves both revealed labels from the deck when the RPC result only includes ids and pairing keys", () => {
        mocks.online = {
            ...mocks.online, phase: "playing", myRole: "host", columns: 4, isMyTurn: true,
            resultSeq: 1,
            lastResult: { a: { id: "term", symbol: "force" }, b: { id: "def", symbol: "force" }, matched: true, by: "host" },
            deck: [
                { id: "term", symbol: "force", label: "力", face: "term", matched: "host" },
                { id: "def", symbol: "force", label: "改变物体运动状态的作用", face: "def", matched: "host" },
            ],
        };
        render(<MemoryOnlineView />);
        expect(screen.getByRole("button", { name: "名词：力" })).toHaveTextContent("力");
        expect(screen.getByRole("button", { name: "解释：改变物体运动状态的作用" })).toHaveTextContent("改变物体运动状态的作用");
    });

    it("renders a legacy picture room without concept labels", () => {
        mocks.online = {
            ...mocks.online, phase: "playing", myRole: "host", columns: 4, isMyTurn: true,
            firstFlip: { id: "legacy", symbol: "🦊" },
            deck: [{ id: "legacy", symbol: "🦊", matched: null }],
        };
        render(<MemoryOnlineView />);
        expect(screen.getByRole("button", { name: "🦊" })).toHaveTextContent("🦊");
    });
});
