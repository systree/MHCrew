import { create } from 'zustand'
import { categories, mockTenant } from '../data/categories'
import { getItemVolume, PACKING_FACTOR } from '../data/dimensions'
import type { TenantInfo } from '../types/inventory'

interface InventoryState {
  step: number
  items: Record<string, number>  // itemName -> quantity
  notes: string
  token: string
  tenant: TenantInfo             // branding; company name resolved from the backend session
  isValid: boolean
  isLoading: boolean
  setStep: (s: number) => void
  nextStep: () => void
  prevStep: () => void
  setQuantity: (item: string, qty: number) => void
  setNotes: (n: string) => void
  setToken: (t: string) => void
  setCompanyName: (name: string | null) => void
  hydrateDraft: (items: Record<string, number>, notes: string) => void
  setValid: (v: boolean) => void
  setLoading: (v: boolean) => void
  getTotalItems: () => number
  getTotalVolume: () => number  // total cubic metres (m³), incl. packing factor
  getStepProgress: () => number
}

const TOTAL_STEPS = categories.length + 2  // intro + categories + review

export const useInventoryStore = create<InventoryState>((set, get) => ({
  step: 0,
  items: {},
  notes: '',
  token: '',
  tenant: mockTenant,
  isValid: false,
  isLoading: true,
  setStep: (step) => set({ step }),
  nextStep: () => set(s => ({ step: Math.min(s.step + 1, TOTAL_STEPS - 1) })),
  prevStep: () => set(s => ({ step: Math.max(s.step - 1, 0) })),
  setQuantity: (item, qty) => set(s => ({ items: { ...s.items, [item]: Math.max(0, qty) } })),
  setNotes: (notes) => set({ notes }),
  setToken: (token) => set({ token }),
  setCompanyName: (name) => set(s => ({ tenant: { ...s.tenant, name: name || s.tenant.name } })),
  hydrateDraft: (items, notes) => set({ items: items ?? {}, notes: notes ?? '' }),
  setValid: (isValid) => set({ isValid }),
  setLoading: (isLoading) => set({ isLoading }),
  getTotalItems: () => Object.values(get().items).reduce((a, b) => a + b, 0),
  getTotalVolume: () => {
    const raw = Object.entries(get().items)
      .reduce((sum, [name, qty]) => sum + getItemVolume(name) * qty, 0)
    return raw * PACKING_FACTOR
  },
  getStepProgress: () => get().step / (TOTAL_STEPS - 1),
}))
