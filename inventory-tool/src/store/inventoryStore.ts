import { create } from 'zustand'
import { categories } from '../data/categories'

interface InventoryState {
  step: number
  items: Record<string, number>  // itemName -> quantity
  notes: string
  contactId: string
  oppId: string
  tenantSlug: string
  isValid: boolean
  isLoading: boolean
  setStep: (s: number) => void
  nextStep: () => void
  prevStep: () => void
  setQuantity: (item: string, qty: number) => void
  setNotes: (n: string) => void
  setContactInfo: (c: string, o: string, t: string) => void
  setValid: (v: boolean) => void
  setLoading: (v: boolean) => void
  getTotalItems: () => number
  getStepProgress: () => number
}

const TOTAL_STEPS = categories.length + 2  // intro + categories + review

export const useInventoryStore = create<InventoryState>((set, get) => ({
  step: 0,
  items: {},
  notes: '',
  contactId: '',
  oppId: '',
  tenantSlug: '',
  isValid: false,
  isLoading: true,
  setStep: (step) => set({ step }),
  nextStep: () => set(s => ({ step: Math.min(s.step + 1, TOTAL_STEPS - 1) })),
  prevStep: () => set(s => ({ step: Math.max(s.step - 1, 0) })),
  setQuantity: (item, qty) => set(s => ({ items: { ...s.items, [item]: Math.max(0, qty) } })),
  setNotes: (notes) => set({ notes }),
  setContactInfo: (contactId, oppId, tenantSlug) => set({ contactId, oppId, tenantSlug }),
  setValid: (isValid) => set({ isValid }),
  setLoading: (isLoading) => set({ isLoading }),
  getTotalItems: () => Object.values(get().items).reduce((a, b) => a + b, 0),
  getStepProgress: () => get().step / (TOTAL_STEPS - 1),
}))
