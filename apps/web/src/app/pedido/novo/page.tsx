'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Smartphone } from 'lucide-react'
import { ThemedSelect } from '../../../components/ui/themed-select'
import { useCartStore } from '../../../store/cart-store'
import {
  buildDeliveryAddressLine,
  fetchViaCep,
  formatCepDisplay,
  onlyDigits,
} from '../../../lib/cep-viacep'

type GeoStatus = 'idle' | 'pending' | 'ok' | 'denied' | 'error' | 'unavailable'
const CHECKOUT_PROFILE_STORAGE_KEY = 'checkout.profile.v1'
const ORDERS_STORAGE_KEY = 'app.orders.v1'

function formatPhoneDisplay(input: string) {
  const digits = input.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

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
  const [customerEmail, setCustomerEmail] = useState('')
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
  const [phoneCaptureStatus, setPhoneCaptureStatus] = useState<
    'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error'
  >('idle')
  const [phoneCaptureMessage, setPhoneCaptureMessage] = useState<string | null>(
    null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmDataTitle, setShowConfirmDataTitle] = useState(false)
  const lastViaCepFetch = useRef('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(CHECKOUT_PROFILE_STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as {
        customerName?: string
        customerPhone?: string
        customerEmail?: string
        cepDigits?: string
        street?: string
        number?: string
        neighborhood?: string
      }
      if (saved.customerName) setCustomerName(saved.customerName)
      if (saved.customerPhone) setCustomerPhone(formatPhoneDisplay(saved.customerPhone))
      if (saved.customerEmail) setCustomerEmail(saved.customerEmail)
      if (saved.cepDigits) setCepDigits(onlyDigits(saved.cepDigits, 8))
      if (saved.street) setStreet(saved.street)
      if (saved.number) setNumber(saved.number)
      if (saved.neighborhood) setNeighborhood(saved.neighborhood)
      const hasCompleteSavedProfile =
        (saved.customerName?.trim().length ?? 0) >= 3 &&
        onlyDigits(saved.customerPhone ?? '', 11).length === 11 &&
        onlyDigits(saved.cepDigits ?? '', 8).length === 8 &&
        (saved.street?.trim().length ?? 0) > 0 &&
        (saved.number?.trim().length ?? 0) > 0 &&
        (saved.neighborhood?.trim().length ?? 0) > 0
      setShowConfirmDataTitle(hasCompleteSavedProfile)
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
          customerEmail,
          cepDigits,
          street,
          number,
          neighborhood,
        })
      )
    } catch {
      // Ignore storage quota/availability errors to avoid blocking checkout.
    }
  }, [customerName, customerPhone, customerEmail, cepDigits, street, number, neighborhood])

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

  async function capturePhoneFromContacts() {
    setPhoneCaptureMessage(null)
    setSubmitError(null)

    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      setPhoneCaptureStatus('unsupported')
      setPhoneCaptureMessage(
        'Seu dispositivo não suporta captura automática de contatos.'
      )
      return
    }

    const contactsApi = (
      navigator as Navigator & {
        contacts?: {
          select: (
            properties: string[],
            options?: { multiple?: boolean }
          ) => Promise<Array<{ tel?: string[] }>>
        }
      }
    ).contacts

    if (!contactsApi?.select) {
      setPhoneCaptureStatus('unsupported')
      setPhoneCaptureMessage(
        'Captura automática de telefone não disponível neste navegador.'
      )
      return
    }

    setPhoneCaptureStatus('requesting')
    try {
      const contacts = await contactsApi.select(['tel'], { multiple: false })
      const tel = contacts?.[0]?.tel?.[0] ?? ''
      const masked = formatPhoneDisplay(tel)
      if (!masked) {
        setPhoneCaptureStatus('error')
        setPhoneCaptureMessage(
          'Não encontramos número de telefone no contato selecionado.'
        )
        return
      }
      setCustomerPhone(masked)
      setPhoneCaptureStatus('granted')
      setPhoneCaptureMessage('Telefone importado com sucesso.')
    } catch (error) {
      const errorName =
        error instanceof DOMException ? error.name : 'UnknownError'
      if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
        setPhoneCaptureStatus('denied')
        setPhoneCaptureMessage(
          'Permissão negada. Você pode preencher o telefone manualmente.'
        )
        return
      }
      setPhoneCaptureStatus('error')
      setPhoneCaptureMessage(
        'Não foi possível capturar o telefone automaticamente.'
      )
    }
  }

  async function submitOrder() {
    setSubmitError(null)
    if (isSubmitting) return
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

    if (!isCustomerDataValid) {
      setSubmitError(
        'Preencha nome, telefone e e-mail válidos antes de confirmar o pedido.'
      )
      return
    }

    if (type === 'DELIVERY') {
      const d = onlyDigits(cepDigits, 8)
      if (
        d.length !== 8 ||
        !street.trim() ||
        !number.trim() ||
        !neighborhood.trim()
      ) {
        setSubmitError(
          'Para entrega, preencha CEP (8 dígitos), rua, número e bairro.'
        )
        return
      }
    }

    setIsSubmitting(true)
    try {
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
          customerEmail,
          address: type === 'DELIVERY' ? address : undefined,
          notes,
          items: cart,
        }),
      })

      if (!response.ok) {
        setSubmitError('Não foi possível confirmar o pedido. Tente novamente.')
        return
      }
      const data = await response.json()
      if (typeof window !== 'undefined') {
        try {
          const current = JSON.parse(
            window.localStorage.getItem(ORDERS_STORAGE_KEY) ?? '[]'
          ) as Array<{ id: string; createdAt: string; status: string; total?: number }>
          const next = [
            {
              id: String(data.id),
              createdAt: new Date().toISOString(),
              status: 'Pendente',
              total: Number(total().toFixed(2)),
            },
            ...current.filter((order) => order.id !== String(data.id)),
          ].slice(0, 20)
          window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(next))
        } catch {
          // Ignore storage failures to avoid blocking order confirmation.
        }
      }
      clearCart()
      router.push(`/pedido/${data.id}`)
    } finally {
      setIsSubmitting(false)
    }
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

  const phoneDigits = customerPhone.replace(/\D/g, '')
  const normalizedEmail = customerEmail.trim()
  const isEmailValid = /\S+@\S+\.\S+/.test(normalizedEmail)
  const cepDigitsOnly = onlyDigits(cepDigits, 8)
  const isCustomerDataValid =
    customerName.trim().length >= 3 && phoneDigits.length === 11 && isEmailValid
  const isDeliveryAddressValid =
    cepDigitsOnly.length === 8 &&
    street.trim().length > 0 &&
    number.trim().length > 0 &&
    neighborhood.trim().length > 0
  const isTableValid = tableNumber.trim().length > 0
  const canContinueToPayment =
    isCustomerDataValid &&
    (type === 'DELIVERY'
      ? isDeliveryAddressValid
      : type === 'TABLE'
        ? isTableValid
        : true)

  return (
    <main className="checkout-page mx-auto max-w-3xl p-4">
      <h1 className="checkout-title mb-4 text-2xl font-bold text-fuchsia-100">
        Finalizar pedido
      </h1>

      {cart.length > 0 && (
        <div className="checkout-card border-acai-600 bg-acai-800/90 mb-4 rounded-2xl border p-4 shadow-lg">
          <button
            type="button"
            onClick={() => setIsSummaryOpen((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3"
            aria-expanded={isSummaryOpen}
          >
            <h2 className="checkout-section-title text-left text-sm font-semibold uppercase tracking-wide text-fuchsia-400">
              {isSummaryOpen
                ? 'Resumo do pedido'
                : `Resumo do pedido - R$ ${total().toFixed(2)}`}
            </h2>
            <span className="checkout-chip inline-flex items-center gap-1 rounded-xl border border-acai-500 bg-acai-900/70 px-2 py-1 text-[11px] font-medium text-fuchsia-200">
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
                      className="flex items-start justify-between gap-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="checkout-item-name text-acai-200 block">
                          <span className="mr-2 font-semibold text-fuchsia-300">
                            {item.quantity}×
                          </span>
                          {item.name}
                        </span>

                        {item.choices && item.choices.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {item.choices.map((choice, index) => (
                              <span
                                key={`${itemId}-choice-${index}`}
                                className="checkout-choice-chip rounded-full border border-acai-600 bg-acai-900 px-2 py-0.5 text-[11px] text-fuchsia-200"
                              >
                                {choice.name}
                                {choice.priceModifier !== 0
                                  ? ` (+R$ ${choice.priceModifier.toFixed(2)})`
                                  : ''}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <span className="checkout-item-price font-medium text-fuchsia-300 shrink-0 whitespace-nowrap">
                        R$ {itemTotal.toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="checkout-total-row border-acai-600 mt-3 flex items-center justify-between border-t pt-3">
                <span className="checkout-total-label font-bold text-fuchsia-100">Total</span>
                <span className="checkout-total-value text-lg font-bold text-fuchsia-300 whitespace-nowrap">
                  R$ {total().toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {checkoutStep === 1 ? (
        <div className="checkout-card border-acai-600 bg-acai-800/90 rounded-2xl border p-4 shadow-lg">
          <h2 className="checkout-section-title mb-3 text-sm font-semibold uppercase tracking-wide text-fuchsia-400">
            {showConfirmDataTitle ? 'Confirme Seus dados' : 'Confirme Seus dados'}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg p-3"
              placeholder="Nome"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
            <div className="relative">
              <input
                className="w-full rounded-lg p-3 pr-12"
                placeholder="Celular"
                value={customerPhone}
                onChange={(e) =>
                  setCustomerPhone(formatPhoneDisplay(e.target.value))
                }
                inputMode="tel"
                required
              />
              <button
                type="button"
                onClick={capturePhoneFromContacts}
                disabled={phoneCaptureStatus === 'requesting' || isSubmitting}
                title="Captura o número do chip atual"
                aria-label="Captura o número do chip atual"
                className="border-acai-500 hover:bg-acai-700 absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border text-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Smartphone size={16} />
              </button>
            </div>
            <input
              className="rounded-lg p-3 md:col-span-2"
              placeholder="E-mail"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              inputMode="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <p className="checkout-helper text-acai-300 mt-2 text-xs">Formato: (99) 999999-9999</p>
          <br />
          {phoneCaptureMessage ? (
            <p className="checkout-helper mt-1 text-xs text-fuchsia-300">{phoneCaptureMessage}</p>
          ) : null}
          {customerPhone.length > 0 && phoneDigits.length !== 11 ? (
            <p className="mt-1 text-xs text-amber-400">
              Informe um telefone válido com DDD (11 dígitos).
            </p>
          ) : null}
          {customerEmail.length > 0 && !isEmailValid ? (
            <p className="mt-1 text-xs text-amber-400">
              Informe um e-mail válido.
            </p>
          ) : null}

          <>
            <h3 className="checkout-section-title mb-3 text-sm font-semibold uppercase tracking-wide text-fuchsia-400">
              Tipo de entrega
            </h3>
            <ThemedSelect
              className="w-full"
              value={type}
              onChange={(nextValue) =>
                setType(nextValue as 'TABLE' | 'DELIVERY' | 'PICKUP')
              }
              options={[
                { value: 'TABLE', label: 'Mesa' },
                { value: 'DELIVERY', label: 'Entrega' },
                { value: 'PICKUP', label: 'Retirada' },
              ]}
            />
            {type === 'TABLE' ? (
              <div className="mt-4">
                <label className="checkout-label text-acai-300 mb-1 block text-xs font-medium">
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
                  <p className="checkout-helper text-acai-300 text-xs">
                    {geoMessage ??
                      'Usamos sua localização, se você permitir, só para sugerir rua e bairro.'}
                  </p>
                </div>

                <div className="grid grid-cols-12 gap-3">
                  <div className="relative col-span-12 md:col-span-4">
                    <label className="checkout-label text-acai-300 mb-1 block text-xs font-medium">
                      CEP
                    </label>
                    <input
                      className="w-full rounded-lg p-3 pr-12"
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
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        lastViaCepFetch.current = ''
                        tryGeolocation()
                      }}
                      disabled={geoStatus === 'pending' || isSubmitting}
                      title="Recebe a localização diretamente do seu GPS"
                      aria-label="Recebe a localização diretamente do seu GPS"
                      className="border-acai-500 hover:bg-acai-700 absolute right-2 top-[2.15rem] inline-flex h-8 w-8 items-center justify-center rounded-md border text-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <MapPin size={16} />
                    </button>
                    {cepLoading ? (
                      <p className="checkout-helper text-acai-400 mt-1 text-xs">Buscando CEP…</p>
                    ) : null}
                    {cepNotFound ? (
                      <p className="mt-1 text-xs text-amber-400">
                        CEP não encontrado.
                      </p>
                    ) : null}
                  </div>

                  <div className="col-span-9 md:col-span-8">
                    <label className="checkout-label text-acai-300 mb-1 block text-xs font-medium">
                      Rua
                    </label>
                    <input
                      className="w-full rounded-lg p-3"
                      placeholder="Nome da rua"
                      autoComplete="street-address"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      required
                    />
                  </div>

                  <div className="order-4 col-span-12 md:order-3 md:col-span-8">
                    <label className="checkout-label text-acai-300 mb-1 block text-xs font-medium">
                      Bairro
                    </label>
                    <input
                      className="w-full rounded-lg p-3"
                      placeholder="Bairro"
                      autoComplete="address-level2"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      required
                    />
                  </div>

                  <div className="order-3 col-span-3 md:order-4 md:col-span-4">
                    <label className="checkout-label text-acai-300 mb-1 block text-xs font-medium">
                      Número
                    </label>
                    <input
                      className="w-full rounded-lg p-3"
                      placeholder="Nº"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {submitError ? (
              <p className="mt-3 text-sm text-amber-400">{submitError}</p>
            ) : null}

            <div className="mt-5 grid gap-2 md:grid-cols-2">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-acai-500 py-3 text-base font-semibold text-acai-100 hover:bg-acai-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                ← Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmitError(null)
                  setCheckoutStep(2)
                }}
                disabled={!canContinueToPayment || isSubmitting}
                className="w-full rounded-xl bg-fuchsia-600 py-3 text-base font-semibold text-white shadow hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Pagamento →
              </button>
            </div>
          </>
        </div>
      ) : (
        <div className="checkout-card border-acai-600 bg-acai-800/90 rounded-2xl border p-4 shadow-lg">
          <>
            <h3 className="checkout-section-title mb-3 text-sm font-semibold uppercase tracking-wide text-fuchsia-400">
              Pagamento
            </h3>
            {type !== 'TABLE' ? (
              <>
                <div className="checkout-tab-shell mb-3 grid grid-cols-2 gap-2 rounded-xl border border-acai-600 bg-acai-900/60 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentTab('ONLINE')
                      setSubmitError(null)
                    }}
                    disabled={isSubmitting}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      paymentTab === 'ONLINE'
                        ? 'bg-fuchsia-700 text-white'
                        : 'text-acai-200 hover:bg-acai-800'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    Online
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentTab('DELIVERY')
                      setSubmitError(null)
                    }}
                    disabled={isSubmitting}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      paymentTab === 'DELIVERY'
                        ? 'bg-fuchsia-700 text-white'
                        : 'text-acai-200 hover:bg-acai-800'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    Na entrega
                  </button>
                </div>

                {paymentTab === 'ONLINE' ? (
                  <div className="checkout-online-box space-y-2 rounded-xl border border-acai-600 bg-acai-900/30 p-3">
                    <p className="checkout-helper text-acai-300 text-xs">
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
                    <h4 className="checkout-section-title mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-fuchsia-300">
                      Forma de pagamento na entrega
                    </h4>
                    <ThemedSelect
                      className="w-full"
                      value={paymentMethod}
                      onChange={(nextValue) =>
                        setPaymentMethod(
                          nextValue as 'CASH' | 'DEBIT' | 'CREDIT' | 'PIX'
                        )
                      }
                      options={[
                        { value: 'PIX', label: 'PIX (na entrega)' },
                        { value: 'DEBIT', label: 'Débito (na entrega)' },
                        { value: 'CREDIT', label: 'Crédito (na entrega)' },
                        { value: 'CASH', label: 'Dinheiro (na entrega)' },
                      ]}
                    />
                    {paymentMethod === 'CASH' ? (
                      <div className="mt-3">
                        <input
                          className="w-full rounded-lg p-3"
                          placeholder="Troco para quanto?"
                          value={changeFor}
                          onChange={(e) => setChangeFor(e.target.value)}
                        />
                        <p className="checkout-helper text-acai-300 mt-2 text-sm">
                          Troco estimado: R$ {change.toFixed(2)}
                        </p>
                      </div>
                    ) : null}
                  </>
                )}
              </>
            ) : (
              <p className="checkout-helper rounded-lg border border-acai-600 bg-acai-900/40 p-3 text-sm text-acai-300">
                Para pedidos em mesa, o pagamento será tratado no atendimento.
              </p>
            )}

            <h4 className="checkout-section-title mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-fuchsia-300">
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
                disabled={isSubmitting}
                className="w-full rounded-xl border border-acai-500 py-3 text-base font-semibold text-acai-100 hover:bg-acai-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                ← Voltar
              </button>
              <button
                onClick={submitOrder}
                disabled={
                  isSubmitting || (type !== 'TABLE' && paymentTab === 'ONLINE')
                }
                className="w-full rounded-xl bg-fuchsia-600 py-3 text-base font-semibold text-white shadow hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Confirmando pedido...' : 'Confirmar pedido'}
              </button>
            </div>
          </>
        </div>
      )}
      <p className="checkout-helper text-acai-400 mt-4 text-xs">
        Preparado para integração futura com provedores de PIX online e
        marketplaces (iFood/99Food) através do campo externalRefs da entidade
        Order.
      </p>
    </main>
  )
}
