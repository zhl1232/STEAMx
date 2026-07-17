import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalTutorMount } from "./global-tutor-mount";

const mocks = vi.hoisted(() => ({
    prefetchQuery: vi.fn(),
    setOpen: vi.fn(),
    toast: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    usePathname: () => "/",
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({ prefetchQuery: mocks.prefetchQuery }),
}));

vi.mock("@/components/features/tutor/tutor-context", () => ({
    useOptionalTutorContext: () => ({
        open: false,
        setOpen: mocks.setOpen,
        override: {},
    }),
}));

vi.mock("@/components/features/tutor/global-tutor-fab", () => ({
    GlobalTutorFab: () => <div data-testid="full-tutor-fab" />,
}));

vi.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/context/auth-context", () => ({
    useAuth: () => ({ user: null }),
}));

describe("GlobalTutorMount", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window, "requestIdleCallback", {
            configurable: true,
            value: vi.fn(() => 1),
        });
        Object.defineProperty(window, "cancelIdleCallback", {
            configurable: true,
            value: vi.fn(),
        });
    });

    it("keeps the heavy tutor UI deferred until the launcher is used", async () => {
        render(<GlobalTutorMount />);

        const launcher = screen.getByRole("button", { name: "打开 AI 导师" });
        expect(screen.queryByTestId("full-tutor-fab")).not.toBeInTheDocument();

        fireEvent.click(launcher);

        expect(mocks.setOpen).toHaveBeenCalledWith(true);
        await waitFor(() => expect(screen.getByTestId("full-tutor-fab")).toBeInTheDocument());
    });
});
