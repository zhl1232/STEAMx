import { FlaskConical, Rocket, Palette, Calculator, Cpu, Sparkles } from "lucide-react";
import { TechBackground } from "@/components/ui/tech-background";
import { CategoryPortal } from "@/components/home/category-portal";
import { FeaturedProjects } from "@/components/home/featured-projects";
import { MobileHome } from "@/components/home/mobile-home";
import { getProjects, getRecommendedProjects } from "@/lib/api/explore-data";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import { logger } from "@/lib/logger";

// Client component wrapper for animations
import { HomeClient } from "./home-client";

function birthDateToAgeGroup(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
    age--;
  }
  if (age >= 16) return "16+";
  if (age >= 13) return "13-15";
  if (age >= 10) return "10-12";
  if (age >= 6) return "6-9";
  return null;
}

async function getUserPreferences() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { steam: null, ageGroup: null };

    const [profileRes, radarRes] = await Promise.all([
      supabase.from("profiles").select("birth_date").eq("id", user.id).single(),
      callRpc(supabase, "calculate_steam_radar", { target_user_id: user.id }),
    ]);

    const birthDate = (profileRes.data as { birth_date: string | null } | null)?.birth_date ?? null;
    const ageGroup = birthDateToAgeGroup(birthDate);

    const radarData = radarRes.data as Record<string, { display: number }> | null;
    let steam: Record<string, number> | null = null;
    if (radarData) {
      const scores: Record<string, number> = {};
      for (const dim of ["S", "T", "E", "A", "M"]) {
        scores[dim] = radarData[dim]?.display ?? 0;
      }
      steam = Object.values(scores).some((score) => score > 0) ? scores : null;
    }

    return { steam, ageGroup };
  } catch (e) {
    logger.error("Failed to get user preferences for homepage", { error: e });
    return { steam: null, ageGroup: null };
  }
}

export default async function Home() {
  const { steam, ageGroup } = await getUserPreferences();

  const hasSteamPreferences = steam !== null && Object.values(steam).some((score) => score > 0);
  const hasPreferences = hasSteamPreferences || ageGroup !== null;

  const [popularResult, { projects: latestProjects }] = await Promise.all([
    hasPreferences
      ? getRecommendedProjects(steam, ageGroup, { limit: 6 })
      : getProjects({}, { page: 0, pageSize: 6, sortBy: "popular" }),
    getProjects({}, { page: 0, pageSize: 10, sortBy: "latest" }),
  ]);

  const popularProjects = popularResult.projects;

  return (
    <>
      {/* Mobile View */}
      <div className="block md:hidden">
        <MobileHome
          popularProjects={popularProjects}
          latestProjects={latestProjects}
        />
      </div>

      {/* Desktop View */}
      <div className="hidden md:block flex-1 relative overflow-hidden min-h-screen">
        <TechBackground />

        {/* Hero Section */}
        <section className="relative space-y-6 pt-20 pb-12 lg:pt-36 lg:pb-20 overflow-hidden">
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -z-10 animate-pulse-glow" />

          <div className="container mx-auto flex max-w-[64rem] flex-col items-center gap-6 text-center relative z-10 px-4">
            <HomeClient />
          </div>
        </section>

        {/* Portals Section */}
        <section className="container mx-auto space-y-12 py-16 lg:py-24 relative z-10">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
            <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-5xl font-bold">
              穿越知识星门
            </h2>
            <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
              选择你的探索路径，开启不同领域的奇妙旅程。
            </p>
          </div>

          <div className="mx-auto grid justify-center gap-6 md:gap-8 grid-cols-2 md:max-w-[64rem] md:grid-cols-3 lg:gap-12">
            <CategoryPortal
              href="/explore?category=科学"
              icon={<FlaskConical className="h-10 w-10 text-blue-400" />}
              title="科学"
              description="化学反应、生物观察、物理现象"
              color="bg-blue-500"
              delay={0.1}
            />
            <CategoryPortal
              href="/explore?category=技术"
              icon={<Cpu className="h-10 w-10 text-indigo-400" />}
              title="技术"
              description="编程、机器人、电子电路"
              color="bg-indigo-500"
              delay={0.2}
            />
            <CategoryPortal
              href="/explore?category=工程"
              icon={<Rocket className="h-10 w-10 text-orange-400" />}
              title="工程"
              description="结构搭建、机械装置、3D打印"
              color="bg-orange-500"
              delay={0.3}
            />
            <CategoryPortal
              href="/explore?category=艺术"
              icon={<Palette className="h-10 w-10 text-pink-400" />}
              title="艺术"
              description="数字艺术、手工制作、创意设计"
              color="bg-pink-500"
              delay={0.4}
            />
            <CategoryPortal
              href="/explore?category=数学"
              icon={<Calculator className="h-10 w-10 text-green-400" />}
              title="数学"
              description="几何图形、逻辑谜题、数据可视化"
              color="bg-green-500"
              delay={0.5}
            />
            <CategoryPortal
              href="/explore"
              icon={<Sparkles className="h-10 w-10 text-purple-400" />}
              title="全部项目"
              description="探索所有无限可能"
              color="bg-purple-500"
              delay={0.6}
            />
          </div>
        </section>

        {/* Featured Projects Content - Desktop */}
        <FeaturedProjects projects={popularProjects} />
      </div>
    </>
  );
}
