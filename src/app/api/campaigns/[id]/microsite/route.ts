import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { checkCampaignQuota } from '@/lib/user-service'
import { z } from 'zod'

const Schema = z.object({ publish: z.boolean() })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use checkCampaignQuota which syncs Clerk metadata → DB first
  const quota = await checkCampaignQuota(userId)
  const allowedTiers = ['pro', 'brokerage', 'enterprise']

  if (!allowedTiers.includes(quota.planTier)) {
    return NextResponse.json(
      { error: `Listing microsites require a Pro plan. You are on ${quota.planTier}. Please upgrade.` },
      { status: 403 }
    )
  }

  const { id } = await params
  const body = Schema.parse(await request.json())

  // Verify this campaign belongs to the user
  const existing = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, id)),
    with: { agent: true },
  })

  if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const [updated] = await db.update(campaigns)
    .set({ micrositePublished: body.publish, updatedAt: new Date() })
    .where(eq(campaigns.id, id))
    .returning()

  return NextResponse.json({ published: updated.micrositePublished })
}
