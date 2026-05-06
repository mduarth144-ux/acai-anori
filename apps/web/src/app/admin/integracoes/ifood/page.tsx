'use client'

import { useEffect, useState } from 'react'

type DeliveryAreaConfig = {
  city: string
  state: string
  defaultLatitude: number
  defaultLongitude: number
  allowedCities: string[]
  allowedNeighborhoods: string[]
}

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export default function IfoodIntegrationSettingsPage() {
  const [config, setConfig] = useState<DeliveryAreaConfig | null>(null)
  const [allowedCitiesText, setAllowedCitiesText] = useState('')
  const [allowedNeighborhoodsText, setAllowedNeighborhoodsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const response = await fetch('/api/admin/ifood/delivery-area')
      const data = (await response.json()) as { config: DeliveryAreaConfig }
      setConfig(data.config)
      setAllowedCitiesText(data.config.allowedCities.join('\n'))
      setAllowedNeighborhoodsText(data.config.allowedNeighborhoods.join('\n'))
    }
    void load()
  }, [])

  if (!config) {
    return (
      <main className="rounded-2xl border border-acai-700/70 bg-acai-900/70 p-6 text-acai-200">
        Carregando configuração de entrega iFood...
      </main>
    )
  }

  async function onSave() {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/ifood/delivery-area', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...config,
          allowedCities: parseLines(allowedCitiesText),
          allowedNeighborhoods: parseLines(allowedNeighborhoodsText),
        }),
      })
      const data = (await response.json()) as { message?: string; config?: DeliveryAreaConfig }
      if (!response.ok) throw new Error(data.message || 'Erro ao salvar configuração')
      if (data.config) {
        setConfig(data.config)
        setAllowedCitiesText(data.config.allowedCities.join('\n'))
        setAllowedNeighborhoodsText(data.config.allowedNeighborhoods.join('\n'))
      }
      setMessage('Configuração salva com sucesso.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar configuração')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="space-y-5">
      <header className="rounded-2xl border border-acai-700/70 bg-acai-900/70 p-5">
        <h1 className="text-xl font-bold text-fuchsia-100 md:text-2xl">
          iFood Shipping - Área de entrega
        </h1>
        <p className="mt-1 text-sm text-acai-300">
          Configure cidade/estado padrão e filtros de área para evitar erro de distância.
        </p>
      </header>

      <section className="grid gap-4 rounded-2xl border border-acai-700/70 bg-acai-900/70 p-5 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm text-acai-200">Cidade padrão</span>
          <input
            className="w-full rounded-md border border-acai-700 bg-acai-950/60 px-3 py-2 text-acai-50"
            value={config.city}
            onChange={(event) => setConfig({ ...config, city: event.target.value })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-acai-200">UF padrão</span>
          <input
            className="w-full rounded-md border border-acai-700 bg-acai-950/60 px-3 py-2 text-acai-50"
            value={config.state}
            onChange={(event) => setConfig({ ...config, state: event.target.value })}
            maxLength={2}
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-acai-200">Latitude base</span>
          <input
            type="number"
            step="0.000001"
            className="w-full rounded-md border border-acai-700 bg-acai-950/60 px-3 py-2 text-acai-50"
            value={config.defaultLatitude}
            onChange={(event) =>
              setConfig({ ...config, defaultLatitude: Number(event.target.value) || 0 })
            }
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-acai-200">Longitude base</span>
          <input
            type="number"
            step="0.000001"
            className="w-full rounded-md border border-acai-700 bg-acai-950/60 px-3 py-2 text-acai-50"
            value={config.defaultLongitude}
            onChange={(event) =>
              setConfig({ ...config, defaultLongitude: Number(event.target.value) || 0 })
            }
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-2xl border border-acai-700/70 bg-acai-900/70 p-5 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm text-acai-200">Cidades permitidas (1 por linha)</span>
          <textarea
            rows={8}
            className="w-full rounded-md border border-acai-700 bg-acai-950/60 px-3 py-2 text-acai-50"
            value={allowedCitiesText}
            onChange={(event) => setAllowedCitiesText(event.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-acai-200">Bairros permitidos (1 por linha)</span>
          <textarea
            rows={8}
            className="w-full rounded-md border border-acai-700 bg-acai-950/60 px-3 py-2 text-acai-50"
            value={allowedNeighborhoodsText}
            onChange={(event) => setAllowedNeighborhoodsText(event.target.value)}
          />
        </label>
      </section>

      <section className="rounded-2xl border border-acai-700/70 bg-acai-900/70 p-5">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar configuração'}
        </button>
        {message ? <p className="mt-3 text-sm text-acai-200">{message}</p> : null}
      </section>
    </main>
  )
}
