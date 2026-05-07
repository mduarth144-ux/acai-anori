'use client'

import { MapContainer, Marker, TileLayer, Circle, useMapEvents } from 'react-leaflet'
import { divIcon } from 'leaflet'

const pinIcon = divIcon({
  className: 'delivery-map-pin',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function MapClickHandler(props: { onPick: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(event) {
      props.onPick(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

export function DeliveryAreaMap(props: {
  latitude: number
  longitude: number
  radiusKm: number
  onPick: (latitude: number, longitude: number) => void
}) {
  const center: [number, number] = [props.latitude, props.longitude]

  return (
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom
      className="h-[340px] w-full rounded-lg border border-acai-700"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle
        center={center}
        radius={Math.max(props.radiusKm, 0.1) * 1000}
        pathOptions={{ color: '#38bdf8', fillColor: '#38bdf8', fillOpacity: 0.15, weight: 2 }}
      />
      <Marker position={center} icon={pinIcon} />
      <MapClickHandler onPick={props.onPick} />
    </MapContainer>
  )
}
