'use client'

export function PrintButton({ backUrl }: { backUrl: string }) {
  return (
    <div className="no-print fixed top-4 right-4 z-50 flex gap-3">
      <button
        onClick={() => window.print()}
        className="bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
      >
        🖨️ Print / Save PDF
      </button>
      <a href={backUrl} className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
        ← Back
      </a>
    </div>
  )
}
