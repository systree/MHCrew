import React from 'react'
import { useInventoryStore } from '../store/inventoryStore'
import { StepButton } from '../components/StepButton'
import { mockTenant } from '../data/categories'
import { categories } from '../data/categories'

export const IntroStep: React.FC = () => {
  const nextStep = useInventoryStore(s => s.nextStep)

  return (
    <div className="px-5 pt-8 pb-10 max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-warm-900 mb-3">
          Let's get a picture of what's moving 📦
        </h1>
        <p className="text-warm-500 text-lg leading-relaxed">
          Take 3–5 minutes to tell us what furniture and items you'll be moving. This helps us send you an accurate quote.
        </p>
      </div>

      <div className="bg-warm-100 rounded-3xl border border-warm-200 shadow-card p-5 mb-8 space-y-4">
        {[
          { icon: '📱', title: 'Works on your phone', desc: 'No app needed — just tap through the rooms.' },
          { icon: '⏱️', title: 'Takes about 5 minutes', desc: "Go room by room. Skip any room that doesn't apply." },
          { icon: '✏️', title: 'You can edit as you go', desc: 'Change quantities and go back at any time.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="flex gap-4 items-start">
            <span className="text-2xl flex-shrink-0">{icon}</span>
            <div>
              <p className="font-semibold text-warm-800">{title}</p>
              <p className="text-warm-500 text-sm">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-brand-50 rounded-2xl border border-brand-200 p-4 mb-8">
        <p className="text-brand-500 text-sm">
          <span className="font-semibold">{categories.length} rooms to go through.</span> You can skip any room that doesn't apply.
        </p>
      </div>

      <StepButton onClick={nextStep} fullWidth>
        Get Started →
      </StepButton>

      <p className="text-center text-warm-400 text-sm mt-4">from {mockTenant.name}</p>
    </div>
  )
}
