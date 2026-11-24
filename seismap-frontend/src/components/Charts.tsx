import { useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getActiveLanguage, useI18n } from '../i18n/LanguageContext';
import type { Language } from '../i18n/types';
import type { ClusterProfile } from '../types/domain';
import { clusterColor, DEPTH_CATEGORY_COLORS } from '../utils/clusterColors';

export type ClusterChartScope = 'top10' | 'all';

type ClusterBarChartProps = {
  profiles: ClusterProfile[];
  clusterScope?: ClusterChartScope;
  onClusterScopeChange?: (scope: ClusterChartScope) => void;
  hideScopeControl?: boolean;
  hideScopeSubtitle?: boolean;
};

type TooltipRecord = Record<string, unknown>;
type TooltipPayloadItem = {
  color?: string;
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  payload?: TooltipRecord;
};
type TooltipVariant = 'distribution' | 'depth' | 'depthPercent' | 'magnitude' | 'depthAverage';
type ChartTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadItem[];
  variant: TooltipVariant;
  lang: Language;
};
type ShareSlice = {
  name: string;
  clusterId: number;
  value: number;
  percentage: number;
  color: string;
};

const TOP_CLUSTER_LIMIT = 10;

const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const countFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const axisCountFormat = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });

function depthSeriesFor(lang: Language) {
  return [
    { key: 'shallow', label: lang === 'en' ? 'Shallow' : 'Dangkal', color: DEPTH_CATEGORY_COLORS.shallow },
    { key: 'medium', label: lang === 'en' ? 'Intermediate' : 'Menengah', color: DEPTH_CATEGORY_COLORS.medium },
    { key: 'deep', label: lang === 'en' ? 'Deep' : 'Dalam', color: DEPTH_CATEGORY_COLORS.deep },
  ] as const;
}

function numericValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function displayNumber(value: unknown, integer = false): string {
  const parsed = numericValue(value);
  return (integer ? countFormat : numberFormat).format(parsed);
}

function displayOptionalNumber(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return numberFormat.format(numericValue(value));
}

function sortProfilesByEventCount(profiles: ClusterProfile[]): ClusterProfile[] {
  return [...profiles].sort((a, b) => b.event_count - a.event_count || a.cluster_id - b.cluster_id);
}

export function formatClusterScopeSubtitle(
  scope: ClusterChartScope,
  totalCount: number,
  isScrollable = scope === 'all' && totalCount > TOP_CLUSTER_LIMIT,
  lang: Language = getActiveLanguage(),
): string {
  if (totalCount <= 0) {
    return lang === 'en' ? 'No cluster profiles available yet.' : 'Belum ada profil klaster yang tersedia.';
  }
  if (totalCount <= TOP_CLUSTER_LIMIT) {
    return lang === 'en'
      ? `Showing all ${displayNumber(totalCount, true)} clusters (sorted by member count).`
      : `Menampilkan seluruh ${displayNumber(totalCount, true)} klaster (urut anggota terbanyak).`;
  }
  if (scope === 'top10') {
    return lang === 'en'
      ? `Showing top ${displayNumber(TOP_CLUSTER_LIMIT, true)} largest of ${displayNumber(totalCount, true)} clusters; all clusters are listed in the profile table.`
      : `Menampilkan ${displayNumber(TOP_CLUSTER_LIMIT, true)} klaster terbesar dari ${displayNumber(totalCount, true)} klaster; seluruh klaster tersedia pada tabel profil.`;
  }
  if (isScrollable) {
    return lang === 'en'
      ? `Showing all ${displayNumber(totalCount, true)} clusters (sorted by member count); scroll horizontally to inspect all.`
      : `Menampilkan seluruh ${displayNumber(totalCount, true)} klaster (urut anggota terbanyak); geser horizontal untuk melihat semua.`;
  }
  return lang === 'en'
    ? `Showing all ${displayNumber(totalCount, true)} clusters (sorted by member count).`
    : `Menampilkan seluruh ${displayNumber(totalCount, true)} klaster (urut anggota terbanyak).`;
}

function useClusterChartData(
  profiles: ClusterProfile[],
  controlledScope?: ClusterChartScope,
  onControlledScopeChange?: (scope: ClusterChartScope) => void,
) {
  const [internalScope, setInternalScope] = useState<ClusterChartScope>('top10');
  const sortedProfiles = useMemo(() => sortProfilesByEventCount(profiles), [profiles]);
  const totalCount = sortedProfiles.length;
  const hasOverflow = totalCount > TOP_CLUSTER_LIMIT;
  const scope = controlledScope ?? internalScope;
  const setScope = onControlledScopeChange ?? setInternalScope;
  const effectiveScope: ClusterChartScope = hasOverflow ? scope : 'all';
  const visibleProfiles = useMemo(
    () => (effectiveScope === 'top10' ? sortedProfiles.slice(0, TOP_CLUSTER_LIMIT) : sortedProfiles),
    [effectiveScope, sortedProfiles],
  );
  const isScrollable = effectiveScope === 'all' && visibleProfiles.length > TOP_CLUSTER_LIMIT;

  return {
    sortedProfiles,
    visibleProfiles,
    totalCount,
    hasOverflow,
    scope: effectiveScope,
    setScope,
    isScrollable,
  };
}

function tooltipTitle(record: TooltipRecord, label: string | number | undefined, lang: Language): string {
  if (typeof record.name === 'string' && record.name.trim()) return record.name;
  if (label !== undefined && label !== null && String(label).trim()) return String(label);
  return lang === 'en' ? 'Data details' : 'Rincian data';
}

function TooltipRow({ label, value, color, suffix }: { label: string; value: string; color: string; suffix?: string }) {
  return (
    <div className="chart-tooltip-row">
      <span className="chart-tooltip-label"><i style={{ backgroundColor: color }} />{label}</span>
      <strong>{value}{suffix && value !== '—' ? <small>{suffix}</small> : null}</strong>
    </div>
  );
}

/** Compact, shared tooltip. The donut uses an adjacent detail list to keep its center clear. */
function ChartTooltip({ active, label, payload, variant, lang }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const record = payload[0]?.payload || {};
  const title = tooltipTitle(record, label, lang);
  const clusterId = typeof record.clusterId === 'number' ? record.clusterId : -1;
  const clusterAccent = clusterColor(clusterId);
  const depthSeries = depthSeriesFor(lang);
  let rows: Array<{ label: string; value: string; color: string; suffix?: string }> = [];
  let kicker = lang === 'en' ? 'CLUSTER DETAILS' : 'RINCIAN KLASTER';
  let total: number | null = null;
  let totalLabel = lang === 'en' ? 'Total events' : 'Total kejadian';
  let totalSuffix = '';

  if (variant === 'distribution') {
    rows = [{ label: lang === 'en' ? 'Event count' : 'Jumlah kejadian', value: displayNumber(record.total, true), color: clusterAccent }];
  } else if (variant === 'depth' || variant === 'depthPercent') {
    kicker = lang === 'en' ? 'DEPTH PROFILE' : 'PROFIL KEDALAMAN';
    const isPercentage = variant === 'depthPercent';
    rows = depthSeries.map((series) => ({
      label: series.label,
      value: displayNumber(record[series.key], !isPercentage),
      color: series.color,
      suffix: isPercentage ? '%' : undefined,
    }));
    total = isPercentage
      ? depthSeries.some((series) => numericValue(record[`${series.key}Count`]) > 0) ? 100 : 0
      : depthSeries.reduce((sum, series) => sum + numericValue(record[series.key]), 0);
    totalLabel = isPercentage
      ? (lang === 'en' ? 'Total composition' : 'Total komposisi')
      : (lang === 'en' ? 'Total events' : 'Total kejadian');
    totalSuffix = isPercentage ? '%' : '';
  } else if (variant === 'magnitude') {
    kicker = lang === 'en' ? 'AVERAGE MAGNITUDE' : 'RATA-RATA MAGNITUDO';
    rows = [{ label: lang === 'en' ? 'Mean magnitude' : 'Magnitudo rata-rata', value: displayOptionalNumber(record.magnitude), color: clusterAccent }];
  } else {
    kicker = lang === 'en' ? 'AVERAGE DEPTH' : 'RATA-RATA KEDALAMAN';
    rows = [{ label: lang === 'en' ? 'Mean depth' : 'Kedalaman rata-rata', value: displayOptionalNumber(record.depth), color: clusterAccent, suffix: ' km' }];
  }

  return (
    <div className={`chart-tooltip chart-tooltip-${variant}`} role="status" aria-live="polite">
      <div className="chart-tooltip-heading">
        <span>{kicker}</span>
        <strong>{title}</strong>
      </div>
      <div className="chart-tooltip-rows">
        {rows.map((row) => <TooltipRow key={row.label} {...row} />)}
      </div>
      {total !== null && (
        <div className="chart-tooltip-total">
          <span>{totalLabel}</span>
          <strong>{displayNumber(total, !totalSuffix)}{totalSuffix}</strong>
        </div>
      )}
    </div>
  );
}

const tooltipWrapperStyle = {
  zIndex: 40,
  outline: 'none',
  pointerEvents: 'none' as const,
};

const axisTick = { fill: '#A9BBD0', fontSize: 10 };
const gridStroke = 'rgba(189,213,238,.08)';

function ChartModeButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return <button type="button" className={`chart-mode-button${active ? ' active' : ''}`} aria-pressed={active} onClick={onClick}>{children}</button>;
}

export function ClusterScopeControl({
  totalCount,
  scope,
  onChange,
  hideSubtitle = false,
}: {
  totalCount: number;
  scope: ClusterChartScope;
  onChange: (nextScope: ClusterChartScope) => void;
  hideSubtitle?: boolean;
}) {
  const { lang, tx } = useI18n();
  const hasOverflow = totalCount > TOP_CLUSTER_LIMIT;
  const effectiveScope: ClusterChartScope = hasOverflow ? scope : 'all';
  const isScrollable = effectiveScope === 'all' && totalCount > TOP_CLUSTER_LIMIT;

  if (!hasOverflow && hideSubtitle) return null;

  return (
    <div className="chart-scope-block">
      {hasOverflow && (
        <div className="chart-mode-row">
          <span className="chart-mode-label">{tx('Cakupan klaster', 'Cluster scope')}</span>
          <div className="chart-mode-group" role="group" aria-label={tx('Pilih jumlah klaster yang ditampilkan', 'Select number of clusters displayed')}>
            <ChartModeButton active={effectiveScope === 'top10'} onClick={() => onChange('top10')}>{tx('10 Terbesar', 'Top 10')}</ChartModeButton>
            <ChartModeButton active={effectiveScope === 'all'} onClick={() => onChange('all')}>{tx('Semua Klaster', 'All Clusters')}</ChartModeButton>
          </div>
        </div>
      )}
      {!hideSubtitle && (
        <p className="chart-mode-hint">{formatClusterScopeSubtitle(effectiveScope, totalCount, isScrollable, lang)}</p>
      )}
    </div>
  );
}

function ScrollableChartFrame({
  isScrollable,
  itemCount,
  compact = false,
  children,
}: {
  isScrollable: boolean;
  itemCount: number;
  compact?: boolean;
  children: ReactNode;
}) {
  const canvasWidth = isScrollable
    ? Math.max(compact ? 480 : 580, itemCount * (compact ? 64 : 68))
    : undefined;

  return (
    <div className={isScrollable ? 'chart-scroll-x' : undefined}>
      <div
        className={`chart-wrap${compact ? ' chart-wrap-compact' : ''}`}
        style={canvasWidth ? { width: `${canvasWidth}px`, minWidth: '100%' } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export function ClusterDistributionChart({
  profiles,
  clusterScope,
  onClusterScopeChange,
  hideScopeControl = false,
  hideScopeSubtitle = false,
}: ClusterBarChartProps) {
  const { lang, tx } = useI18n();
  const [scaleMode, setScaleMode] = useState<'linear' | 'log'>('linear');
  const { visibleProfiles, totalCount, scope, setScope, isScrollable } = useClusterChartData(
    profiles,
    clusterScope,
    onClusterScopeChange,
  );

  const data = visibleProfiles.map((item) => ({
    name: `${tx('Klaster', 'Cluster')} ${item.cluster_id}`,
    clusterId: item.cluster_id,
    total: item.event_count,
    chartTotal: scaleMode === 'log' && item.event_count <= 0 ? null : item.event_count,
  }));

  return (
    <div className="chart-module">
      <div className="chart-mode-row">
        <span className="chart-mode-label">{tx('Skala jumlah anggota', 'Member count scale')}</span>
        <div className="chart-mode-group" role="group" aria-label={tx('Pilih skala grafik jumlah anggota', 'Select member count chart scale')}>
          <ChartModeButton active={scaleMode === 'linear'} onClick={() => setScaleMode('linear')}>Linear</ChartModeButton>
          <ChartModeButton active={scaleMode === 'log'} onClick={() => setScaleMode('log')}>{tx('Logaritmik', 'Logarithmic')}</ChartModeButton>
        </div>
      </div>
      {!hideScopeControl && (
        <ClusterScopeControl
          totalCount={totalCount}
          scope={scope}
          onChange={setScope}
          hideSubtitle={hideScopeSubtitle}
        />
      )}
      <p className="chart-mode-hint">{tx('Skala logaritmik membantu membandingkan klaster kecil ketika jumlah anggotanya berbeda jauh.', 'Logarithmic scale helps compare smaller clusters when member counts span wide ranges.')}</p>
      <ScrollableChartFrame isScrollable={isScrollable} itemCount={data.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 10, left: -14, bottom: 0 }}>
            <CartesianGrid stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="name"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              interval={isScrollable ? 0 : 'preserveEnd'}
              minTickGap={isScrollable ? 4 : 10}
            />
            <YAxis
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              scale={scaleMode === 'log' ? 'log' : 'auto'}
              domain={scaleMode === 'log' ? [1, 'auto'] : [0, 'auto']}
              tickFormatter={(value: number) => axisCountFormat.format(value)}
            />
            <Tooltip content={<ChartTooltip variant="distribution" lang={lang} />} cursor={false} wrapperStyle={tooltipWrapperStyle} allowEscapeViewBox={{ x: false, y: false }} />
            <Bar dataKey="chartTotal" radius={[6, 6, 0, 0]} activeBar={{ stroke: 'rgba(235,245,255,.62)', strokeWidth: 1, fillOpacity: 0.96 }}>
              {data.map((item) => <Cell key={item.clusterId} fill={clusterColor(item.clusterId)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ScrollableChartFrame>
    </div>
  );
}

export function DepthProfileChart({
  profiles,
  clusterScope,
  onClusterScopeChange,
  hideScopeControl = false,
  hideScopeSubtitle = false,
}: ClusterBarChartProps) {
  const { lang, tx } = useI18n();
  const [displayMode, setDisplayMode] = useState<'count' | 'percentage'>('count');
  const { visibleProfiles, totalCount, scope, setScope, isScrollable } = useClusterChartData(
    profiles,
    clusterScope,
    onClusterScopeChange,
  );

  const data = visibleProfiles.map((item) => {
    const shallowCount = item.shallow_event_count;
    const mediumCount = item.medium_event_count;
    const deepCount = item.deep_event_count;
    const total = shallowCount + mediumCount + deepCount;
    const toPercent = (value: number) => total > 0 ? (value / total) * 100 : 0;
    return {
      name: `${tx('Klaster', 'Cluster')} ${item.cluster_id}`,
      clusterId: item.cluster_id,
      shallow: displayMode === 'percentage' ? toPercent(shallowCount) : shallowCount,
      medium: displayMode === 'percentage' ? toPercent(mediumCount) : mediumCount,
      deep: displayMode === 'percentage' ? toPercent(deepCount) : deepCount,
      shallowCount,
      mediumCount,
      deepCount,
    };
  });

  return (
    <div className="chart-module">
      <div className="chart-mode-row">
        <span className="chart-mode-label">{tx('Tampilan profil', 'Profile view')}</span>
        <div className="chart-mode-group" role="group" aria-label={tx('Pilih tampilan profil kedalaman', 'Select depth profile view')}>
          <ChartModeButton active={displayMode === 'count'} onClick={() => setDisplayMode('count')}>{tx('Jumlah', 'Count')}</ChartModeButton>
          <ChartModeButton active={displayMode === 'percentage'} onClick={() => setDisplayMode('percentage')}>{tx('Persentase', 'Percentage')}</ChartModeButton>
        </div>
      </div>
      {!hideScopeControl && (
        <ClusterScopeControl
          totalCount={totalCount}
          scope={scope}
          onChange={setScope}
          hideSubtitle={hideScopeSubtitle}
        />
      )}
      <ScrollableChartFrame isScrollable={isScrollable} itemCount={data.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 10, left: -14, bottom: 0 }}>
            <CartesianGrid stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="name"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              interval={isScrollable ? 0 : 'preserveEnd'}
              minTickGap={isScrollable ? 4 : 10}
            />
            <YAxis
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              domain={displayMode === 'percentage' ? [0, 100] : [0, 'auto']}
              ticks={displayMode === 'percentage' ? [0, 25, 50, 75, 100] : undefined}
              tickFormatter={(value: number) => displayMode === 'percentage' ? `${Math.round(value)}%` : axisCountFormat.format(value)}
            />
            <Tooltip content={<ChartTooltip variant={displayMode === 'percentage' ? 'depthPercent' : 'depth'} lang={lang} />} cursor={false} wrapperStyle={tooltipWrapperStyle} allowEscapeViewBox={{ x: false, y: false }} />
            <Bar dataKey="shallow" stackId="a" fill={DEPTH_CATEGORY_COLORS.shallow} activeBar={{ stroke: 'rgba(235,245,255,.62)', strokeWidth: 1, fillOpacity: 0.96 }} />
            <Bar dataKey="medium" stackId="a" fill={DEPTH_CATEGORY_COLORS.medium} activeBar={{ stroke: 'rgba(235,245,255,.62)', strokeWidth: 1, fillOpacity: 0.96 }} />
            <Bar dataKey="deep" stackId="a" fill={DEPTH_CATEGORY_COLORS.deep} radius={[5, 5, 0, 0]} activeBar={{ stroke: 'rgba(235,245,255,.62)', strokeWidth: 1, fillOpacity: 0.96 }} />
          </BarChart>
        </ResponsiveContainer>
      </ScrollableChartFrame>
    </div>
  );
}

export function ClusterShareChart({ profiles, clusterCount }: { profiles: ClusterProfile[]; clusterCount: number }) {
  const { tx } = useI18n();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const totalEvents = profiles.reduce((sum, item) => sum + item.event_count, 0);
  const rankedProfiles = useMemo(() => sortProfilesByEventCount(profiles), [profiles]);
  const visibleProfiles = rankedProfiles.slice(0, 6);
  const remainingProfiles = rankedProfiles.slice(6);
  const data: ShareSlice[] = visibleProfiles.map((item) => ({
    name: `${tx('Klaster', 'Cluster')} ${item.cluster_id}`,
    clusterId: item.cluster_id,
    value: item.event_count,
    percentage: totalEvents > 0 ? (item.event_count / totalEvents) * 100 : 0,
    color: clusterColor(item.cluster_id),
  }));

  if (remainingProfiles.length > 0) {
    const remainingCount = remainingProfiles.reduce((sum, item) => sum + item.event_count, 0);
    data.push({
      name: tx(`Klaster lainnya (${remainingProfiles.length})`, `Other clusters (${remainingProfiles.length})`),
      clusterId: -2,
      value: remainingCount,
      percentage: totalEvents > 0 ? (remainingCount / totalEvents) * 100 : 0,
      color: '#8299AD',
    });
  }

  return (
    <div className="share-chart-layout">
      <div className="share-chart-plot">
        <div className="chart-wrap chart-wrap-donut">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="59%"
                outerRadius="82%"
                paddingAngle={2}
                activeIndex={activeIndex ?? -1}
                activeShape={{ stroke: 'rgba(235,245,255,.82)', strokeWidth: 2 }}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {data.map((item) => <Cell key={item.clusterId} fill={item.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-center"><strong>{displayNumber(clusterCount, true)}</strong><span>{tx('KLASTER', 'CLUSTERS')}</span></div>
      </div>
      <div className="share-chart-details">
        <div className="share-chart-details-heading">
          <strong>{tx('Anggota dan proporsi', 'Members & share')}</strong>
          <span>{remainingProfiles.length > 0 ? tx('6 terbesar + lainnya', 'Top 6 + others') : tx('Seluruh klaster', 'All clusters')}</span>
        </div>
        <div className="share-chart-list">
          {data.map((item, index) => (
            <button
              type="button"
              key={item.clusterId}
              className={`share-chart-item${activeIndex === index ? ' active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
              aria-pressed={activeIndex === index}
              aria-label={tx(`${item.name}, ${displayNumber(item.value, true)} anggota, ${displayNumber(item.percentage)} persen`, `${item.name}, ${displayNumber(item.value, true)} members, ${displayNumber(item.percentage)} percent`)}
            >
              <i className="share-chart-dot" style={{ backgroundColor: item.color }} />
              <span className="share-chart-item-name">{item.name}</span>
              <strong>{displayNumber(item.value, true)}</strong>
              <small>{displayNumber(item.percentage)}%</small>
            </button>
          ))}
        </div>
        <p className="share-chart-footnote">{tx('Proporsi dihitung dari seluruh anggota profil klaster.', 'Shares are calculated across all cluster profile members.')}</p>
      </div>
    </div>
  );
}

export function MagnitudeProfileChart({
  profiles,
  clusterScope,
  onClusterScopeChange,
  hideScopeControl = false,
  hideScopeSubtitle = false,
}: ClusterBarChartProps) {
  const { lang, tx } = useI18n();
  const { visibleProfiles, totalCount, scope, setScope, isScrollable } = useClusterChartData(
    profiles,
    clusterScope,
    onClusterScopeChange,
  );

  const data = visibleProfiles.map((item) => ({
    name: `${tx('Klaster', 'Cluster')} ${item.cluster_id}`,
    clusterId: item.cluster_id,
    magnitude: item.avg_magnitude,
  }));

  return (
    <div className="chart-module">
      {!hideScopeControl && (
        <ClusterScopeControl
          totalCount={totalCount}
          scope={scope}
          onChange={setScope}
          hideSubtitle={hideScopeSubtitle}
        />
      )}
      <ScrollableChartFrame isScrollable={isScrollable} itemCount={data.length} compact>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
            <CartesianGrid stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="name"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              interval={isScrollable ? 0 : 'preserveEnd'}
              minTickGap={isScrollable ? 4 : 8}
            />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} domain={[0, 'auto']} tickFormatter={(value: number) => displayNumber(value)} />
            <Tooltip content={<ChartTooltip variant="magnitude" lang={lang} />} cursor={false} wrapperStyle={tooltipWrapperStyle} allowEscapeViewBox={{ x: false, y: false }} />
            <Bar dataKey="magnitude" radius={[6, 6, 0, 0]} activeBar={{ stroke: 'rgba(235,245,255,.62)', strokeWidth: 1, fillOpacity: 0.96 }}>
              {data.map((item) => <Cell key={item.clusterId} fill={clusterColor(item.clusterId)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ScrollableChartFrame>
    </div>
  );
}

export function DepthAverageChart({
  profiles,
  clusterScope,
  onClusterScopeChange,
  hideScopeControl = false,
  hideScopeSubtitle = false,
}: ClusterBarChartProps) {
  const { lang, tx } = useI18n();
  const { visibleProfiles, totalCount, scope, setScope, isScrollable } = useClusterChartData(
    profiles,
    clusterScope,
    onClusterScopeChange,
  );

  const data = visibleProfiles.map((item) => ({
    name: `${tx('Klaster', 'Cluster')} ${item.cluster_id}`,
    clusterId: item.cluster_id,
    depth: item.avg_depth,
  }));

  return (
    <div className="chart-module">
      {!hideScopeControl && (
        <ClusterScopeControl
          totalCount={totalCount}
          scope={scope}
          onChange={setScope}
          hideSubtitle={hideScopeSubtitle}
        />
      )}
      <ScrollableChartFrame isScrollable={isScrollable} itemCount={data.length} compact>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
            <CartesianGrid stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="name"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              interval={isScrollable ? 0 : 'preserveEnd'}
              minTickGap={isScrollable ? 4 : 8}
            />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} domain={[0, 'auto']} tickFormatter={(value: number) => axisCountFormat.format(value)} />
            <Tooltip content={<ChartTooltip variant="depthAverage" lang={lang} />} cursor={false} wrapperStyle={tooltipWrapperStyle} allowEscapeViewBox={{ x: false, y: false }} />
            <Bar dataKey="depth" radius={[6, 6, 0, 0]} activeBar={{ stroke: 'rgba(235,245,255,.62)', strokeWidth: 1, fillOpacity: 0.96 }}>
              {data.map((item) => <Cell key={item.clusterId} fill={clusterColor(item.clusterId)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ScrollableChartFrame>
    </div>
  );
}
