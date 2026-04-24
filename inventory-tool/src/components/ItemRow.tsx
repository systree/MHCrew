import React from 'react'
import { useInventoryStore } from '../store/inventoryStore'

interface Props { name: string }

export const ItemRow: React.FC<Props> = ({ name }) => {
  const { items, setQuantity } = useInventoryStore()
  const qty = items[name] || 0

  return (
    <div className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all duration-150 ${
      qty > 0 ? 'bg-brand-50 border-brand-200 shadow-item' : 'bg-warm-100 border-warm-200'
    }`}>
      <span className={`font-nunito text-base flex-1 mr-3 ${qty > 0 ? 'text-brand-800 font-semibold' : 'text-warm-700'}`}>
        {name}
      </span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setQuantity(name, qty - 1)}
          disabled={qty === 0}
          className="w-10 h-10 rounded-xl border-2 border-warm-200 flex items-center justify-center text-warm-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 text-xl font-bold"
        >
          −
        </button>
        <span className={`w-8 text-center font-outfit text-xl font-bold tabular-nums ${qty > 0 ? 'text-brand-700' : 'text-warm-400'}`}>
          {qty}
        </span>
        <button
          onClick={() => setQuantity(name, qty + 1)}
          className="w-10 h-10 rounded-xl border-2 border-brand-300 bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition-all active:scale-95 text-xl font-bold"
        >
          +
        </button>
      </div>
    </div>
  )
}
