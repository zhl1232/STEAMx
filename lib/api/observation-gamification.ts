import { fetchObservedSpeciesIdsForApprovedEvents } from '@/lib/api/nature-observation-observed-species'
import { BADGES } from "@/lib/gamification/badges"
import { buildNatureBadgeStats } from "@/lib/gamification/species-difficulty"
import type { UserStats } from "@/lib/gamification/types"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { awardXpOnce } from '@/lib/api/server-awards'

const OBSERVATION_XP = 10
const OBSERVER_THRESHOLDS = [1, 10, 30, 100]
export const OBSERVATION_BADGE_SERIES = new Set([
  "bird_observer",
  "species_collector",
  "bird_common",
  "bird_uncommon",
  "bird_rare",
  "insect_rank",
])

function getNextThreshold(count: number) {
  return OBSERVER_THRESHOLDS.find((threshold) => count < threshold) ?? OBSERVER_THRESHOLDS[OBSERVER_THRESHOLDS.length - 1]
}

async function fetchObservationStats(userId: string): Promise<UserStats> {
  if (!supabaseAdmin) {
    throw new Error("服务暂时不可用")
  }

  const { data: observationRows, error: observationError } = await supabaseAdmin
    .from("observation_events")
    .select("id, observed_at")
    .eq("user_id", userId)
    .eq("status", "approved")
    .eq("moderation_state", "approved")

  if (observationError) {
    throw observationError
  }

  const eventIds = (observationRows ?? []).map((row) => row.id)
  let speciesObserved = 0
  let natureStats = buildNatureBadgeStats([])

  if (eventIds.length > 0) {
    const observedSpeciesIds = await fetchObservedSpeciesIdsForApprovedEvents(supabaseAdmin, eventIds, {
      userId,
      logLabel: 'observation gamification stats',
    })
    speciesObserved = observedSpeciesIds.size

    if (observedSpeciesIds.size > 0) {
      const { data: speciesRows, error: speciesError } = await supabaseAdmin
        .from("species")
        .select("slug, nature_topic")
        .in("id", [...observedSpeciesIds])

      if (speciesError) {
        throw speciesError
      }

      natureStats = buildNatureBadgeStats(
        (speciesRows ?? []).map((row) => ({
          slug: row.slug,
          natureTopic: row.nature_topic,
        })),
      )
    }
  }

  const observationDates = Array.from(
    new Set(
      (observationRows ?? [])
        .map((row) => {
          const date = new Date(row.observed_at)
          if (Number.isNaN(date.getTime())) return null
          return new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(date)
        })
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort()

  let observationStreak = 0
  if (observationDates.length > 0) {
    let current = new Date(`${observationDates[observationDates.length - 1]}T00:00:00+08:00`)
    const today = new Date()
    const todayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(today)
    const todayDate = new Date(`${todayKey}T00:00:00+08:00`)
    const yesterdayDate = new Date(todayDate)
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)

    if (current.getTime() === todayDate.getTime() || current.getTime() === yesterdayDate.getTime()) {
      observationStreak = 1
      for (let index = observationDates.length - 2; index >= 0; index -= 1) {
        const previous = new Date(`${observationDates[index]}T00:00:00+08:00`)
        const expected = new Date(current)
        expected.setDate(expected.getDate() - 1)
        if (previous.getTime() !== expected.getTime()) break
        observationStreak += 1
        current = previous
      }
    }
  }

  return {
    projectsPublished: 0,
    projectsLiked: 0,
    projectsCompleted: 0,
    commentsCount: 0,
    scienceCompleted: 0,
    techCompleted: 0,
    engineeringCompleted: 0,
    artCompleted: 0,
    mathCompleted: 0,
    likesGiven: 0,
    likesReceived: 0,
    collectionsCount: 0,
    challengesJoined: 0,
    level: 1,
    loginDays: 0,
    consecutiveDays: 0,
    discussionsCreated: 0,
    repliesCount: 0,
    minesweeperWins: 0,
    minesweeperExpertWins: 0,
    minesweeperBestTime: 999,
    observationsSubmitted: observationRows?.length ?? 0,
    speciesObserved,
    observationStreak,
    commonBirdsObserved: natureStats.commonBirdsObserved,
    uncommonBirdsObserved: natureStats.uncommonBirdsObserved,
    rareBirdsObserved: natureStats.rareBirdsObserved,
    insectRank: natureStats.insectRank,
    observedInsectSlugs: natureStats.observedInsectSlugs,
    mythicInsectsObserved: natureStats.mythicInsectsObserved,
  }
}

export async function awardObservationXp(userId: string, observationId: number) {
  const awarded = await awardXpOnce({
    userId,
    actionType: "submit_observation",
    resourceId: observationId,
  })
  return awarded || OBSERVATION_XP
}

export async function revokeObservationXp(userId: string, observationId: number) {
  if (!supabaseAdmin) {
    throw new Error("服务暂时不可用")
  }

  const resourceId = String(observationId)
  const { data: xpLog, error: xpLogError } = await supabaseAdmin
    .from("xp_logs")
    .select("id, xp_amount")
    .eq("user_id", userId)
    .eq("action_type", "submit_observation")
    .eq("resource_id", resourceId)
    .maybeSingle()

  if (xpLogError) {
    throw xpLogError
  }

  if (!xpLog) return 0

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("xp")
    .eq("id", userId)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  const { error: existingRevokeError } = await supabaseAdmin
    .from("xp_logs")
    .insert({
      user_id: userId,
      action_type: "revoke_observation_xp",
      resource_id: resourceId,
      xp_amount: -Math.abs(xpLog.xp_amount),
    } as never)

  if (existingRevokeError) {
    if ((existingRevokeError as { code?: string }).code === "23505") {
      return Math.abs(xpLog.xp_amount)
    }
    throw existingRevokeError
  }

  const nextXp = Math.max(0, Number(profile?.xp ?? 0) - Math.abs(xpLog.xp_amount))
  const { error: setError } = await supabaseAdmin
    .from("profiles")
    .update({ xp: nextXp } as never)
    .eq("id", userId)

  if (setError) {
    throw setError
  }

  return Math.abs(xpLog.xp_amount)
}

export async function syncObservationBadges(userId: string) {
  if (!supabaseAdmin) {
    throw new Error("服务暂时不可用")
  }

  const stats = await fetchObservationStats(userId)
  const managedBadgeIds = BADGES.filter((badge) => badge.seriesKey && OBSERVATION_BADGE_SERIES.has(badge.seriesKey)).map((badge) => badge.id)
  const earnedBadgeIds = BADGES.filter((badge) => {
    if (!badge.seriesKey || !OBSERVATION_BADGE_SERIES.has(badge.seriesKey)) {
      return false
    }
    return badge.condition(stats)
  }).map((badge) => badge.id)
  const earnedSet = new Set(earnedBadgeIds)

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId)
    .in("badge_id", managedBadgeIds)

  if (existingError) {
    throw existingError
  }

  const existingSet = new Set((existingRows ?? []).map((row) => row.badge_id))
  const toInsert = earnedBadgeIds.filter((badgeId) => !existingSet.has(badgeId))
  const toRevoke = [...existingSet].filter((badgeId) => !earnedSet.has(badgeId))

  if (toRevoke.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from("user_badges")
      .delete()
      .eq("user_id", userId)
      .in("badge_id", toRevoke)

    if (deleteError) {
      throw deleteError
    }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("user_badges")
      .upsert(
        toInsert.map((badgeId) => ({
          user_id: userId,
          badge_id: badgeId,
          unlocked_at: new Date().toISOString(),
        })) as never[],
        { onConflict: "user_id,badge_id", ignoreDuplicates: true },
      )

    if (insertError) {
      throw insertError
    }
  }

  return {
    observationsSubmitted: stats.observationsSubmitted ?? 0,
    nextBadgeThreshold: getNextThreshold(stats.observationsSubmitted ?? 0),
  }
}

export async function buildObservationRewardSummary(userId: string, observationId: number) {
  const xpAwarded = await awardObservationXp(userId, observationId)
  const badgeSummary = await syncObservationBadges(userId)

  return {
    xpAwarded,
    observationsSubmitted: badgeSummary.observationsSubmitted,
    nextBadgeThreshold: badgeSummary.nextBadgeThreshold,
  }
}

export async function rollbackObservationGamification(userId: string, observationId: number) {
  const xpRevoked = await revokeObservationXp(userId, observationId)
  const badgeSummary = await syncObservationBadges(userId)

  return {
    xpRevoked,
    observationsSubmitted: badgeSummary.observationsSubmitted,
    nextBadgeThreshold: badgeSummary.nextBadgeThreshold,
  }
}
