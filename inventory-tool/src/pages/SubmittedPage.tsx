import React from 'react'
import { mockTenant } from '../data/categories'

export const SubmittedPage: React.FC = () => (
  <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center px-6 font-outfit text-center">
    <div className="w-24 h-24 bg-emerald-900 rounded-full flex items-center justify-center mb-6">
      <svg width="48" height="48" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
    <h1 className="text-3xl font-bold text-warm-900 mb-3">Thanks! All done.</h1>
    <p className="text-warm-500 text-lg mb-2 max-w-sm leading-relaxed">
      Your inventory has been submitted. We'll use this to prepare your quote and be in touch shortly.
    </p>
    <div className="bg-warm-100 rounded-3xl border border-warm-200 shadow-card p-6 mt-8 w-full max-w-xs space-y-3">
      <p className="text-warm-500 text-sm font-medium">Questions? Contact us:</p>
      <a href={`tel:${mockTenant.phone}`} className="flex items-center gap-3 text-brand-600 font-semibold hover:text-brand-700">
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.07 12 19.79 19.79 0 011.07 3.4 2 2 0 013.05 1.25h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 9.17a16 16 0 006.29 6.29l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        {mockTenant.phone}
      </a>
      <a href={`mailto:${mockTenant.email}`} className="flex items-center gap-3 text-brand-600 font-semibold hover:text-brand-700">
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        {mockTenant.email}
      </a>
    </div>
  </div>
)
