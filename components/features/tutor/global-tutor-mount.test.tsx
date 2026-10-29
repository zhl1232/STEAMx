import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalTutorMount } from "./global-tutor-mount";

const mocks = vi.hoisted(() => ({
    prefetchQuery: vi.fn(),
    setOpen: vi.fn(),
    toast: vi.fn(),
    clearPendingDraft: vi.fn(),
    removeQueries: vi.fn(),
}));

let pathname = "/";
let search = "";
let user: { id: string } | null = null;

vi.mock("next/navigation", () => ({
    usePathname: () => pathname,
    useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({ prefetchQuery: mocks.prefetchQuery, removeQueries: mocks.removeQueries }),
}));

vi.mock("@/components/features/tutor/tutor-context", () => ({
    useOptionalTutorContext: () => ({
        open: false,
        setOpen: mocks.setOpen,
        override: {},
        clearPendingDraft: mocks.clearPendingDraft,
        consumePendingSend: vi.fn(),
    }),
}));

vi.mock("@/components/features/tutor/global-tutor-fab", () => ({
    GlobalTutorFab: () => <div data-testid="full-tutor-fab" />,
}));

vi.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/context/auth-context", () => ({
    useAuth: () => ({ user }),
}));

describe("GlobalTutorMount", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        pathname = "/";
        search = "";
        user = null;
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

    it("renders the launcher on tutor-enabled routes with the real sitewide switch", () => {
        pathname = "/explore";

        render(<GlobalTutorMount />);

        expect(screen.getByRole("button", { name: "打开 AI 导师" })).toBeInTheDocument();
    });

    it("renders nothing on routes without a tutor context", () => {
        pathname = "/login";

        const { container } = render(<GlobalTutorMount />);

        expect(container).toBeEmptyDOMElement();
    });

    it.each(["/users/22222222-2222-2222-2222-222222222222", "/nature/submit"])("hides the mobile launcher on %s", (path) => {
        pathname = path;

        render(<GlobalTutorMount />);

        expect(screen.getByRole("button", { name: "打开 AI 导师" })).toHaveClass("max-lg:hidden");
    });
});

 it("cancels pending draft on project navigation, back and account changes", () => {
    pathname = "/project/1213"; user = { id: "a" };
    const { rerender } = render(<GlobalTutorMount />);
    mocks.clearPendingDraft.mockClear();
    pathname = "/project/1215"; rerender(<GlobalTutorMount />);
    expect(mocks.clearPendingDraft).toHaveBeenCalledTimes(1);
    pathname = "/project/1213"; rerender(<GlobalTutorMount />);
    expect(mocks.clearPendingDraft).toHaveBeenCalledTimes(2);
    user = { id: "b" }; rerender(<GlobalTutorMount />);
    expect(mocks.clearPendingDraft).toHaveBeenCalledTimes(3);
    user = null; rerender(<GlobalTutorMount />);
    expect(mocks.clearPendingDraft).toHaveBeenCalledTimes(4);
 });

 it("clears the course draft when only the catalog selection changes", () => {
    pathname = "/courses"; search = "course=5";
    const { rerender } = render(<GlobalTutorMount />);
    mocks.clearPendingDraft.mockClear();
    search = "course=8"; rerender(<GlobalTutorMount />);
    expect(mocks.clearPendingDraft).toHaveBeenCalledTimes(1);
 });
