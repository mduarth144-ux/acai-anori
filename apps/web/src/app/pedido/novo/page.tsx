'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '../../../store/cart-store'
import {
  buildDeliveryAddressLine,
  fetchViaCep,
  formatCepDisplay,
  onlyDigits,
} from '../../../lib/cep-viacep'

type GeoStatus = 'idle' | 'pending' | 'ok' | 'denied' | 'error' | 'unavailable'
const CHECKOUT_PROFILE_STORAGE_KEY = 'checkout.profile.v1'

export default function NovoPedidoPage() {
  const router = useRouter()
  const [tableCode, setTableCode] = useState<string | null>(null)
  const [tableNumber, setTableNumber] = useState('')
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1)
  const [paymentTab, setPaymentTab] = useState<'ONLINE' | 'DELIVERY'>('DELIVERY')
  const cart = useCartStore((state) => state.items)
  const total = useCartStore((state) => state.total)
  const clearCart = useCartStore((state) => state.clearCart)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [cepDigits, setCepDigits] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [notes, setNotes] = useState('')
  const [type, setType] = useState<'TABLE' | 'DELIVERY' | 'PICKUP'>('DELIVERY')
  const [paymentMethod, setPaymentMethod] = useState<
    'CASH' | 'DEBIT' | 'CREDIT' | 'PIX'
  >('PIX')
  const [changeFor, setChangeFor] = useState('')
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')
  const [cepLoading, setCepLoading] = useState(false)
  const [cepNotFound, setCepNotFound] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const lastViaCepFetch = useRef('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(CHECKOUT_PROFILE_STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as {
        customerName?: string
        customerPhone?: string
        cepDigits?: string
        street?: string
        number?: string
        neighborhood?: string
      }
      if (saved.customerName) setCustomerName(saved.customerName)
      if (saved.customerPhone) setCustomerPhone(saved.customerPhone)
      if (saved.cepDigits) setCepDigits(onlyDigits(saved.cepDigits, 8))
      if (saved.street) setStreet(saved.street)
      if (saved.number) setNumber(saved.number)
      if (saved.neighborhood) setNeighborhood(saved.neighborhood)
    } catch {
      // Ignore invalid storage payloads and continue with empty form.
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        CHECKOUT_PROFILE_STORAGE_KEY,
        JSON.stringify({
          customerName,
          customerPhone,
          cepDigits,
          street,
          number,
          neighborhood,
        })
      )
    } catch {
      // Ignore storage quota/availability errors to avoid blocking checkout.
    }
  }, [customerName, customerPhone, cepDigits, street, number, neighborhood])

  const address = useMemo(
    () => buildDeliveryAddressLine({ cepDigits, street, number, neighborhood }),
    [cepDigits, street, number, neighborhood]
  )

  const tryGeolocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('unavailable')
      return
    }
    setGeoStatus('pending')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const r = await fetch(
            `/api/geocode/reverse?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`
          )
          if (!r.ok) throw new Error('reverse failed')
          const d = (await r.json()) as {
            street?: string
            neighborhood?: string
            cepDigits?: string
          }
          if (d.cepDigits) setCepDigits(d.cepDigits)
          if (d.street) setStreet((s) => s || d.street!)
          if (d.neighborhood) setNeighborhood((n) => n || d.neighborhood!)
          setGeoStatus('ok')
        } catch {
          setGeoStatus('error')
        }
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 15_000 }
    )
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mesa = new URLSearchParams(window.location.search).get('mesa')
    if (mesa) {
      setTableCode(mesa)
      const parsed = mesa.match(/^mesa-(\d+)$/)
      if (parsed?.[1]) setTableNumber(parsed[1])
      setType('TABLE')
      return
    }
    tryGeolocation()
  }, [tryGeolocation])

  const change = useMemo(() => {
    const value = Number(changeFor || 0)
    const orderTotal = total()
    if (!value || value < orderTotal) return 0
    return value - orderTotal
  }, [changeFor, total])

  const lookupCep = useCallback(
    async (explicitDigits?: string) => {
      const digits = onlyDigits(explicitDigits ?? cepDigits, 8)
      setCepDigits(digits)
      if (digits.length !== 8) {
        setCepNotFound(false)
        return
      }
      if (lastViaCepFetch.current === digits) return
      lastViaCepFetch.current = digits
      setCepLoading(true)
      setCepNotFound(false)
      try {
        const data = await fetchViaCep(digits)
        if (!data) {
          setCepNotFound(true)
          return
        }
        if (data.logradouro) setStreet(data.logradouro)
        if (data.bairro) setNeighborhood(data.bairro)
      } catch {
        setCepNotFound(true)
        lastViaCepFetch.current = ''
      } finally {
        setCepLoading(false)
      }
    },
    [cepDigits]
  )

  useEffect(() => {
    const d = onlyDigits(cepDigits, 8)
    if (d.length !== 8) return
    const tid = setTimeout(() => {
      void lookupCep(d)
    }, 450)
    return () => clearTimeout(tid)
  }, [cepDigits, lookupCep])

  async function submitOrder() {
    setSubmitError(null)
    if (type !== 'TABLE' && paymentTab === 'ONLINE') {
      setSubmitError(
        'Pagamento online ainda não está disponível. Selecione a aba "Na entrega".'
      )
      return
    }

    const computedTableCode =
      type === 'TABLE'
        ? tableCode ?? (tableNumber.trim() ? `mesa-${tableNumber.trim()}` : null)
        : null

    if (type === 'TABLE' && !computedTableCode) {
      setSubmitError('Informe o número da mesa para continuar.')
      return
    }

    if (type === 'DELIVERY') {
      const d = onlyDigits(cepDigits, 8)
      if (d.length !== 8 || !street.trim() || !neighborhood.trim()) {
        setSubmitError(
          'Para entrega, preencha o CEP (8 dígitos), a rua e o bairro.'
        )
        return
      }
    }

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        tableCode: computedTableCode,
        paymentMethod: type === 'TABLE' ? 'PIX' : paymentMethod,
        changeFor:
          type !== 'TABLE' && paymentMethod === 'CASH'
            ? Number(changeFor || 0)
            : undefined,
        customerName,
        customerPhone,
        address: type === 'DELIVERY' ? address : undefined,
        notes,
        items: cart,
      }),
    })

    if (!response.ok) return
    const data = await response.json()
    clearCart()
    router.push(`/pedido/${data.id}`)
  }

  const geoMessage = (() => {
    switch (geoStatus) {
      case 'pending':
        return 'Obtendo localização…'
      case 'ok':
        return 'Localização obtida; confira e ajuste o endereço abaixo.'
      case 'denied':
        return 'Permissão de localização negada. Preencha o CEP manualmente.'
      case 'error':
        return 'Não foi possível converter a localização em endereço. Use o CEP.'
      case 'unavailable':
        return 'Geolocalização não disponível neste aparelho.'
      default:
        return null
    }
  })()

  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-2xl font-bold text-fuchsia-100">
        Finalizar pedido
      </h1>

      {cart.length > 0 && (
        <div className="border-acai-600 bg-acai-800/90 mb-4 rounded-2xl border p-4 shadow-lg">
          <button
            type="button"
            onClick={() => setIsSummaryOpen((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3"
            aria-expanded={isSummaryOpen}
          >
            <h2 className="text-left text-sm font-semibold uppercase tracking-wide text-fuchsia-400">
              {isSummaryOpen
                ? 'Resumo do pedido'
                : `Resumo do pedido - R$ ${total().toFixed(2)}`}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-xl border border-acai-500 bg-acai-900/70 px-2 py-1 text-[11px] font-medium text-fuchsia-200">
              <span
                className={`transition-transform duration-300 ${
                  isSummaryOpen ? 'rotate-180' : 'rotate-0'
                }`}
                aria-hidden
              >
                ▼
              </span>
              Ver itens
            </span>
          </button>
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              isSummaryOpen ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="divide-acai-600 flex flex-col divide-y">
                {cart.map((item) => {
                  const itemId = item.id ?? item.productId
                  const itemTotal =
                    (item.unitPrice +
                      (item.choices?.reduce(
                        (c: number, x: { priceModifier: number }) =>
                          c + x.priceModifier,
                        0
                      ) ?? 0)) *
                    item.quantity
                  return (
                    <div
                      key={itemId}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <span className="text-acai-200 min-w-0 flex-1">
                        <span className="mr-2 font-semibold text-fuchsia-300">
                          {item.quantity}×
                        </span>
                        {item.name}
                      </span>
                      <span className="font-medium text-fuchsia-300 shrink-0 whitespace-nowrap">
                        R$ {itemTotal.toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="border-acai-600 mt-3 flex items-center justify-between border-t pt-3">
                <span className="font-bold text-fuchsia-100">Total</span>
                <span className="text-lg font-bold text-fuchsia-300 whitespace-nowrap">
                  R$ {total().toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-acai-600 bg-acai-800/90 rounded-2xl border p-4 shadow-lg">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fuchsia-400">
          Seus dados
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="rounded-lg p-3"
            placeholder="Nome"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <input
            className="rounded-lg p-3"
            placeholder="Telefone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </div>

        <h2 className="mb-3 mt-5 text-sm font-semibold uppercase tracking-wide text-fuchsia-400">
          Etapa {checkoutStep} de 2
        </h2>

        {checkoutStep === 1 ? (
          <>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fuchsia-400">
              Tipo de entrega
            </h3>
            <select
              className="w-full rounded-lg p-3"
              value={type}
              onChange={(e) =>
                setType(e.target.value as 'TABLE' | 'DELIVERY' | 'PICKUP')
              }
            >
              <option value="TABLE">Mesa</option>
              <option value="DELIVERY">Entrega</option>
              <option value="PICKUP">Retirada</option>
            </select>
            {type === 'TABLE' ? (
              <div className="mt-4">
                <label className="text-acai-300 mb-1 block text-xs font-medium">
                  Número da Mesa
                </label>
                <input
                  className="w-full rounded-lg p-3"
                  placeholder="Ex.: 12"
                  inputMode="numeric"
                  value={tableNumber}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '')
                    setTableNumber(digitsOnly)
                    setTableCode(digitsOnly ? `mesa-${digitsOnly}` : null)
                  }}
                />
              </div>
            ) : null}
            {type === 'DELIVERY' ? (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-acai-300 text-xs">
                    {geoMessage ??
                      'Usamos sua localização, se você permitir, só para sugerir rua e bairro.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      lastViaCepFetch.current = ''
                      tryGeolocation()
                    }}
                    className="border-acai-500 hover:bg-acai-700 shrink-0 rounded-lg border px-3 py-1.5 text-xs text-fuchsia-200"
                  >
                    Usar localização atual
                  </button>
                </div>

                <div>
                  <label className="text-acai-300 mb-1 block text-xs font-medium">
                    CEP
                  </label>
                  <input
                    className="w-full rounded-lg p-3"
                    placeholder="00000-000"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={formatCepDisplay(cepDigits)}
                    onChange={(e) => {
                      const d = onlyDigits(e.target.value, 8)
                      setCepDigits(d)
                      setCepNotFound(false)
                      if (d.length < 8) lastViaCepFetch.current = ''
                    }}
                    onBlur={(e) =>
                      void lookupCep(onlyDigits(e.currentTarget.value, 8))
                    }
                  />
                  {cepLoading ? (
                    <p className="text-acai-400 mt-1 text-xs">Buscando CEP…</p>
                  ) : null}
                  {cepNotFound ? (
                    <p className="mt-1 text-xs text-amber-400">
                      CEP não encontrado.
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="text-acai-300 mb-1 block text-xs font-medium">
                    Rua
                  </label>
                  <input
                    className="w-full rounded-lg p-3"
                    placeholder="Nome da rua"
                    autoComplete="street-address"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-acai-300 mb-1 block text-xs font-medium">
                    Número
                  </label>
                  <input
                    className="w-full rounded-lg p-3"
                    placeholder="Nº / complemento"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-acai-300 mb-1 block text-xs font-medium">
                    Bairro
                  </label>
                  <input
                    className="w-full rounded-lg p-3"
                    placeholder="Bairro"
                    autoComplete="address-level2"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {submitError ? (
              <p className="mt-3 text-sm text-amber-400">{submitError}</p>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setSubmitError(null)
                if (type === 'TABLE' && !tableNumber.trim()) {
                  setSubmitError('Informe o número da mesa para continuar.')
                  return
                }
                if (type === 'DELIVERY') {
                  const d = onlyDigits(cepDigits, 8)
                  if (d.length !== 8 || !street.trim() || !neighborhood.trim()) {
                    setSubmitError(
                      'Para entrega, preencha o CEP (8 dígitos), a rua e o bairro.'
                    )
                    return
                  }
                }
                setCheckoutStep(2)
              }}
              className="mt-5 w-full rounded-xl bg-fuchsia-600 py-3 text-base font-semibold text-white shadow hover:bg-fuchsia-500"
            >
              Continuar para pagamento
            </button>
          </>
        ) : (
          <>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fuchsia-400">
              Pagamento
            </h3>
            {type !== 'TABLE' ? (
              <>
                <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-acai-600 bg-acai-900/60 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentTab('ONLINE')
                      setSubmitError(null)
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      paymentTab === 'ONLINE'
                        ? 'bg-fuchsia-700 text-white'
                        : 'text-acai-200 hover:bg-acai-800'
                    }`}
                  >
                    Online
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentTab('DELIVERY')
                      setSubmitError(null)
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      paymentTab === 'DELIVERY'
                        ? 'bg-fuchsia-700 text-white'
                        : 'text-acai-200 hover:bg-acai-800'
                    }`}
                  >
                    Na entrega
                  </button>
                </div>

                {paymentTab === 'ONLINE' ? (
                  <div className="space-y-2 rounded-xl border border-acai-600 bg-acai-900/30 p-3">
                    <p className="text-acai-300 text-xs">
                      Pagamento online em breve. No momento, finalize na aba "Na entrega".
                    </p>
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed rounded-lg border border-acai-600 p-3 text-left text-acai-400 opacity-70"
                    >
                      PIX online (em breve)
                    </button>
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed rounded-lg border border-acai-600 p-3 text-left text-acai-400 opacity-70"
                    >
                      Cartão de crédito (em breve)
                    </button>
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed rounded-lg border border-acai-600 p-3 text-left text-acai-400 opacity-70"
                    >
                      Cartão de débito (em breve)
                    </button>
                  </div>
                ) : (
                  <>
                    <h4 className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-fuchsia-300">
                      Forma de pagamento na entrega
                    </h4>
                    <select
                      className="w-full rounded-lg p-3"
                      value={paymentMethod}
                      onChange={(e) =>
                        setPaymentMethod(
                          e.target.value as 'CASH' | 'DEBIT' | 'CREDIT' | 'PIX'
                        )
                      }
                    >
                      <option value="PIX">PIX (na entrega)</option>
                      <option value="DEBIT">Débito (na entrega)</option>
                      <option value="CREDIT">Crédito (na entrega)</option>
                      <option value="CASH">Dinheiro (na entrega)</option>
                    </select>
                    {paymentMethod === 'CASH' ? (
                      <div className="mt-3">
                        <input
                          className="w-full rounded-lg p-3"
                          placeholder="Troco para quanto?"
                          value={changeFor}
                          onChange={(e) => setChangeFor(e.target.value)}
                        />
                        <p className="text-acai-300 mt-2 text-sm">
                          Troco estimado: R$ {change.toFixed(2)}
                        </p>
                      </div>
                    ) : null}
                  </>
                )}
              </>
            ) : (
              <p className="text-acai-300 rounded-lg border border-acai-600 bg-acai-900/40 p-3 text-sm">
                Para pedidos em mesa, o pagamento será tratado no atendimento.
              </p>
            )}

            <h4 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-fuchsia-300">
              Observações
            </h4>
            <textarea
              className="w-full rounded-lg p-3"
              placeholder="Observações (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />

            {submitError ? (
              <p className="mt-3 text-sm text-amber-400">{submitError}</p>
            ) : null}

            <div className="mt-5 grid gap-2 md:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setSubmitError(null)
                  setCheckoutStep(1)
                }}
                className="w-full rounded-xl border border-acai-500 py-3 text-base font-semibold text-acai-100 hover:bg-acai-800"
              >
                Voltar
              </button>
              <button
                onClick={submitOrder}
                className="w-full rounded-xl bg-fuchsia-600 py-3 text-base font-semibold text-white shadow hover:bg-fuchsia-500"
              >
                Confirmar pedido
              </button>
            </div>
          </>
        )}
      </div>
      <p className="text-acai-400 mt-4 text-xs">
        Preparado para integração futura com provedores de PIX online e
        marketplaces (iFood/99Food) através do campo externalRefs da entidade
        Order.
      </p>
    </main>
  )
}
