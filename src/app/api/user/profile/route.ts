import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserWithDetails, updateUserProfile } from '@/lib/user-service'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await getUserWithDetails(userId)
  return NextResponse.json({ user })
}

const ProfileSchema = z.object({
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  phone: z.string().max(30).optional(),
  licenseNumber: z.string().max(50).optional(),
  mlsAgentId: z.string().max(50).optional(),
  timezone: z.string().max(50).optional(),
  onboardingComplete: z.boolean().optional(),
})

export async function PATCH(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = ProfileSchema.parse(body)
    const user = await updateUserProfile(userId, data)
    return NextResponse.json({ user, success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
