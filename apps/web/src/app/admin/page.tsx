'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Bike,
  ChartColumnIncreasing,
  Clock3,
  ConciergeBell,
  PackageCheck,
  ShoppingCart,
  SmartphoneNfc,
  Store,
} from 'lucide-react'

type LiveOrder = {
  id: string
  customer: string
  total: number
  channel: 'Balcao' | 'iFood' | '99Food'
  status: 'novo' | 'preparo' | 'entrega'
  createdAt: string
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function playBell(audioCtxRef: React.MutableRefObject<AudioContext | null>) {
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx()
    const ctx = audioCtxRef.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(1046, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(659, ctx.currentTime + 0.18)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.36)
  } catch {
    // Ignora falhas de autoplay/áudio no navegador.
  }
}

export default function AdminPage() {
  const [orders, setOrders] = useState<LiveOrder[]>([
    {
      id: 'A-1204',
      customer: 'Fernanda',
      total: 52.9,
      channel: 'iFood',
      status: 'preparo',
      createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
    {
      id: 'A-1203',
      customer: 'Rafael',
      total: 34.5,
      channel: 'Balcao',
      status: 'entrega',
      createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
    {
      id: 'A-1202',
      customer: 'Juliana',
      total: 41,
      channel: '99Food',
      status: 'preparo',
      createdAt: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
    },
  ])
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    const customers = ['Camila', 'Joao', 'Patricia', 'Diego', 'Bruna', 'Lucas']
    const channels: LiveOrder['channel'][] = ['iFood', '99Food', 'Balcao']
    const timer = setInterval(() => {
      const shouldCreate = Math.random() > 0.45
      if (!shouldCreate) return

      const next: LiveOrder = {
        id: `A-${Math.floor(1205 + Math.random() * 400)}`,
        customer: customers[Math.floor(Math.random() * customers.length)],
        total: Number((19 + Math.random() * 68).toFixed(2)),
        channel: channels[Math.floor(Math.random() * channels.length)],
        status: 'novo',
        createdAt: new Date().toISOString(),
      }
      setOrders((prev) => [next, ...prev].slice(0, 8))
      setLastUpdate(new Date())
      playBell(audioCtxRef)
    }, 9000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const progress = setInterval(() => {
      setOrders((prev) =>
        prev.map((order) => {
          if (order.status === 'novo' && Math.random() > 0.5) {
            return { ...order, status: 'preparo' }
          }
          if (order.status === 'preparo' && Math.random() > 0.7) {
            return { ...order, status: 'entrega' }
          }
          return order
        })
      )
    }, 7000)
    return () => clearInterval(progress)
  }, [])

  const kpis = useMemo(() => {
    const inProgress = orders.filter((o) => o.status !== 'entrega').length
    const revenue = orders.reduce((acc, order) => acc + order.total, 0)
    const deliveryRate =
      orders.length === 0
        ? 0
        : Math.round(
            (orders.filter((o) => o.status === 'entrega').length / orders.length) *
              100
          )
    return { inProgress, revenue, deliveryRate }
  }, [orders])

  const weeklySales = [420, 510, 468, 590, 640, 702, 680]
  const miniTrend = [18, 22, 20, 26, 29, 31, 35, 33, 38, 41]
  const maxWeekly = Math.max(...weeklySales)
  const maxMini = Math.max(...miniTrend)

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4">
      <header className="border-acai-700/70 bg-acai-900/70 rounded-2xl border p-5">
        <h1 className="text-xl font-bold text-fuchsia-100 md:text-2xl">
          Dashboard administrativo
        </h1>
        <p className="text-acai-300 mt-1 text-sm">
          Visão consolidada de pedidos, vendas e integrações em tempo real (modo
          demonstração).
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Pedidos em andamento',
            value: kpis.inProgress.toString(),
            icon: ShoppingCart,
            hint: 'Atualização contínua',
          },
          {
            label: 'Faturamento recente',
            value: formatBRL(kpis.revenue),
            icon: ChartColumnIncreasing,
            hint: 'Últimos pedidos carregados',
          },
          {
            label: 'Taxa de entregas',
            value: `${kpis.deliveryRate}%`,
            icon: Bike,
            hint: 'Pedidos concluídos',
          },
          {
            label: 'Último evento',
            value: lastUpdate.toLocaleTimeString('pt-BR'),
            icon: Clock3,
            hint: 'Entrada mais recente',
          },
        ].map(({ label, value, icon: Icon, hint }) => (
          <article
            key={label}
            className="border-acai-700/70 bg-acai-900/70 rounded-xl border p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-acai-300 text-xs uppercase tracking-wide">{label}</p>
              <Icon className="h-4 w-4 text-fuchsia-300" aria-hidden />
            </div>
            <p className="text-acai-50 text-2xl font-bold">{value}</p>
            <p className="text-acai-400 mt-1 text-xs">{hint}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <article className="border-acai-700/70 bg-acai-900/70 rounded-2xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-acai-100 text-base font-semibold">
              Pedidos em andamento
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700/60 bg-emerald-950/40 px-2 py-0.5 text-[11px] text-emerald-200">
              <ConciergeBell className="h-3.5 w-3.5" aria-hidden />
              Campainha ativa
            </span>
          </div>
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={`${order.id}-${order.createdAt}`}
                className="border-acai-700 bg-acai-950/60 flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div>
                  <p className="text-acai-100 text-sm font-medium">
                    #{order.id} - {order.customer}
                  </p>
                  <p className="text-acai-400 text-xs">
                    {order.channel} - {formatBRL(order.total)}
                  </p>
                </div>
                <span
                  className={[
                    'rounded-full px-2 py-1 text-xs font-medium',
                    order.status === 'novo'
                      ? 'bg-amber-900/40 text-amber-200'
                      : order.status === 'preparo'
                        ? 'bg-sky-900/40 text-sky-200'
                        : 'bg-emerald-900/40 text-emerald-200',
                  ].join(' ')}
                >
                  {order.status === 'novo'
                    ? 'Novo'
                    : order.status === 'preparo'
                      ? 'Em preparo'
                      : 'Saiu para entrega'}
                </span>
              </div>
            ))}
          </div>
        </article>

        <aside className="space-y-4">
          <article className="border-acai-700/70 bg-acai-900/70 rounded-2xl border p-4">
            <h3 className="text-acai-100 mb-3 text-sm font-semibold">
              Vendas da semana
            </h3>
            <div className="grid h-28 grid-cols-7 items-end gap-1.5">
              {weeklySales.map((value, index) => (
                <div key={index} className="group relative">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-fuchsia-700 to-fuchsia-400"
                    style={{ height: `${(value / maxWeekly) * 100}%` }}
                  />
                </div>
              ))}
            </div>
            <p className="text-acai-400 mt-2 text-xs">Seg a Dom</p>
          </article>

          <article className="border-acai-700/70 bg-acai-900/70 rounded-2xl border p-4">
            <h3 className="text-acai-100 mb-3 text-sm font-semibold">
              Tendência de entregas
            </h3>
            <div className="flex h-16 items-end gap-1">
              {miniTrend.map((value, index) => (
                <div
                  key={index}
                  className="w-full rounded bg-cyan-500/80"
                  style={{ height: `${Math.max((value / maxMini) * 100, 16)}%` }}
                />
              ))}
            </div>
            <p className="text-acai-400 mt-2 text-xs">Últimos 10 ciclos</p>
          </article>

          <article className="border-acai-700/70 bg-acai-900/70 rounded-2xl border p-4">
            <h3 className="text-acai-100 mb-3 text-sm font-semibold">
              Status de parceiros
            </h3>
            <div className="space-y-2 text-sm">
              {[
                { name: 'iFood', status: 'online', icon: Store },
                { name: '99Food', status: 'instavel', icon: SmartphoneNfc },
                { name: 'POS local', status: 'online', icon: PackageCheck },
                { name: 'Webhook pedidos', status: 'online', icon: Activity },
              ].map(({ name, status, icon: Icon }) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="text-acai-200 inline-flex items-center gap-2">
                    <Icon className="h-4 w-4 text-acai-300" aria-hidden />
                    {name}
                  </span>
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      status === 'online'
                        ? 'bg-emerald-900/40 text-emerald-200'
                        : 'bg-amber-900/40 text-amber-200',
                    ].join(' ')}
                  >
                    {status === 'online' ? 'Online' : 'Instável'}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </main>
  )
}
