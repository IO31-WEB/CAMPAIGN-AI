import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getUserWithDetails } from '@/lib/user-service'
import { z } from 'zod'

const Schema = z.object({ publish: z.boolean() })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserWithDetails(userId)
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const planTier = user.organization?.plan ?? 'free'
  if (!['pro', 'brokerage', 'enterprise'].includes(planTier)) {
    return NextResponse.json(
      { error: 'Listing microsites require a Pro plan. Please upgrade.' },
      { status: 403 }
    )
  }

  const { id } = await params
  const body = Schema.parse(await request.json())

  const [updated] = await db.update(campaigns)
    .set({ micrositePublished: body.publish, updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.agentId, user.id)))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  return NextResponse.json({ published: updated.micrositePublished })
}
