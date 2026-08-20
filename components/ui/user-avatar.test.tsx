import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { UserAvatar } from "./user-avatar"

vi.mock("@radix-ui/react-avatar", () => ({
  Root: ({ children, className }: { children: ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
  Image: ({ src, alt, className }: { src?: string; alt?: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    src ? <img src={src} alt={alt} className={className} /> : null
  ),
  Fallback: ({ children, className }: { children: ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}))

describe("UserAvatar", () => {
  it("links a known user to the public profile and supplies a default avatar", () => {
    render(<UserAvatar userId="user-42" name="Alice" className="h-10 w-10" />)

    expect(screen.getByRole("link", { name: "查看Alice的个人主页" })).toHaveAttribute(
      "href",
      "/users/user-42",
    )
    expect(screen.getByRole("img", { name: "Alice" })).toHaveAttribute(
      "src",
      "/avatars/default-5.svg",
    )
  })

  it("can render inside an existing link without nesting another profile link", () => {
    render(<UserAvatar userId="user-42" name="Alice" href={null} />)

    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Alice" })).toBeInTheDocument()
  })
})
