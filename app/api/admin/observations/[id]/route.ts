import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { enqueueAutoInteractionsForTarget } from "@/lib/auto-interactions"
import { buildObservationRewardSummary, rollbackObservationGamification } from "@/lib/api/observation-gamification"
import { handleApiError, requireRole } from "@/lib/api/auth"
import { logger } from "@/lib/logger"
import { createClient } from "@/lib/supabase/server"
import { setContentModerationState } from "@/lib/safety/server"

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
    const { error: updateError } = await supabase
      .from("observation_events")
      .update({ status: nextStatus } as never)
      .eq("id", observationId)

    if (updateError) {
      throw updateError
    }
    await setContentModerationState('observation', observationId, nextStatus === 'approved' ? 'approved' : 'rejected')

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
