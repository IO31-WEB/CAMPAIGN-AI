import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { stripe, PLANS } from '@/lib/stripe'
import { absoluteUrl } from '@/lib/utils'
import { getUserWithDetails } from '@/lib/user-service'
import { db } from '@/lib/db'
import { organizations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const RequestSchema = z.object({
  planId: z.enum(['starter', 'pro', 'brokerage']),
  billing: z.enum(['monthly', 'annual']),
})

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { planId, billing } = RequestSchema.parse(body)

    const clerkUser = await currentUser()
    const dbUser = await getUserWithDetails(userId)

    if (!dbUser?.organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    const plan = PLANS.find(p => p.id === planId)
    if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    const priceId = billing === 'annual' ? plan.yearlyPriceId : plan.monthlyPriceId
    if (!priceId) {
      return NextResponse.json(
        { error: 'Price not configured. Please contact support.' },
        { status: 500 }
      )
    }

    const org = dbUser.organization
    let customerId = org.stripeCustomerId

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: clerkUser?.emailAddresses[0]?.emailAddress || dbUser.email,
        name: `${dbUser.firstName ?? ''} ${dbUser.lastName ?? ''}`.trim() || dbUser.email,
        metadata: {
          orgId: org.id,
          clerkUserId: userId,
        },
      })
      customerId = customer.id

      await db.update(organizations)
        .set({ stripeCustomerId: customerId })
        .where(eq(organizations.id, org.id))
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: absoluteUrl('/dashboard/billing?success=true'),
      cancel_url: absoluteUrl('/dashboard/billing?canceled=true'),
      metadata: {
        orgId: org.id,
        clerkUserId: userId,
        planId,
        billing,
      },
      subscription_data: {
        trial_period_days: planId === 'brokerage' ? 14 : 0,
        metadata: {
          orgId: org.id,
          clerkUserId: userId,
          planId,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      tax_id_collection: { enabled: true },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
