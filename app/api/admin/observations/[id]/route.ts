import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { enqueueAutoInteractionsForTarget } from "@/lib/auto-interactions"
import { buildObservationRewardSummary, rollbackObservationGamification } from "@/lib/api/observation-gamification"
import { handleApiError, requireRole } from "@/lib/api/auth"
import { logger } from "@/lib/logger"
import { buildObservationApprovedNotice } from "@/lib/observations/approval-notification"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const ObservationAdminPatchSchema = z.object({
  status: z.enum(["approved", "rejected"]),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ["moderator", "admin"])
    const { id } = await params
    const observationId = Number(id)

    if (!Number.isInteger(observationId) || observationId <= 0) {
      return NextResponse.json({ error: "Invalid observation id" }, { status: 400 })
    }

    const body = await request.json()
    const parsed = ObservationAdminPatchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((issue) => issue.message).join(", ") }, { status: 400 })
    }

    const { data: existing, error: existingError } = await supabase
      .from("observation_events")
      .select("id, user_id, status")
      .eq("id", observationId)
      .maybeSingle()

    if (existingError) {
      throw existingError
    }

    if (!existing) {
      return NextResponse.json({ error: "Observation not found" }, { status: 404 })
    }

    const nextStatus = parsed.data.status
    if (!supabaseAdmin) {
      throw new Error("Observation review service is not configured")
    }

    const moderationState = nextStatus === "approved" ? "approved" : "rejected"
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("observation_events")
      .update({ status: nextStatus, moderation_state: moderationState } as never)
      .eq("id", observationId)
      .select("id, status, moderation_state")
      .maybeSingle()

    if (updateError) {
      throw updateError
    }
    if (!updated) {
      return NextResponse.json({ error: "Observation not found" }, { status: 404 })
    }

    let rewardSummary = null
    let rewardError = false
    let rollback = null
    if (existing.status !== "approved" && nextStatus === "approved") {
      try {
        rewardSummary = await buildObservationRewardSummary(existing.user_id, observationId)
      } catch (error) {
        rewardError = true
        logger.error(error, {
          context: "Observation reward failed after approval",
          observationId,
        })
      }

      // 审核通过：站内通知本人（经验、图鉴点亮、下一次去找什么）。失败不影响审核结果。
      try {
        const { data: detail } = await supabaseAdmin
          .from("observation_events")
          .select("nature_topic, suggested_species_name, observation_event_species(species(common_name))")
          .eq("id", observationId)
          .maybeSingle()
        const row = detail as {
          nature_topic?: string | null
          suggested_species_name?: string | null
          observation_event_species?: { species?: { common_name?: string | null } | null }[] | null
        } | null
        const speciesName = row?.observation_event_species?.[0]?.species?.common_name ?? row?.suggested_species_name ?? null
        const notice = buildObservationApprovedNotice({
          speciesName,
          topic: row?.nature_topic ?? null,
          xpAwarded: rewardSummary?.xpAwarded ?? null,
        })
        const { error: notifyError } = await supabaseAdmin.from("notifications").insert({
          user_id: existing.user_id,
          type: "system",
          title: notice.title,
          content: notice.content,
          related_type: "observation",
          related_id: observationId,
        } as never)
        if (notifyError) throw notifyError
      } catch (notifyError) {
        logger.error(notifyError, { context: "Observation approval notification failed", observationId })
      }

      try {
        await enqueueAutoInteractionsForTarget("observation", observationId)
      } catch (autoInteractionError) {
        logger.error(autoInteractionError, {
          context: "Observation auto interaction enqueue failed after approval",
          observationId,
        })
      }
    }

    if (existing.status === "approved" && nextStatus !== "approved") {
      rollback = await rollbackObservationGamification(existing.user_id, observationId)
    }

    return NextResponse.json({ ok: true, rewardSummary, rewardError, rollback })
  } catch (error) {
    return handleApiError(error)
  }
}
