import React from 'react'
import { useInventoryStore } from '../store/inventoryStore'
import { StepButton } from '../components/StepButton'
import { ItemRow } from '../components/ItemRow'
import type { Category } from '../types/inventory'

interface Props { category: Category; categoryIndex: number }

export const CategoryStep: React.FC<Props> = ({ category }) => {
  const { items, nextStep } = useInventoryStore()
  const total = category.items.reduce((acc, name) => acc + (items[name] || 0), 0)

  return (
    <div className="px-4 pt-6 pb-10 max-w-lg mx-auto">
      <div className="mb-5">
        <span className="text-5xl block mb-2">{category.emoji}</span>
        <h2 className="text-2xl font-bold text-warm-900">{category.name}</h2>
        {total > 0 && (
          <p className="text-brand-600 text-sm font-semibold mt-1">{total} item{total !== 1 ? 's' : ''} selected</p>
        )}
      </div>

      <div className="space-y-2 mb-6">
        {category.items.map(name => (
          <ItemRow key={name} name={name} />
        ))}
      </div>

      <div className="space-y-3">
        <StepButton onClick={nextStep} fullWidth>
          {total > 0 ? `Next — ${total} item${total !== 1 ? 's' : ''} added` : 'Next'}
        </StepButton>
        {total === 0 && (
          <StepButton onClick={nextStep} variant="ghost" fullWidth>
            Nothing in this room →
          </StepButton>
        )}
      </div>
    </div>
  )
}
