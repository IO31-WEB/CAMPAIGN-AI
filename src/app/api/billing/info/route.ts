import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkCampaignQuota } from '@/lib/user-service'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // checkCampaignQuota already syncs Clerk metadata → DB
  const quota = await checkCampaignQuota(userId)

  return NextResponse.json({
    planTier: quota.planTier,
    campaignsUsed: quota.used,
    campaignLimit: quota.limit,
    allowed: quota.allowed,
    resetsAt: quota.resetsAt,
  })
}
