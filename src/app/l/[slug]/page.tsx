import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export default async function MicrositePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.micrositeSlug, slug),
    with: { listing: true, brandKit: true },
  })

  if (!campaign || !campaign.micrositePublished) notFound()

  // Track view (fire-and-forget)
  db.update(campaigns)
    .set({ micrositeViews: (campaign.micrositeViews ?? 0) + 1 })
    .where(eq(campaigns.id, campaign.id))
    .catch(() => {})

  const listing = campaign.listing
  const bk = campaign.brandKit as any
  const address = listing
    ? [listing.address, listing.city, listing.state].filter(Boolean).join(', ')
    : 'Property'
  const price = listing?.price ? `$${Number(listing.price).toLocaleString()}` : ''
  const beds = listing?.bedrooms ?? 0
  const baths = listing?.bathrooms ?? 0
  const sqft = listing?.sqft?.toLocaleString() ?? ''
  const photos = (listing?.photos as string[]) ?? []
  const description = listing?.description ?? ''
  const primaryColor = bk?.primaryColor ?? '#1e3a5f'
  const accentColor = bk?.accentColor ?? '#c9a84c'
  const agentName = bk?.agentName ?? ''
  const agentTitle = bk?.agentTitle ?? 'REALTOR®'
  const agentPhone = bk?.agentPhone ?? ''
  const agentEmail = bk?.agentEmail ?? ''
  const agentPhoto = bk?.agentPhotoUrl ?? ''
  const logoUrl = bk?.logoUrl ?? ''
  const brokerageLogo = bk?.brokerageLogo ?? ''
  const brokerageName = bk?.brokerageName ?? ''
  const tagline = bk?.tagline ?? ''

  const facebookPosts = (campaign.facebookPosts as any[]) ?? []

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', background: '#f8fafc', minHeight: '100vh', margin: 0, padding: 0 }}>

      {/* Hero */}
      <div style={{ background: primaryColor, color: 'white' }}>
        {photos[0] && (
          <div style={{ height: '60vh', maxHeight: 520, overflow: 'hidden', position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[0]} alt="Property" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.6))' }} />
            <div style={{ position: 'absolute', bottom: 40, left: 40, right: 40 }}>
              <div style={{ fontSize: 11, letterSpacing: 4, color: accentColor, textTransform: 'uppercase', marginBottom: 10 }}>Just Listed</div>
              <h1 style={{ fontSize: 'clamp(24px,4vw,44px)', fontWeight: 800, color: 'white', margin: '0 0 8px', lineHeight: 1.2 }}>{address}</h1>
              <div style={{ fontSize: 'clamp(22px,3vw,36px)', fontWeight: 700, color: accentColor }}>{price}</div>
              {tagline && <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 8, fontStyle: 'italic' }}>{tagline}</div>}
            </div>
          </div>
        )}
        {!photos[0] && (
          <div style={{ padding: '60px 40px 40px' }}>
            <div style={{ fontSize: 11, letterSpacing: 4, color: accentColor, textTransform: 'uppercase', marginBottom: 10 }}>Just Listed</div>
            <h1 style={{ fontSize: 'clamp(24px,4vw,44px)', fontWeight: 800, color: 'white', margin: '0 0 8px' }}>{address}</h1>
            <div style={{ fontSize: 'clamp(22px,3vw,36px)', fontWeight: 700, color: accentColor }}>{price}</div>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '20px 40px', display: 'flex', gap: 48, flexWrap: 'wrap' }}>
        {[
          { label: 'Bedrooms', value: beds },
          { label: 'Bathrooms', value: baths },
          { label: 'Square Feet', value: sqft },
        ].filter(s => s.value).map(s => (
          <div key={s.label} style={{ textAlign: 'center', minWidth: 80 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: primaryColor }}>{s.value}</div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        {/* Description */}
        {description && (
          <div style={{ background: 'white', borderRadius: 16, padding: '32px 36px', marginBottom: 24, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ width: 32, height: 3, background: accentColor, borderRadius: 2 }} />
              <div style={{ fontSize: 10, letterSpacing: 3, color: accentColor, textTransform: 'uppercase', fontWeight: 700 }}>About this home</div>
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.85, color: '#374151', margin: 0 }}>{description}</p>
          </div>
        )}

        {/* Photo gallery */}
        {photos.length > 1 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {photos.slice(1, 7).map((photo, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={photo} alt={`Property photo ${i + 2}`}
                  style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 12 }} />
              ))}
            </div>
          </div>
        )}

        {/* Social copy - Week 1 Facebook post as featured content */}
        {facebookPosts[0] && (
          <div style={{ background: 'white', borderRadius: 16, padding: '32px 36px', marginBottom: 24, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ width: 32, height: 3, background: accentColor, borderRadius: 2 }} />
              <div style={{ fontSize: 10, letterSpacing: 3, color: accentColor, textTransform: 'uppercase', fontWeight: 700 }}>Property Highlights</div>
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: '#374151', margin: 0 }}>{facebookPosts[0].copy}</p>
          </div>
        )}

        {/* Agent card */}
        <div style={{ background: primaryColor, borderRadius: 16, padding: '28px 36px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {agentPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agentPhoto} alt={agentName} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />
            )}
            <div>
              {agentName && <div style={{ fontSize: 18, fontWeight: 700 }}>{agentName}</div>}
              {(agentTitle || brokerageName) && (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>
                  {agentTitle}{brokerageName ? ` · ${brokerageName}` : ''}
                </div>
              )}
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                {[agentPhone, agentEmail].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          {/* Logos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" style={{ height: 40, maxWidth: 110, objectFit: 'contain', opacity: 0.9 }} />
            )}
            {brokerageLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brokerageLogo} alt="Brokerage" style={{ height: 36, maxWidth: 100, objectFit: 'contain', opacity: 0.8 }} />
            )}
          </div>
        </div>

        {/* CTA */}
        {(agentPhone || agentEmail) && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: primaryColor, marginBottom: 16 }}>Schedule a Showing</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {agentPhone && (
                <a href={`tel:${agentPhone}`}
                  style={{ background: primaryColor, color: 'white', padding: '14px 32px', borderRadius: 10, fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
                  📞 {agentPhone}
                </a>
              )}
              {agentEmail && (
                <a href={`mailto:${agentEmail}?subject=Inquiry: ${address}`}
                  style={{ background: 'white', color: primaryColor, border: `2px solid ${primaryColor}`, padding: '14px 32px', borderRadius: 10, fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
                  ✉️ Email Agent
                </a>
              )}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 48, fontSize: 11, color: '#cbd5e1' }}>
          Powered by CampaignAI
        </div>
      </div>
    </div>
  )
}
