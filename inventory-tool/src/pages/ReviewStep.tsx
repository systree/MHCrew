import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventoryStore } from '../store/inventoryStore'
import { StepButton } from '../components/StepButton'
import { categories } from '../data/categories'

export const ReviewStep: React.FC = () => {
  const navigate = useNavigate()
  const { items, notes, setNotes, setStep, getTotalItems } = useInventoryStore()
  const [loading, setLoading] = useState(false)

  const activeCategories = categories.filter(cat =>
    cat.items.some(name => (items[name] || 0) > 0)
  )

  const handleSubmit = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1500))
    setLoading(false)
    navigate('/submitted')
  }

  // index of category step (step 0 = intro, step 1+ = categories)
  const getCategoryStep = (catId: string) => categories.findIndex(c => c.id === catId) + 1

  return (
    <div className="px-4 pt-6 pb-10 max-w-lg mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-warm-900">Review your items</h2>
        <p className="text-warm-500 text-sm mt-1">{getTotalItems()} items across {activeCategories.length} room{activeCategories.length !== 1 ? 's' : ''}</p>
      </div>

      {activeCategories.length === 0 ? (
        <div className="bg-warm-100 rounded-2xl p-6 text-center mb-6">
          <p className="text-warm-500">No items added yet. Go back to add some.</p>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {activeCategories.map(cat => {
            const catItems = cat.items.filter(name => (items[name] || 0) > 0)
            return (
              <div key={cat.id} className="bg-warm-100 rounded-2xl border border-warm-200 shadow-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200">
                  <span className="font-semibold text-warm-800">{cat.emoji} {cat.name}</span>
                  <button onClick={() => setStep(getCategoryStep(cat.id))}
                    className="text-brand-600 text-sm font-semibold hover:text-brand-700 min-h-[44px] px-2 flex items-center">
                    Edit
                  </button>
                </div>
                <div className="px-4 py-2 divide-y divide-warm-200">
                  {catItems.map(name => (
                    <div key={name} className="flex justify-between py-2">
                      <span className="font-nunito text-warm-700 text-sm">{name}</span>
                      <span className="font-semibold text-warm-900 text-sm">× {items[name]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Notes */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-warm-600 mb-2">Anything else to mention? <span className="text-warm-400 font-normal">(optional)</span></label>
        <textarea
          rows={3}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. There's a piano in the spare room, or items in a storage unit at a different address"
          className="w-full bg-warm-100 border border-warm-200 rounded-2xl px-4 py-3 text-warm-800 placeholder-warm-400 focus:border-brand-400 focus:outline-none text-sm font-nunito resize-none"
        />
      </div>

      <StepButton onClick={handleSubmit} fullWidth loading={loading}>
        {loading ? 'Submitting...' : 'Submit Inventory ✓'}
      </StepButton>

      <p className="text-center text-warm-400 text-xs mt-4">We'll use this to prepare your quote and be in touch shortly.</p>
    </div>
  )
}
