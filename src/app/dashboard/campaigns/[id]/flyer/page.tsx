import { auth } from '@clerk/nextjs/server'
import { PrintButton } from './print-button'
import { redirect } from 'next/navigation'
import { getCampaign } from '@/lib/user-service'

export default async function FlyerPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params
  const campaign = await getCampaign(id, userId)
  if (!campaign) redirect('/dashboard/campaigns')

  const listing = campaign.listing
  const address = listing ? `${listing.address ?? ''}, ${listing.city ?? ''} ${listing.state ?? ''}`.trim() : ''
  const price = listing?.price ? `$${Number(listing.price).toLocaleString()}` : ''
  const beds = listing?.bedrooms ?? 0
  const baths = listing?.bathrooms ?? 0
  const sqft = listing?.sqft?.toLocaleString() ?? ''
  const photos = (listing?.photos as string[]) ?? []
  const description = listing?.description ?? ''
  const agentName = campaign.brandKit?.agentName ?? ''
  const agentPhone = campaign.brandKit?.agentPhone ?? ''
  const primaryColor = campaign.brandKit?.primaryColor ?? '#0f172a'

  return (
    <>
      <style>{`
        @page { size: letter; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { margin: 0; font-family: Georgia, serif; background: white; }
      `}</style>

      <PrintButton backUrl={`/dashboard/campaigns/${id}`} />

      {/* Flyer — letter size 8.5×11 */}
      <div style={{ width: '8.5in', minHeight: '11in', margin: '0 auto', background: 'white', display: 'flex', flexDirection: 'column' }}>

        {/* Header bar */}
        <div style={{ background: primaryColor, color: 'white', padding: '24px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', fontFamily: 'Arial,sans-serif', letterSpacing: '3px', textTransform: 'uppercase', opacity: 0.7, marginBottom: '4px' }}>Just Listed</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', fontFamily: 'Arial,sans-serif' }}>{address}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', fontFamily: 'Arial,sans-serif', color: '#fbbf24' }}>{price}</div>
          </div>
        </div>

        {/* Main photo */}
        {photos[0] ? (
          <div style={{ height: '320px', overflow: 'hidden', position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[0]} alt="Property" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{ height: '320px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>🏡</div>
              <div style={{ fontFamily: 'Arial,sans-serif', fontSize: '14px' }}>Property Photo</div>
            </div>
          </div>
        )}

        {/* Stats bar */}
        <div style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', borderBottom: '2px solid #e2e8f0', padding: '16px 40px', display: 'flex', gap: '40px', fontFamily: 'Arial,sans-serif' }}>
          {[
            { label: 'BEDROOMS', value: beds || '—' },
            { label: 'BATHROOMS', value: baths || '—' },
            { label: 'SQ FT', value: sqft || '—' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: primaryColor }}>{s.value}</div>
              <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Description */}
        <div style={{ padding: '24px 40px', flex: 1 }}>
          <p style={{ fontFamily: 'Georgia,serif', fontSize: '14px', lineHeight: '1.8', color: '#374151', margin: 0 }}>
            {description || 'Contact us for more information about this exceptional property.'}
          </p>
        </div>

        {/* Secondary photos row */}
        {photos.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', padding: '0 40px 24px', height: '120px' }}>
            {photos.slice(1, 4).map((photo, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={photo} alt="" style={{ flex: 1, objectFit: 'cover', borderRadius: '8px', height: '100%' }} />
            ))}
          </div>
        )}

        {/* Footer / Agent info */}
        <div style={{ background: primaryColor, color: 'white', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
          <div style={{ fontFamily: 'Arial,sans-serif' }}>
            {agentName && <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{agentName}</div>}
            {agentPhone && <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '2px' }}>{agentPhone}</div>}
            {!agentName && <div style={{ fontSize: '13px', opacity: 0.7 }}>Contact us for a showing</div>}
          </div>
          <div style={{ fontFamily: 'Arial,sans-serif', textAlign: 'right', fontSize: '11px', opacity: 0.6 }}>
            Generated by CampaignAI
          </div>
        </div>
      </div>
    </>
  )
}
