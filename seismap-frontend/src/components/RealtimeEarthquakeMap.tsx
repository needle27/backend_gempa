import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { RealtimeEarthquake } from '../types/domain';
import { formatNumber } from './ui';

function validCoordinate(item: RealtimeEarthquake) {
  return Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
    && item.latitude >= -90 && item.latitude <= 90
    && item.longitude >= -180 && item.longitude <= 180;
}

function MapLayoutFix() {
  const map = useMap();

  useEffect(() => {
    let frame = 0;
    let secondFrame = 0;
    const refreshSize = () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(secondFrame);
      frame = requestAnimationFrame(() => {
        map.invalidateSize({ pan: false, animate: false });
        secondFrame = requestAnimationFrame(() => {
          map.invalidateSize({ pan: false, animate: false });
        });
      });
    };

    refreshSize();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(refreshSize)
      : null;
    observer?.observe(map.getContainer());
    window.addEventListener('resize', refreshSize);

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(secondFrame);
      observer?.disconnect();
      window.removeEventListener('resize', refreshSize);
    };
  }, [map]);

  return null;
}

function FocusBounds({ items }: { items: RealtimeEarthquake[] }) {
  const map = useMap();
  useEffect(() => {
    const valid = items.filter(validCoordinate);
    if (!valid.length) return;

    // Wait for Leaflet to receive the final container dimensions before fitting.
    const frame = requestAnimationFrame(() => {
      map.invalidateSize({ pan: false, animate: false });
      if (valid.length === 1) {
        map.setView([valid[0].latitude, valid[0].longitude], 6, { animate: false });
      } else {
        const bounds = L.latLngBounds(valid.map((item) => [item.latitude, item.longitude] as [number, number]));
        map.fitBounds(bounds.pad(0.18), { maxZoom: 6, animate: false });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [items, map]);
  return null;
}

const latestIcon = L.divIcon({
  className: 'realtime-latest-marker-wrap',
  html: '<span class="realtime-latest-marker"><span></span></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -14],
});

export function RealtimeEarthquakeMap({ items, highlightLatest = false }: {
  items: RealtimeEarthquake[];
  highlightLatest?: boolean;
}) {
  const validItems = items.filter(validCoordinate);
  const [tileErrors, setTileErrors] = useState(0);
  const first = validItems[0];
  const center: [number, number] = first ? [first.latitude, first.longitude] : [-2.5, 118];

  return <section className="realtime-map-card glass-card">
    <div className="realtime-map-heading">
      <div>
        <span className="eyebrow">LOKASI KEJADIAN</span>
        <h3>{highlightLatest ? 'Peta gempa terbaru' : 'Sebaran kejadian pada peta'}</h3>
        <p>{highlightLatest ? 'Penanda bercahaya menunjukkan lokasi gempa terbaru dari BMKG.' : 'Pilih penanda untuk melihat ringkasan kejadian gempa.'}</p>
      </div>
      <span className="realtime-map-count">{validItems.length} titik</span>
    </div>
    <div className="realtime-map-frame">
      <MapContainer center={center} zoom={highlightLatest ? 6 : 4} scrollWheelZoom zoomControl preferCanvas>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          keepBuffer={3}
          updateWhenIdle
          updateWhenZooming={false}
          eventHandlers={{
            tileerror: () => setTileErrors((count) => count + 1),
          }}
        />
        <MapLayoutFix />
        <FocusBounds items={validItems} />
        {validItems.map((item, index) => {
          const popup = <Popup>
            <div className="realtime-map-popup">
              <strong>{item.region || 'Lokasi tidak tersedia'}</strong>
              <span>Magnitudo {formatNumber(item.magnitude, 1)}</span>
              <span>Kedalaman {item.depth_label || (item.depth_km === null ? '—' : `${item.depth_km} km`)}</span>
              <span>{item.date_local || '—'} · {item.time_local || '—'}</span>
              <span>{formatNumber(item.latitude, 3)}, {formatNumber(item.longitude, 3)}</span>
            </div>
          </Popup>;
          return highlightLatest && index === 0
            ? <Marker key={`${item.event_time_utc || index}-latest`} position={[item.latitude, item.longitude]} icon={latestIcon}>{popup}</Marker>
            : <CircleMarker
                key={`${item.event_time_utc || index}-${index}`}
                center={[item.latitude, item.longitude]}
                radius={highlightLatest ? 6 : 5}
                pathOptions={{ color: highlightLatest ? '#f4c16d' : '#43cde0', fillColor: highlightLatest ? '#f4c16d' : '#43cde0', fillOpacity: 0.82, weight: 1.5 }}
              >{popup}</CircleMarker>;
        })}
      </MapContainer>
    </div>
    {tileErrors > 0 && <div className="realtime-map-tile-warning" role="status">
      Sebagian gambar peta belum berhasil dimuat. Periksa koneksi internet, lalu coba muat ulang halaman.
    </div>}
    <div className="realtime-map-footer">
      <span><i className={highlightLatest ? 'realtime-map-dot latest' : 'realtime-map-dot'} />{highlightLatest ? 'Gempa terbaru' : 'Lokasi kejadian'}</span>
      <span>Koordinat: lintang · bujur</span>
      <span>Sumber: BMKG</span>
    </div>
  </section>;
}
