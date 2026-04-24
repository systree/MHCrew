import React from 'react'
import { ProgressBar } from './ProgressBar'
import { useInventoryStore } from '../store/inventoryStore'
import { mockTenant } from '../data/categories'

export const Header: React.FC = () => {
  const { step, prevStep } = useInventoryStore()
  const progress = Math.round(useInventoryStore(s => s.getStepProgress()) * 100)

  return (
    <header className="sticky top-0 z-30 bg-warm-100/95 backdrop-blur border-b border-warm-200 px-4 py-3">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-2">
          {step > 0 && (
            <button onClick={prevStep} className="p-2 -ml-2 text-warm-400 hover:text-warm-700 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
          )}
          <div className="flex items-center gap-2 flex-1">
            <img src="/logo.png" alt="MoverHero" className="w-8 h-8 rounded-lg flex-shrink-0" />
            <span className="font-outfit font-semibold text-warm-900 text-sm">{mockTenant.name}</span>
          </div>
          <span className="text-warm-400 text-sm font-medium">{progress}%</span>
        </div>
        <ProgressBar />
      </div>
    </header>
  )
}
