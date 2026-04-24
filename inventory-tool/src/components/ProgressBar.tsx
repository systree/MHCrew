import React from 'react'
import { useInventoryStore } from '../store/inventoryStore'

export const ProgressBar: React.FC = () => {
  const progress = useInventoryStore(s => s.getStepProgress())
  return (
    <div className="h-1.5 bg-warm-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-brand-600 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
    </div>
  )
}
