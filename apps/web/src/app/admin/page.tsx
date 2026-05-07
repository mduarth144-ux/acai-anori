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
} from 'lucide-react'
import { orderStatusLabel, orderTypeLabel } from '../../lib/order-labels'
import Link from 'next/link'

type DashboardOrder = {
  id: string
  customerName?: string | null
  type: string
  status: string
  total: number
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
  const [orders, setOrders] = useState<DashboardOrder[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const latestOrderIdRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function loadOrders() {
      try {
        const response = await fetch('/api/orders?includeAll=true')
        if (!response.ok) throw new Error('Falha ao buscar pedidos')
        const data = (await response.json()) as DashboardOrder[]
        if (!mounted) return
        const list = Array.isArray(data)
          ? data.map((order) => ({
              ...order,
              total: Number(order.total ?? 0),
            }))
          : []
        const latestId = list[0]?.id ?? null
        if (
          latestOrderIdRef.current &&
          latestId &&
          latestId !== latestOrderIdRef.current
        ) {
          playBell(audioCtxRef)
        }
        latestOrderIdRef.current = latestId
        setOrders(list)
        setLastUpdate(new Date())
        setError(null)
      } catch {
        if (!mounted) return
        setError('Não foi possível atualizar o dashboard agora.')
      }
    }

    void loadOrders()
    const timer = setInterval(() => {
      void loadOrders()
    }, 10000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const kpis = useMemo(() => {
    const inProgress = orders.filter(
      (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
    ).length
    const revenue = orders.reduce((acc, order) => acc + order.total, 0)
    const deliveryRate =
      orders.length === 0
        ? 0
        : Math.round(
            (orders.filter((o) => o.status === 'DELIVERED').length / orders.length) *
              100
          )
    return { inProgress, revenue, deliveryRate }
  }, [orders])

  const weeklySales = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date()
      day.setHours(0, 0, 0, 0)
      day.setDate(day.getDate() - (6 - index))
      return day
    })
    const totals = days.map(() => 0)
    const dayToIndex = new Map(days.map((day, index) => [day.toDateString(), index]))

    for (const order of orders) {
      const created = new Date(order.createdAt)
      const idx = dayToIndex.get(created.toDateString())
      if (idx == null) continue
      totals[idx] += Number(order.total || 0)
    }
    return totals
  }, [orders])

  const miniTrend = useMemo(
    () =>
      orders
        .slice(0, 10)
        .reverse()
        .map((order) => Math.max(Number(order.total || 0), 0)),
    [orders]
  )
  const maxWeekly = Math.max(...weeklySales, 1)
  const maxMini = Math.max(...miniTrend, 1)
  const recentOrders = useMemo(() => orders.slice(0, 8), [orders])
  const updatesHealthy = lastUpdate ? Date.now() - lastUpdate.getTime() < 30000 : false

  return (
    <main className="w-full space-y-5">
      <header className="border-acai-700/70 bg-acai-900/70 rounded-2xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-fuchsia-100 md:text-2xl">
              Dashboard administrativo
            </h1>
            <p className="text-acai-300 mt-1 text-sm">
              Visão consolidada de pedidos e vendas com atualização automática a cada 10
              segundos.
            </p>
          </div>
          <Link
            href="/admin/integracoes/ifood"
            className="rounded-md border border-fuchsia-500/70 px-3 py-2 text-sm font-medium text-fuchsia-100 hover:bg-fuchsia-500/10"
          >
            Configurar área iFood
          </Link>
        </div>
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
            value: lastUpdate ? lastUpdate.toLocaleTimeString('pt-BR') : '--:--:--',
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
          {error ? (
            <p className="mb-2 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
              {error}
            </p>
          ) : null}
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <div
                key={`${order.id}-${order.createdAt}`}
                className="border-acai-700 bg-acai-950/60 flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div>
                  <p className="text-acai-100 text-sm font-medium">
                    #{order.id} - {order.customerName?.trim() || 'Cliente não informado'}
                  </p>
                  <p className="text-acai-400 text-xs">
                    {orderTypeLabel(order.type)} - {formatBRL(order.total)}
                  </p>
                </div>
                <span
                  className={[
                    'rounded-full px-2 py-1 text-xs font-medium',
                    order.status === 'PENDING'
                      ? 'bg-amber-900/40 text-amber-200'
                      : order.status === 'PREPARING' || order.status === 'CONFIRMED'
                        ? 'bg-sky-900/40 text-sky-200'
                        : order.status === 'CANCELLED'
                          ? 'bg-red-900/40 text-red-200'
                          : 'bg-emerald-900/40 text-emerald-200',
                  ].join(' ')}
                >
                  {orderStatusLabel(order.status)}
                </span>
              </div>
            ))}
            {recentOrders.length === 0 ? (
              <p className="text-acai-400 text-xs">Nenhum pedido encontrado.</p>
            ) : null}
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
            <p className="text-acai-400 mt-2 text-xs">Últimos 7 dias</p>
          </article>

          <article className="border-acai-700/70 bg-acai-900/70 rounded-2xl border p-4">
            <h3 className="text-acai-100 mb-3 text-sm font-semibold">
              Valor dos últimos 10 pedidos
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
            <p className="text-acai-400 mt-2 text-xs">Sequência cronológica</p>
          </article>

          <article className="border-acai-700/70 bg-acai-900/70 rounded-2xl border p-4">
            <h3 className="text-acai-100 mb-3 text-sm font-semibold">
              Status do painel
            </h3>
            <div className="space-y-2 text-sm">
              {[
                { name: 'API de pedidos', status: error ? 'instavel' : 'online', icon: Activity },
                { name: 'Banco de dados', status: error ? 'instavel' : 'online', icon: PackageCheck },
                { name: 'Atualização automática', status: updatesHealthy ? 'online' : 'instavel', icon: Clock3 },
                { name: 'Processamento de pedidos', status: orders.length > 0 ? 'online' : 'instavel', icon: Bike },
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
