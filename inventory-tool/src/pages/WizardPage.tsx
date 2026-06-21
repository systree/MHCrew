import React, { useEffect, useRef } from 'react'
import { useInventoryStore } from '../store/inventoryStore'
import { IntroStep } from './IntroStep'
import { CategoryStep } from './CategoryStep'
import { ReviewStep } from './ReviewStep'
import { Header } from '../components/Header'
import { categories } from '../data/categories'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { inventoryApi } from '../services/api'

export const WizardPage: React.FC = () => {
  const { step, items, notes, isLoading } = useInventoryStore()
  const { setToken, setCompanyName, hydrateDraft, setValid, setLoading } = useInventoryStore()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // --- Validate the link token and hydrate branding + saved draft on load ---
  useEffect(() => {
    const k = searchParams.get('k') || ''
    if (!k) { navigate('/invalid'); return }

    setToken(k)
    inventoryApi.session(k)
      .then((res) => {
        setCompanyName(res.tenant?.companyName ?? null)
        if (res.draft) hydrateDraft(res.draft.items, res.draft.notes, res.draft.step)
        setValid(true)
        setLoading(false)
      })
      .catch(() => navigate('/invalid'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Debounced autosave of items/notes once the session is valid ---
  const firstRun = useRef(true)
  useEffect(() => {
    if (isLoading) return
    if (firstRun.current) { firstRun.current = false; return } // skip the hydrate pass
    const token = useInventoryStore.getState().token
    if (!token) return
    const t = setTimeout(() => {
      inventoryApi.saveDraft(token, items, notes, step).catch(() => { /* autosave is best-effort */ })
    }, 1000)
    return () => clearTimeout(t)
  }, [items, notes, step, isLoading])

  const renderStep = () => {
    if (step === 0) return <IntroStep />
    const catIndex = step - 1
    if (catIndex < categories.length) return <CategoryStep key={categories[catIndex].id} category={categories[catIndex]} categoryIndex={catIndex} />
    return <ReviewStep />
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <Header />
      <div className="max-w-lg mx-auto">
        {renderStep()}
      </div>
    </div>
  )
}
