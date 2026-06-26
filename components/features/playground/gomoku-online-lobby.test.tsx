import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GomokuOnlineLobby } from "./gomoku-online-lobby";

vi.mock("@/lib/context/auth-context", () => ({
    useAuth: () => ({ user: null }),
}));

const online = {
    phase: "idle",
    code: null,
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
} as unknown as Parameters<typeof GomokuOnlineLobby>[0]["online"];

describe("GomokuOnlineLobby login link", () => {
    it("preserves the invite room when sending anonymous visitors to login", () => {
        render(<GomokuOnlineLobby online={online} initialRoomCode="es63jd" />);

        const href = screen.getByRole("link", { name: "去登录" }).getAttribute("href");

        expect(href).toBe("/login?next=%2Fplayground%2Fgomoku%3Froom%3DES63JD");
    });
});
