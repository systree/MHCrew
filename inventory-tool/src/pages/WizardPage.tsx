import React, { useEffect } from 'react'
import { useInventoryStore } from '../store/inventoryStore'
import { IntroStep } from './IntroStep'
import { CategoryStep } from './CategoryStep'
import { ReviewStep } from './ReviewStep'
import { Header } from '../components/Header'
import { categories } from '../data/categories'
import { useSearchParams } from 'react-router-dom'

export const WizardPage: React.FC = () => {
  const { step, setContactInfo, setValid, setLoading } = useInventoryStore()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const c = searchParams.get('c') || ''
    const o = searchParams.get('o') || ''
    const t = searchParams.get('t') || ''
    setContactInfo(c, o, t)
    // Simulate validation
    setTimeout(() => {
      setValid(true)
      setLoading(false)
    }, 500)
  }, [])

  const renderStep = () => {
    if (step === 0) return <IntroStep />
    const catIndex = step - 1
    if (catIndex < categories.length) return <CategoryStep key={categories[catIndex].id} category={categories[catIndex]} categoryIndex={catIndex} />
    return <ReviewStep />
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
