'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Copy, Check, Download, Share2, ExternalLink,
  Facebook, Instagram, Mail, Printer, ChevronDown, ChevronUp,
  Zap, Eye, Globe, Lock, Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Campaign {
  id: string
  status: string
  createdAt: string
  generationMs?: number
  micrositeSlug?: string
  micrositePublished?: boolean
  micrositeViews?: number
  facebookPosts?: Array<{ week: number; theme: string; copy: string; hashtags?: string[] }>
  instagramPosts?: Array<{ week: number; caption: string; hashtags: string[] }>
  emailJustListed?: string
  emailStillAvailable?: string
  flyerUrl?: string
  videoScript?: string
  listing?: {
    address?: string; city?: string; state?: string; price?: string
    bedrooms?: number; bathrooms?: string; sqft?: number; photos?: string[]
    description?: string
  }
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-all">
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {label || (copied ? 'Copied!' : 'Copy')}
    </button>
  )
}

function Section({ title, badge, icon: Icon, children }: {
  title: string; badge?: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <span className="font-display font-semibold text-slate-900">{title}</span>
            {badge && <span className="ml-2 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{badge}</span>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  )
}

export default function CampaignDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    fetchCampaign()
  }, [id])

  const fetchCampaign = async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}`)
      if (!res.ok) {
        if (res.status === 404) router.push('/dashboard/campaigns')
        throw new Error('Not found')
      }
      const data = await res.json()
      setCampaign(data.campaign)
    } catch {
      toast.error('Could not load campaign')
    } finally {
      setLoading(false)
    }
  }

  const toggleMicrosite = async () => {
    if (!campaign) return
    setPublishing(true)
    try {
      const res = await fetch(`/api/campaigns/${id}/microsite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: !campaign.micrositePublished }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setCampaign(prev => prev ? { ...prev, micrositePublished: data.published } : prev)
      toast.success(data.published ? 'Microsite published!' : 'Microsite unpublished')
    } catch {
      toast.error('Failed to update microsite')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    )
  }

  if (!campaign) return null

  const address = [campaign.listing?.address, campaign.listing?.city, campaign.listing?.state].filter(Boolean).join(', ')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back + Header */}
      <div>
        <Link href="/dashboard/campaigns" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Campaigns
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900">{address || 'Campaign'}</h1>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
              {campaign.listing?.price && <span>${Number(campaign.listing.price).toLocaleString()}</span>}
              {campaign.listing?.bedrooms && <span>{campaign.listing.bedrooms} bd</span>}
              {campaign.listing?.bathrooms && <span>{campaign.listing.bathrooms} ba</span>}
              {campaign.listing?.sqft && <span>{campaign.listing.sqft?.toLocaleString()} sqft</span>}
              <span className={`px-2 py-0.5 rounded-full capitalize font-medium ${campaign.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {campaign.status}
              </span>
              {campaign.generationMs && (
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" />Generated in {(campaign.generationMs / 1000).toFixed(1)}s</span>
              )}
            </div>
          </div>

          {/* Microsite toggle */}
          <div className="flex items-center gap-2">
            {campaign.micrositeSlug && campaign.micrositePublished && (
              <a
                href={`/l/${campaign.micrositeSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                View Microsite ({campaign.micrositeViews ?? 0} views)
              </a>
            )}
            {campaign.micrositeSlug && (
              <button
                onClick={toggleMicrosite}
                disabled={publishing}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${campaign.micrositePublished ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
              >
                {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : campaign.micrositePublished ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                {publishing ? 'Updating...' : campaign.micrositePublished ? 'Unpublish' : 'Publish Microsite'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Facebook Posts */}
      {campaign.facebookPosts && campaign.facebookPosts.length > 0 && (
        <Section title="Facebook Posts" badge={`${campaign.facebookPosts.length} posts`} icon={Facebook}>
          <div className="divide-y divide-slate-100">
            {campaign.facebookPosts.map((post, i) => (
              <div key={i} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Week {post.week}</span>
                    <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">{post.theme}</span>
                  </div>
                  <CopyButton text={post.copy} />
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{post.copy}</p>
                {post.hashtags && post.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {post.hashtags.map((tag, j) => (
                      <span key={j} className="text-xs text-blue-600">#{tag.replace('#', '')}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <CopyButton
              text={campaign.facebookPosts.map(p => `Week ${p.week} — ${p.theme}\n\n${p.copy}`).join('\n\n---\n\n')}
              label="Copy All Facebook Posts"
            />
          </div>
        </Section>
      )}

      {/* Instagram Posts */}
      {campaign.instagramPosts && campaign.instagramPosts.length > 0 && (
        <Section title="Instagram Captions" badge={`${campaign.instagramPosts.length} posts`} icon={Instagram}>
          <div className="divide-y divide-slate-100">
            {campaign.instagramPosts.map((post, i) => (
              <div key={i} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Week {post.week}</span>
                  <CopyButton text={`${post.caption}\n\n${post.hashtags.join(' ')}`} />
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{post.caption}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {post.hashtags.map((tag, j) => (
                    <span key={j} className="text-xs text-blue-600">{tag.startsWith('#') ? tag : `#${tag}`}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <CopyButton
              text={campaign.instagramPosts.map(p => `${p.caption}\n\n${p.hashtags.join(' ')}`).join('\n\n---\n\n')}
              label="Copy All Instagram Captions"
            />
          </div>
        </Section>
      )}

      {/* Emails */}
      {(campaign.emailJustListed || campaign.emailStillAvailable) && (
        <Section title="Email Copy" badge="2 templates" icon={Mail}>
          <div className="divide-y divide-slate-100">
            {campaign.emailJustListed && (
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm text-slate-900">Just Listed Email</span>
                  <CopyButton text={campaign.emailJustListed} />
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-serif border border-slate-100">
                  {campaign.emailJustListed}
                </div>
              </div>
            )}
            {campaign.emailStillAvailable && (
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm text-slate-900">Still Available Email</span>
                  <CopyButton text={campaign.emailStillAvailable} />
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-serif border border-slate-100">
                  {campaign.emailStillAvailable}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Flyer */}
      {campaign.flyerUrl && (
        <Section title="Print-Ready Flyer" badge="PDF" icon={Printer}>
          <div className="p-5 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-600">Your print-ready listing flyer is ready to download or print.</p>
            <a
              href={campaign.flyerUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </a>
          </div>
        </Section>
      )}

      {/* Video Script */}
      {campaign.videoScript && (
        <Section title="Video / Reel Script" badge="Pro" icon={Zap}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500">Optimized for Instagram Reels & TikTok</span>
              <CopyButton text={campaign.videoScript} />
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap border border-slate-100">
              {campaign.videoScript}
            </div>
          </div>
        </Section>
      )}
    </div>
  )
}
