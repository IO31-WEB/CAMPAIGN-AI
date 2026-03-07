import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkCampaignQuota } from '@/lib/user-service'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quota = await checkCampaignQuota(userId)
  const resetsAt = quota.resetsAt
  const now = new Date()
  const daysUntilReset = resetsAt
    ? Math.max(0, Math.ceil((resetsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  return NextResponse.json({
    planTier: quota.planTier,
    campaignsUsed: quota.used,
    campaignsThisMonth: quota.used,   // alias — billing page reads this field
    campaignLimit: quota.limit,
    allowed: quota.allowed,
    resetsAt: quota.resetsAt,
    daysUntilReset,
  })
}
