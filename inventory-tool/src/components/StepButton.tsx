import React from 'react'

interface Props {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'ghost'
  children: React.ReactNode
  fullWidth?: boolean
}

export const StepButton: React.FC<Props> = ({ onClick, disabled, loading, variant = 'primary', children, fullWidth }) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`
      flex items-center justify-center gap-2 rounded-2xl font-outfit font-semibold text-lg
      min-h-[56px] px-6 transition-all duration-150 active:scale-[0.98]
      disabled:opacity-40 disabled:cursor-not-allowed
      ${fullWidth ? 'w-full' : ''}
      ${variant === 'primary' ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-black/40' : 'border-2 border-warm-200 text-warm-500 hover:border-warm-300 hover:text-warm-700'}
    `}
  >
    {loading ? (
      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ) : null}
    {children}
  </button>
)
