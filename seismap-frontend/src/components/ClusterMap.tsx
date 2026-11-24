import { memo, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useI18n } from '../i18n/LanguageContext';
import type { Language } from '../i18n/types';
import type { ResearchEarthquake } from '../types/domain';
import { clusterColor, NOISE_COLOR } from '../utils/clusterColors';
import 'leaflet/dist/leaflet.css';

function colorFor(clusterId: number, noise: boolean) {
  return noise ? NOISE_COLOR : clusterColor(clusterId);
}

function escapeHtml(value: unknown): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  };
  return String(value ?? '—').replace(/[&<>'"]/g, (character) => entities[character] ?? character);
}

const mapDateFormatterId = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const mapDateFormatterEn = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const mapDateOnlyFormatterId = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const mapDateOnlyFormatterEn = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const magnitudeFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const depthFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 2,
});

function formatPointDate(value: string | null | undefined, lang: Language): string {
  if (!value) return '—';
  const trimmed = value.trim();
  if (!trimmed) return '—';
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return (lang === 'en' ? mapDateOnlyFormatterEn : mapDateOnlyFormatterId).format(parsed);
  }
  return (lang === 'en' ? mapDateFormatterEn : mapDateFormatterId).format(parsed);
}

function tooltipContent(point: ResearchEarthquake, lang: Language): string {
  const location = point.lokasi || (lang === 'en' ? 'Location unavailable' : 'Lokasi tidak tersedia');
  const formattedDate = formatPointDate(point.tanggal, lang);
  const magnitudeValue = Number(point.magnitude);
  const formattedMagnitude = Number.isFinite(magnitudeValue)
    ? magnitudeFormatter.format(magnitudeValue)
    : '—';
  const depthValue = point.kedalaman === null ? NaN : Number(point.kedalaman);
  const depth = Number.isFinite(depthValue) ? `${depthFormatter.format(depthValue)} km` : '—';
  const cluster = point.is_noise || point.cluster_id === -1
    ? 'Noise (−1)'
    : (lang === 'en' ? `Cluster ${point.cluster_id}` : `Klaster ${point.cluster_id}`);
  const labels = lang === 'en'
    ? { id: 'Event ID', date: 'Date', mag: 'Magnitude', depth: 'Depth', group: 'Group' }
    : { id: 'ID kejadian', date: 'Tanggal', mag: 'Magnitudo', depth: 'Kedalaman', group: 'Kelompok' };

  return `<div class="map-tooltip-content">
    <strong>${escapeHtml(location)}</strong>
    <span>${labels.id}: ${escapeHtml(point.event_id)}</span>
    <span>${labels.date}: ${escapeHtml(formattedDate)}</span>
    <span>${labels.mag}: ${escapeHtml(formattedMagnitude)}</span>
    <span>${labels.depth}: ${escapeHtml(depth)}</span>
    <span>${labels.group}: ${escapeHtml(cluster)}</span>
  </div>`;
}

/**
 * Render marker langsung melalui Leaflet agar ribuan titik tidak membuat
 * ribuan subtree React dan popup/tooltip terpisah.
 * Hover menampilkan Tooltip ringkas; klik/tap membuka L.popup agar ramah layar sentuh.
 */
function MapPoints({ points, compact, lang }: { points: ResearchEarthquake[]; compact: boolean; lang: Language }) {
  const map = useMap();

  useEffect(() => {
    const layer = L.layerGroup().addTo(map);
    const renderer = L.canvas({ padding: 0.35 });
    const sharedTooltip = L.tooltip({
      direction: 'auto',
      offset: [0, -8],
      className: 'seismap-map-tooltip',
      opacity: 1,
    });
    const sharedPopup = L.popup({
      offset: [0, -6],
      className: 'seismap-map-popup',
      closeButton: true,
      autoClose: true,
      closeOnClick: true,
      maxWidth: 280,
    });
    const boundsPoints: Array<[number, number]> = [];

    points.forEach((point) => {
      const latitude = Number(point.latitude);
      const longitude = Number(point.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;

      const color = colorFor(point.cluster_id, point.is_noise);
      const marker = L.circleMarker([latitude, longitude], {
        renderer,
        radius: compact ? 3.5 : 4,
        color,
        fillColor: color,
        fillOpacity: 0.68,
        opacity: 0.76,
        weight: 0.7,
      });

      const showHoverTooltip = () => {
        if (sharedPopup.isOpen()) return;
        sharedTooltip
          .setLatLng(marker.getLatLng())
          .setContent(tooltipContent(point, lang));
        map.openTooltip(sharedTooltip);
      };

      const showClickPopup = () => {
        map.closeTooltip(sharedTooltip);
        sharedPopup
          .setLatLng(marker.getLatLng())
          .setContent(tooltipContent(point, lang));
        map.openPopup(sharedPopup);
      };

      marker.on('mouseover', showHoverTooltip);
      marker.on('mouseout', () => map.closeTooltip(sharedTooltip));
      marker.on('click', showClickPopup);
      marker.addTo(layer);
      boundsPoints.push([latitude, longitude]);
    });

    if (boundsPoints.length) {
      map.fitBounds(L.latLngBounds(boundsPoints).pad(0.12), {
        maxZoom: 5,
        animate: false,
      });
    }

    return () => {
      map.closeTooltip(sharedTooltip);
      map.closePopup(sharedPopup);
      sharedTooltip.remove();
      sharedPopup.remove();
      layer.removeFrom(map);
    };
  }, [map, points, compact, lang]);

  return null;
}

function ClusterMapView({ points, compact = false, className = '' }: { points: ResearchEarthquake[]; compact?: boolean; className?: string }) {
  const { lang } = useI18n();
  const center: [number, number] = [-2.5, 118];
  return <div className={`map-frame ${compact ? 'map-compact' : ''} ${className}`}>
    <MapContainer center={center} zoom={4} scrollWheelZoom={!compact} zoomControl={!compact} preferCanvas style={{ height: '100%', width: '100%' }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapPoints points={points} compact={compact} lang={lang} />
    </MapContainer>
  </div>;
}

export const ClusterMap = memo(ClusterMapView);
