import type { RealtimeEarthquake, RealtimeFeed } from '../types/domain';

const sample: RealtimeEarthquake = {
  event_time_utc: '2026-11-14T03:15:00+00:00', date_local: '14 Nov 2026', time_local: '10:15:00 WIB',
  magnitude: 4.8, depth_km: 10, latitude: -6.2, longitude: 106.8, coordinates: [-6.2, 106.8],
  latitude_label: '6.20 LS', longitude_label: '106.80 BT', depth_label: '10 km', region: 'Contoh wilayah (data simulasi)',
  tsunami_potential: 'Tidak tersedia pada fixture simulasi', felt: null, shakemap_url: null,
};

function feed(category: 'latest' | 'm5' | 'felt', earthquakes: RealtimeEarthquake[]): RealtimeFeed<RealtimeEarthquake> {
  return {
    source: 'BMKG', source_name: 'Badan Meteorologi, Klimatologi, dan Geofisika', source_url: 'https://data.bmkg.go.id/gempabumi/',
    category, fetched_at: new Date().toISOString(), cache_status: 'HIT', is_stale: false, warning: null,
    cache_ttl_seconds: 60, count: earthquakes.length,
    ...(category === 'latest' ? { earthquake: earthquakes[0] } : { earthquakes }),
  };
}

export const previewRealtime = {
  latest: feed('latest', [sample]),
  m5: feed('m5', [{ ...sample, magnitude: 5.3, region: 'Contoh wilayah M 5.0+ (simulasi)' }]),
  felt: feed('felt', [{ ...sample, felt: 'Contoh intensitas (simulasi)', region: 'Contoh wilayah dirasakan (simulasi)' }]),
};
