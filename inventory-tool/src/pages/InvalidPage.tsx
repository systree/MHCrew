import React from 'react'
import { mockTenant } from '../data/categories'

export const InvalidPage: React.FC = () => (
  <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center px-6 font-outfit text-center">
    <div className="text-6xl mb-6">🔗</div>
    <h1 className="text-2xl font-bold text-warm-800 mb-2">This link is invalid or has expired</h1>
    <p className="text-warm-500 mb-8">Please contact your removalist for a new link.</p>
    <a href={`tel:${mockTenant.phone}`} className="text-brand-600 font-semibold text-lg">{mockTenant.phone}</a>
  </div>
)
