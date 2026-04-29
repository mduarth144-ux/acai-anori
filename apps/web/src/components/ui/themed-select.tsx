'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

export type ThemedSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type ThemedSelectProps = {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  options: ThemedSelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function ThemedSelect({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  className = '',
  disabled = false,
}: ThemedSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  )

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) setOpen(false)
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={[
          'themed-select-trigger border-acai-600 bg-acai-950/80 text-acai-50 focus-visible:border-fuchsia-500 focus-visible:ring-fuchsia-500/50 hover:border-fuchsia-600 flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left shadow-sm transition',
          'focus:outline-none focus-visible:ring-2',
          disabled ? 'cursor-not-allowed opacity-70' : '',
          open ? 'border-fuchsia-500 ring-1 ring-fuchsia-500/50' : '',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={['themed-select-value', selected ? 'text-acai-50' : 'text-acai-400'].join(' ')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`themed-select-chevron h-4 w-4 text-fuchsia-300 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="themed-select-dropdown border-acai-600 bg-acai-950/95 absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border p-1 shadow-2xl backdrop-blur">
          <ul role="listbox" className="space-y-0.5">
            {options.map((option) => {
              const isSelected = option.value === value
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onClick={() => {
                      if (option.disabled) return
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className={[
                      'themed-select-option',
                      'w-full rounded-lg px-3 py-2 text-left text-sm transition',
                      option.disabled
                        ? 'cursor-not-allowed opacity-50'
                        : isSelected
                          ? 'bg-fuchsia-700/80 text-white'
                          : 'text-acai-100 hover:bg-acai-800',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
