import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CourseSuccessorBanner, getCourseSuccessorLinkLabel } from "./course-successor-banner";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const successor = { id: 8, title: "Scratch 创探编程：从动画到作品" };
const label = "本课程已更新，前往新版课程：Scratch 创探编程：从动画到作品";

describe("CourseSuccessorBanner", () => {
  it("builds the accessible link label from the successor title", () => {
    expect(getCourseSuccessorLinkLabel(successor.title)).toBe(label);
  });

  it.each(["card", "compact"] as const)("renders a %s link to the successor course", (variant) => {
    render(<CourseSuccessorBanner successor={successor} variant={variant} />);

    const link = screen.getByRole("link", { name: label });
    expect(link).toHaveAttribute("href", "/courses?course=8");
    expect(link).toHaveTextContent("新版课程");
  });

  it("renders nothing without a successor", () => {
    const { container } = render(<CourseSuccessorBanner successor={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
