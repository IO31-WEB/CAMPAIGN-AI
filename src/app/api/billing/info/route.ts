import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getDashboardStats } from '@/lib/user-service'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stats = await getDashboardStats(userId)
  if (!stats) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    planTier: stats.planTier,
    subscription: stats.subscription,
    organization: { name: stats.organization?.name, stripeCustomerId: stats.organization?.stripeCustomerId },
    campaignsThisMonth: stats.campaignsThisMonth,
    campaignLimit: stats.campaignLimit,
    daysUntilReset: stats.daysUntilReset,
  })
}
