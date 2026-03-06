/**
 * Campaign Generation API — Complete Production Implementation
 * 1. Fetch listing from SimplyRETS MLS API
 * 2. Generate 6-week campaign via Claude AI
 * 3. Save to database
 * 4. Return results
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { campaigns, listings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getUserWithDetails, checkCampaignQuota, incrementCampaignUsage } from '@/lib/user-service'
import { z } from 'zod'
import { slugify } from '@/lib/utils'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const RequestSchema = z.object({
  mlsId: z.string().min(1).max(50),
})

// ── Fetch listing from SimplyRETS ─────────────────────────────

async function fetchMLSListing(mlsId: string) {
  const apiKey = process.env.SIMPLYRETS_API_KEY
  const apiSecret = process.env.SIMPLYRETS_API_SECRET

  // Use SimplyRETS test credentials if not configured
  const credentials = apiKey && apiSecret
    ? Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    : Buffer.from('simplyrets:simplyrets').toString('base64') // test credentials

  try {
    const res = await fetch(`https://api.simplyrets.com/properties/${mlsId}`, {
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      if (res.status === 404) throw new Error(`Listing ${mlsId} not found in MLS. Please check the ID and try again.`)
      throw new Error(`MLS API error: ${res.status}`)
    }

    return await res.json()
  } catch (err: any) {
    if (err.message.includes('not found') || err.message.includes('MLS API')) throw err
    throw new Error('Could not connect to MLS. Please try again.')
  }
}

// ── Build prompt for Claude ───────────────────────────────────

function buildCampaignPrompt(listing: any, brandKit?: any) {
  const address = `${listing.address?.deliveryLine || listing.address?.line1 || ''}, ${listing.address?.city || ''} ${listing.address?.state || ''}`.trim()
  const price = listing.listPrice ? `$${listing.listPrice.toLocaleString()}` : 'Price upon request'
  const beds = listing.property?.bedrooms ?? 0
  const baths = listing.property?.bathsFull ?? 0
  const sqft = listing.property?.area ?? 0
  const yearBuilt = listing.property?.yearBuilt ?? ''
  const propertyType = listing.property?.type ?? 'Residential'
  const description = listing.remarks ?? ''
  const features = listing.property?.features?.join(', ') ?? ''
  const neighborhood = listing.address?.city ?? ''
  const photos = listing.photos?.slice(0, 3).join(', ') ?? ''

  const agentName = brandKit?.agentName || listing.agent?.firstName ? `${listing.agent?.firstName} ${listing.agent?.lastName}`.trim() : 'Agent'
  const agentPhone = brandKit?.agentPhone || listing.agent?.contact?.office || ''
  const tone = brandKit?.aiPersona?.tone || 'professional'
  const tagline = brandKit?.tagline || ''
  const listingUrl = `https://campaignai.io/l/listing-${listing.mlsId}`

  const toneGuides: Record<string, string> = {
    professional: 'authoritative, data-driven, and polished. Focus on investment value and market position.',
    friendly: 'warm, conversational, and approachable. Speak directly to buyers lifestyle.',
    luxury: 'elevated, aspirational, and refined. Focus on prestige, exclusivity, and lifestyle.',
    energetic: 'enthusiastic, compelling, and urgent. Use active language and excitement.',
  }
  const toneGuide = toneGuides[tone] ?? toneGuides['professional']

  return `You are an expert real estate marketing copywriter. Generate a COMPLETE 6-week social media and email marketing campaign for this listing.

LISTING DETAILS:
- Address: ${address}
- Price: ${price}
- Bedrooms: ${beds} | Bathrooms: ${baths} | Sqft: ${sqft?.toLocaleString()}
- Year Built: ${yearBuilt} | Type: ${propertyType}
- Description: ${description}
- Key Features: ${features}
- Neighborhood: ${neighborhood}
- Listing URL: ${listingUrl}

AGENT INFO:
- Agent: ${agentName}
- Phone: ${agentPhone}
- Tagline: ${tagline}

TONE: Write in a ${toneGuide}

WEEK THEMES (use these exact themes):
Week 1: Launch — "Just Listed" excitement and first impressions
Week 2: Property Features — Highlight the best rooms and features
Week 3: Neighborhood & Lifestyle — Area amenities, schools, walkability
Week 4: Open House — Invite + social proof
Week 5: Investment Value — ROI, market position, comparable sales context
Week 6: Final Call — Create urgency, "Still Available"

Generate EXACTLY this JSON structure (no markdown, no explanation, just JSON):

{
  "facebook": [
    {
      "week": 1,
      "theme": "Just Listed",
      "copy": "Full Facebook post text here (150-250 words, engaging, includes listing URL: ${listingUrl})",
      "hashtags": ["realtor", "justlisted", "austinrealestate"]
    }
  ],
  "instagram": [
    {
      "week": 1,
      "caption": "Instagram caption here (100-150 words, punchy, visual-focused, includes listing URL at end)",
      "hashtags": ["justlisted", "realestate", "homeforsale", "austinhomes", "realestateagent", "newlisting", "househunting", "dreamhome"]
    }
  ],
  "emailJustListed": "Complete email body for Just Listed announcement (professional, 200-300 words, includes full property details and CTA)",
  "emailStillAvailable": "Complete email body for Still Available follow-up (creates urgency, 150-250 words)"
}

Rules:
- Include the listing URL (${listingUrl}) in EVERY Facebook post and Instagram caption
- Make hashtags relevant and local (include city/area)
- Each week must follow its theme strictly
- Emails should be formatted with clear paragraphs, ready to paste into Mailchimp
- Do NOT include markdown or code fences in the JSON
- Return ONLY valid JSON, nothing else`
}

// ── Main handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { mlsId } = RequestSchema.parse(body)

    // Check quota
    const quota = await checkCampaignQuota(userId)
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `You've used all ${quota.limit} campaigns this month. Upgrade to Pro for unlimited campaigns.`,
          quota,
        },
        { status: 403 }
      )
    }

    const user = await getUserWithDetails(userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const startMs = Date.now()

    // Fetch MLS listing
    let mlsData: any
    try {
      mlsData = await fetchMLSListing(mlsId)
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }

    // Cache listing in DB
    const address = [
      mlsData.address?.deliveryLine || mlsData.address?.line1,
      mlsData.address?.city,
      mlsData.address?.state,
    ].filter(Boolean).join(', ')

    let listingRecord
    const existingListing = await db.query.listings.findFirst({
      where: and(eq(listings.mlsId, mlsId), eq(listings.agentId, user.id)),
    })

    if (existingListing) {
      listingRecord = existingListing
    } else {
      const [newListing] = await db.insert(listings).values({
        mlsId,
        agentId: user.id,
        orgId: user.orgId ?? undefined,
        address: mlsData.address?.deliveryLine || mlsData.address?.line1,
        city: mlsData.address?.city,
        state: mlsData.address?.state,
        zip: mlsData.address?.postalCode,
        price: mlsData.listPrice?.toString(),
        bedrooms: mlsData.property?.bedrooms,
        bathrooms: mlsData.property?.bathsFull?.toString(),
        sqft: mlsData.property?.area,
        yearBuilt: mlsData.property?.yearBuilt,
        propertyType: mlsData.property?.type,
        description: mlsData.remarks,
        features: mlsData.property?.features ?? [],
        photos: mlsData.photos ?? [],
        rawData: mlsData,
        listingAgentName: `${mlsData.agent?.firstName ?? ''} ${mlsData.agent?.lastName ?? ''}`.trim(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24hr cache
      }).returning()
      listingRecord = newListing
    }

    // Create placeholder campaign record
    const micrositeSlug = `${slugify(address)}-${Date.now()}`
    const [campaignRecord] = await db.insert(campaigns).values({
      listingId: listingRecord.id,
      agentId: user.id,
      orgId: user.orgId ?? undefined,
      brandKitId: user.brandKit?.id ?? undefined,
      status: 'generating',
      micrositeSlug,
    }).returning()

    // Generate with Claude
    const prompt = buildCampaignPrompt(mlsData, user.brandKit)
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse JSON response
    let campaignContent: any
    try {
      // Strip any accidental markdown fences
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      campaignContent = JSON.parse(cleaned)
    } catch {
      throw new Error('Failed to parse AI response. Please try again.')
    }

    const generationMs = Date.now() - startMs

    // Save completed campaign
    await db.update(campaigns)
      .set({
        status: 'complete',
        generationMs,
        facebookPosts: campaignContent.facebook,
        instagramPosts: campaignContent.instagram,
        emailJustListed: campaignContent.emailJustListed,
        emailStillAvailable: campaignContent.emailStillAvailable,
        promptTokens: message.usage.input_tokens,
        completionTokens: message.usage.output_tokens,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignRecord.id))

    // Increment usage
    await incrementCampaignUsage(userId)

    return NextResponse.json({
      campaignId: campaignRecord.id,
      listing: {
        address,
        price: mlsData.listPrice ? `$${mlsData.listPrice.toLocaleString()}` : 'Price on request',
        beds: mlsData.property?.bedrooms ?? 0,
        baths: mlsData.property?.bathsFull ?? 0,
        sqft: mlsData.property?.area ?? 0,
      },
      facebook: campaignContent.facebook,
      instagram: campaignContent.instagram,
      emailJustListed: campaignContent.emailJustListed,
      emailStillAvailable: campaignContent.emailStillAvailable,
      generationMs,
    })

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid MLS ID format' }, { status: 400 })
    }
    console.error('Generation error:', err)
    return NextResponse.json(
      { error: err.message || 'Campaign generation failed. Please try again.' },
      { status: 500 }
    )
  }
}
