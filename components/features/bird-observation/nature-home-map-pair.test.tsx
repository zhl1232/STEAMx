import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mapMock } = vi.hoisted(() => ({ mapMock: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/components/features/bird-observation/domestic-mini-map", () => ({
  DomesticMiniMap: (props: { markers: Array<Record<string, unknown>> }) => {
    mapMock(props);
    return <div data-testid="mini-map" />;
  },
}));
vi.mock("@/components/ui/optimized-image", () => ({
  OptimizedImage: ({ alt = "" }: { alt?: string }) => <span role="img" aria-label={alt} />,
}));

import { NatureHomeMapPair } from "./nature-home-map-pair";
import type { ObservationEvent } from "@/lib/mappers/types";

function observation(id: number, name: string, coordinates?: { latitude: number; longitude: number }, mediaUrls: string[] = ["/photo.webp"]): ObservationEvent {
  return {
    id,
    userId: `user-${id}`,
    authorDisplayName: `作者${id}`,
    observedAt: "2026-09-21T10:00:00Z",
    createdAt: "2026-09-21T10:00:00Z",
    locationName: "城市公园",
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    mediaUrls,
    isPublic: true,
    status: "approved",
    identificationStatus: "community_confirmed",
    likesCount: 0,
    commentsCount: 0,
    species: [{ speciesId: id, commonName: name, behaviorTags: [] }],
  };
}

beforeEach(() => {
  mapMock.mockClear();
});

describe("NatureHomeMapPair", () => {
  it("omits missing location icons and separators while retaining the observer", () => {
    const item = { ...observation(1, "麻雀"), locationName: "" };
    const { container } = render(<NatureHomeMapPair observations={[item]} mapObservations={[]} />);
    expect(screen.queryByText("未知地点")).not.toBeInTheDocument();
    expect(screen.queryByText("大概区域")).not.toBeInTheDocument();
    expect(container.querySelector(".lucide-map-pin")).toBeNull();
    expect(screen.queryByText("•")).not.toBeInTheDocument();
    expect(screen.getAllByText("作者1").length).toBeGreaterThan(0);
  });

  it("shows the actual approximate area on desktop and mobile", () => {
    const item = { ...observation(1, "麻雀"), locationName: "永顺镇附近" };
    render(<NatureHomeMapPair observations={[item]} mapObservations={[]} />);
    expect(screen.getAllByText("永顺镇附近")).toHaveLength(2);
  });

  it("keeps no-coordinate records in desktop and mobile lists while excluding them from markers", () => {
    const withoutCoordinates = observation(1, "无坐标新记录", undefined);
    const withCoordinates = observation(2, "有坐标记录", { latitude: 31.2, longitude: 121.5 });

    render(<NatureHomeMapPair observations={[withoutCoordinates, withCoordinates]} mapObservations={[withoutCoordinates, withCoordinates]} />);

    expect(screen.getAllByText("无坐标新记录").length).toBeGreaterThan(0);
    expect(screen.getAllByText("有坐标记录").length).toBeGreaterThan(0);
    const markerSets = mapMock.mock.calls.map(([props]) => props.markers);
    expect(markerSets.length).toBe(2);
    expect(markerSets.every((markers) => markers)).toBe(true);
    expect(markerSets[0]).toEqual([
      expect.objectContaining({ id: "2", latitude: 31.2, longitude: 121.5, href: "/nature/observations/2" }),
    ]);
    expect(markerSets[0]).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: "1" })]));
  });

  it("offers the publish entry when there are no observations", () => {
    render(<NatureHomeMapPair observations={[]} mapObservations={[]} />);

    expect(screen.getAllByText("还没有公开观察。第一条由你来发布吧。").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /发布观察/ })[0]).toHaveAttribute(
      "href",
      "/nature/submit",
    );
  });

  it("keeps a long-name record without an image linked to its observation detail", () => {
    const longName = "这是一条很长的待鉴定自然观察记录名称";
    const item = observation(7, longName, undefined, []);
    render(<NatureHomeMapPair observations={[item]} mapObservations={[item]} />);

    const links = screen.getAllByRole("link", { name: new RegExp(longName) });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/nature/observations/7");
    expect(screen.getAllByText("城市公园").length).toBeGreaterThan(0);
  });
});
