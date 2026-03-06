/**
 * Stripe Webhook Handler — Complete production implementation
 * Handles all subscription lifecycle events
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { organizations, subscriptions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { syncSubscription, downgradeToFree } from '@/lib/user-service'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

// Map Stripe price IDs to plan tiers
function getPlanFromPriceId(priceId: string): 'starter' | 'pro' | 'brokerage' | 'enterprise' | 'free' {
  const map: Record<string, 'starter' | 'pro' | 'brokerage' | 'enterprise'> = {
    [process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || '']: 'starter',
    [process.env.STRIPE_STARTER_YEARLY_PRICE_ID || '']: 'starter',
    [process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '']: 'pro',
    [process.env.STRIPE_PRO_YEARLY_PRICE_ID || '']: 'pro',
    [process.env.STRIPE_BROKERAGE_MONTHLY_PRICE_ID || '']: 'brokerage',
    [process.env.STRIPE_BROKERAGE_YEARLY_PRICE_ID || '']: 'brokerage',
  }
  return map[priceId] ?? 'free'
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { orgId, planId } = session.metadata || {}

        if (!orgId) {
          console.error('checkout.session.completed: missing orgId in metadata')
          break
        }

        // Update Stripe customer ID on org
        if (session.customer) {
          await db.update(organizations)
            .set({ stripeCustomerId: session.customer as string })
            .where(eq(organizations.id, orgId))
        }

        console.log(`✅ Checkout complete — org: ${orgId}, plan: ${planId}`)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.orgId

        if (!orgId) {
          // Try to find org by stripe customer ID
          const customer = await stripe.customers.retrieve(sub.customer as string)
          if ('deleted' in customer) break

          const org = await db.query.organizations.findFirst({
            where: eq(organizations.stripeCustomerId, sub.customer as string),
          })

          if (!org) {
            console.error(`No org found for customer ${sub.customer}`)
            break
          }

          const priceId = sub.items.data[0]?.price.id ?? ''
          const plan = getPlanFromPriceId(priceId)

          await syncSubscription(org.id, {
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            plan,
            status: sub.status as any,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          })
          break
        }

        const priceId = sub.items.data[0]?.price.id ?? ''
        const plan = getPlanFromPriceId(priceId)

        await syncSubscription(orgId, {
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          plan,
          status: sub.status as any,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        })

        // Update max agents per plan
        const agentLimits: Record<string, number> = {
          starter: 1, pro: 3, brokerage: 25, enterprise: 999,
        }
        await db.update(organizations)
          .set({ maxAgents: agentLimits[plan] ?? 1 })
          .where(eq(organizations.id, orgId))

        console.log(`📋 Subscription ${event.type}: ${sub.id}, plan: ${plan}`)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.orgId

        if (orgId) {
          await downgradeToFree(orgId)
          console.log(`❌ Subscription canceled, org ${orgId} downgraded to free`)
        } else {
          // Find by stripe customer
          const org = await db.query.organizations.findFirst({
            where: eq(organizations.stripeCustomerId, sub.customer as string),
          })
          if (org) {
            await downgradeToFree(org.id)
            console.log(`❌ Subscription canceled, org ${org.id} downgraded to free`)
          }
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        // Update subscription status to active on successful payment
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
          const org = await db.query.organizations.findFirst({
            where: eq(organizations.stripeCustomerId, invoice.customer as string),
          })
          if (org) {
            await db.update(subscriptions)
              .set({ status: 'active', updatedAt: new Date() })
              .where(eq(subscriptions.orgId, org.id))
          }
        }
        console.log(`💳 Payment succeeded: ${invoice.id}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const org = await db.query.organizations.findFirst({
          where: eq(organizations.stripeCustomerId, invoice.customer as string),
        })
        if (org) {
          await db.update(subscriptions)
            .set({ status: 'past_due', updatedAt: new Date() })
            .where(eq(subscriptions.orgId, org.id))
        }
        // TODO: Trigger dunning email via Resend
        console.warn(`⚠️ Payment failed: ${invoice.id}`)
        break
      }

      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription
        // TODO: Send trial ending reminder via Resend
        console.log(`⏰ Trial ending soon: ${sub.id}`)
        break
      }

      default:
        // Silently ignore unhandled events
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
