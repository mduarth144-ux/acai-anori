'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

type DeliveryAreaConfig = {
  city: string
  state: string
  defaultLatitude: number
  defaultLongitude: number
  radiusKm: number
  allowedCities: string[]
  allowedNeighborhoods: string[]
}

type AddressHints = {
  cep?: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
}

const DeliveryAreaMap = dynamic(
  () => import('../../../../components/admin/delivery-area-map').then((module) => module.DeliveryAreaMap),
  { ssr: false }
)

export default function IfoodIntegrationSettingsPage() {
  const [config, setConfig] = useState<DeliveryAreaConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [searchingLocation, setSearchingLocation] = useState(false)
  const [cepSearch, setCepSearch] = useState('')
  const [addressSearch, setAddressSearch] = useState('')
  const [streetNumber, setStreetNumber] = useState('')
  const [district, setDistrict] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const response = await fetch('/api/admin/ifood/delivery-area')
      const data = (await response.json()) as { config: DeliveryAreaConfig }
      setConfig(data.config)
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
    if (!config) return
    const currentConfig = config
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/ifood/delivery-area', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...currentConfig,
          radiusKm: Number(currentConfig.radiusKm),
        }),
      })
      const data = (await response.json()) as { message?: string; config?: DeliveryAreaConfig }
      if (!response.ok) throw new Error(data.message || 'Erro ao salvar configuração')
      if (data.config) {
        setConfig(data.config)
      }
      setMessage('Configuração salva com sucesso.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar configuração')
    } finally {
      setSaving(false)
    }
  }

  async function onImportFromIfood() {
    setImporting(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/ifood/delivery-area/import')
      const data = (await response.json()) as {
        message?: string
        warning?: string
        config?: DeliveryAreaConfig
        addressHints?: AddressHints
      }
      if (!response.ok) throw new Error(data.message || 'Erro ao importar dados do iFood')
      if (data.config) {
        setConfig(data.config)
      }
      if (data.addressHints) {
        if (data.addressHints.cep) setCepSearch(data.addressHints.cep)
        const streetText = [data.addressHints.street, data.addressHints.number]
          .filter(Boolean)
          .join(', ')
        if (streetText) setAddressSearch(streetText)
        if (data.addressHints.number) setStreetNumber(data.addressHints.number)
        if (data.addressHints.neighborhood) setDistrict(data.addressHints.neighborhood)
      }
      if (data.warning) {
        setMessage(data.warning)
      } else {
        setMessage(
          'Configuração consultada do iFood e aplicada no formulário. Clique em salvar para persistir.'
        )
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao importar dados do iFood')
    } finally {
      setImporting(false)
    }
  }

  async function onSearchLocation() {
    if (!config) return
    setSearchingLocation(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/ifood/delivery-area/geocode', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cep: cepSearch,
          address: [addressSearch, streetNumber, district].filter(Boolean).join(', '),
          city: config.city,
          state: config.state,
        }),
      })
      const data = (await response.json()) as {
        message?: string
        latitude?: number
        longitude?: number
        displayName?: string
      }
      if (!response.ok || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
        throw new Error(data.message || 'Nao foi possivel localizar o endereco')
      }
      setConfig({
        ...config,
        defaultLatitude: Number(data.latitude.toFixed(6)),
        defaultLongitude: Number(data.longitude.toFixed(6)),
      })
      setMessage(`Pin atualizado para: ${data.displayName ?? 'endereco encontrado'}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao buscar localizacao')
    } finally {
      setSearchingLocation(false)
    }
  }

  async function onPublishToIfood() {
    if (!config) return
    setPublishing(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/ifood/delivery-area/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...config,
          radiusKm: Number(config.radiusKm),
        }),
      })
      const data = (await response.json()) as {
        message?: string
        config?: DeliveryAreaConfig
        published?: { method?: string; path?: string }
      }
      if (!response.ok) throw new Error(data.message || 'Erro ao publicar configuracao no iFood')
      if (data.config) {
        setConfig(data.config)
      }
      setMessage(
        `Cobertura publicada no iFood com sucesso (${data.published?.method ?? 'METODO'} ${data.published?.path ?? 'rota'}).`
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao publicar no iFood')
    } finally {
      setPublishing(false)
    }
  }

  function onMapPick(nextLatitude: number, nextLongitude: number) {
    setConfig((current) =>
      current
        ? {
            ...current,
            defaultLatitude: Number(nextLatitude.toFixed(6)),
            defaultLongitude: Number(nextLongitude.toFixed(6)),
          }
        : current
    )
    setMessage('Pin atualizado pelo mapa. Clique em salvar para persistir.')
  }

  return (
    <main className="space-y-5">
      <header className="rounded-2xl border border-acai-700/70 bg-acai-900/70 p-5">
        <h1 className="text-xl font-bold text-fuchsia-100 md:text-2xl">
          iFood Shipping - Área de entrega
        </h1>
        <p className="mt-1 text-sm text-acai-300">
          Configure cidade/estado e coordenadas padrão usadas no payload da **Shipping API** do
          iFood (entrega). A cobertura final sempre é validada pelo iFood.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onImportFromIfood}
            disabled={importing || saving}
            className="rounded-md border border-acai-500 px-4 py-2 text-sm font-semibold text-acai-100 hover:bg-acai-800 disabled:opacity-60"
          >
            {importing ? 'Importando do iFood...' : 'Receber configuração do iFood'}
          </button>
        </div>
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
        <label className="space-y-1">
          <span className="text-sm text-acai-200">Raio de cobertura (km)</span>
          <input
            type="number"
            min={0.5}
            step="0.5"
            className="w-full rounded-md border border-acai-700 bg-acai-950/60 px-3 py-2 text-acai-50"
            value={config.radiusKm}
            onChange={(event) => setConfig({ ...config, radiusKm: Number(event.target.value) || 1 })}
          />
        </label>
      </section>

      <section className="rounded-2xl border border-acai-700/70 bg-acai-900/70 p-5">
        <h2 className="text-base font-semibold text-acai-100">Buscar por CEP ou endereco</h2>
        <p className="mt-1 text-sm text-acai-300">
          Digite um CEP ou endereco para reposicionar automaticamente o pin da cobertura.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="space-y-1">
              <span className="text-sm text-acai-200">CEP</span>
              <input
                className="w-full rounded-md border border-acai-700 bg-acai-950/60 px-3 py-2 text-acai-50"
                placeholder="00000-000"
                value={cepSearch}
                onChange={(event) => setCepSearch(event.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-acai-200">Rua</span>
              <input
                className="w-full rounded-md border border-acai-700 bg-acai-950/60 px-3 py-2 text-acai-50"
                placeholder="Rua, avenida..."
                value={addressSearch}
                onChange={(event) => setAddressSearch(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-sm text-acai-200">Numero</span>
                <input
                  className="w-full rounded-md border border-acai-700 bg-acai-950/60 px-3 py-2 text-acai-50"
                  placeholder="N°"
                  value={streetNumber}
                  onChange={(event) => setStreetNumber(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-acai-200">Bairro</span>
                <input
                  className="w-full rounded-md border border-acai-700 bg-acai-950/60 px-3 py-2 text-acai-50"
                  placeholder="Bairro"
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={onSearchLocation}
              disabled={searchingLocation || saving || publishing}
              className="rounded-md border border-acai-500 px-4 py-2 text-sm font-semibold text-acai-100 hover:bg-acai-800 disabled:opacity-60"
            >
              {searchingLocation ? 'Buscando...' : 'Buscar e posicionar no mapa'}
            </button>
          </div>
          <div>
            <h2 className="text-base font-semibold text-acai-100">Mapa de apoio da cobertura</h2>
            <p className="mt-1 text-sm text-acai-300">
              Clique no mapa para mover o pin. O círculo azul representa o raio de cobertura configurado.
            </p>
            <div className="relative mt-3 overflow-hidden rounded-lg border border-acai-700">
              <DeliveryAreaMap
                latitude={config.defaultLatitude}
                longitude={config.defaultLongitude}
                radiusKm={config.radiusKm}
                onPick={onMapPick}
              />
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-acai-400">
          Pin atual: {config.defaultLatitude.toFixed(6)}, {config.defaultLongitude.toFixed(6)} | Raio:{' '}
          {config.radiusKm.toFixed(1)} km
        </p>
      </section>

      <section className="rounded-2xl border border-acai-700/70 bg-acai-900/70 p-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || importing || publishing}
            className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar configuração'}
          </button>
          <button
            type="button"
            onClick={onPublishToIfood}
            disabled={saving || importing || publishing}
            className="rounded-md border border-emerald-400 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-600/30 disabled:opacity-60"
          >
            {publishing ? 'Publicando no iFood...' : 'Publicar cobertura no iFood'}
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-acai-200">{message}</p> : null}
      </section>
    </main>
  )
}
