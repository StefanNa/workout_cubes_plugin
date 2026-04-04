const DEFAULT_THEME = {
  bgStart: '#07111f',
  bgEnd: '#111826',
  panel: '#0f1a2b',
  panelHighlight: '#16243a',
  panelStroke: '#24344b',
  text: '#e8eef8',
  subtleText: '#99abc4',
  accent: '#d06cff',
  accentSoft: '#7a4de8',
  empty: '#132033',
  emptyStroke: '#1b2a42',
  greenRamp: ['#203c39', '#245652', '#2f7269', '#4ba28f'],
  purpleRamp: ['#5f3fd6', '#8c48e5', '#b55df5', '#e087ff'],
};

const FONT_SANS = 'Avenir Next, Segoe UI, Helvetica Neue, Arial, sans-serif';
const FONT_DISPLAY = 'Avenir Next Condensed, Trebuchet MS, Segoe UI, sans-serif';
const CELL_SIZE = 10;
const CELL_GAP = 3;
const CARD_LEFT = 18;
const GRID_LEFT = 30;
const GRID_TOP = 146;
const WEEKDAY_LABEL_WIDTH = 28;
const RIGHT_PADDING = 24;
const BOTTOM_PADDING = 40;
const HEADER_HEIGHT = 96;
const STATS_TOP = 86;
const STATS_HEIGHT = 40;

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function clampRampIndex(count, maxCount, rampLength) {
  if (count <= 0 || maxCount <= 0) {
    return -1;
  }

  const normalized = count / maxCount;
  const index = Math.ceil(normalized * rampLength) - 1;
  return Math.max(0, Math.min(rampLength - 1, index));
}

function dayPresentation(day, theme, maxGreen, maxPurple) {
  if (day.totalContributionCount <= 0) {
    return {
      fill: theme.empty,
      stroke: theme.emptyStroke,
      kind: 'empty',
    };
  }

  if (day.targetRepoContributionCount > 0) {
    const idx = clampRampIndex(day.targetRepoContributionCount, maxPurple || 1, theme.purpleRamp.length);
    return {
      fill: theme.purpleRamp[idx],
      stroke: 'rgba(255,255,255,0.08)',
      kind: 'target',
    };
  }

  const idx = clampRampIndex(day.totalContributionCount, maxGreen || 1, theme.greenRamp.length);
  return {
    fill: theme.greenRamp[idx],
    stroke: 'rgba(255,255,255,0.04)',
    kind: 'other',
  };
}

function monthKey(dateString) {
  if (typeof dateString !== 'string' || dateString.length < 7) {
    return '';
  }
  return dateString.slice(0, 7);
}

export function buildMonthLabels(months, weeks) {
  const visibleColumnByMonth = new Map();

  for (let col = 0; col < weeks.length; col += 1) {
    const week = weeks[col];
    for (const day of week.contributionDays || []) {
      const key = monthKey(day.date);
      if (key && !visibleColumnByMonth.has(key)) {
        visibleColumnByMonth.set(key, col);
      }
    }
  }

  const labels = [];
  let lastX = Number.NEGATIVE_INFINITY;
  const minGap = CELL_SIZE + CELL_GAP + 6;

  for (const month of months || []) {
    const key = monthKey(month.firstDay);
    const column = visibleColumnByMonth.get(key);
    if (column === undefined) {
      continue;
    }

    const x = GRID_LEFT + WEEKDAY_LABEL_WIDTH + column * (CELL_SIZE + CELL_GAP);
    if (x - lastX < minGap) {
      continue;
    }

    labels.push({
      text: month.name.slice(0, 3),
      x,
    });
    lastX = x;
  }

  return labels;
}

function formatWindowLabel(fromDateKey, toDateKey) {
  return `${fromDateKey} to ${toDateKey}`;
}

function createStatCards(stats, theme, gridWidth) {
  const cards = [
    {
      label: 'Target Days',
      value: String(stats.totalTargetDays ?? 0),
    },
    {
      label: 'Last 30 Days',
      value: String(stats.last30TargetDays ?? 0),
    },
    {
      label: '2x/Week Streak',
      value: `${stats.currentStreak ?? 0}w`,
    },
  ];

  const gap = 10;
  const cardWidth = Math.floor((gridWidth - gap * 2) / 3);

  return cards
    .map((card, index) => {
      const x = CARD_LEFT + index * (cardWidth + gap);
      return `
  <rect x="${x}" y="${STATS_TOP}" width="${cardWidth}" height="${STATS_HEIGHT}" rx="12" fill="${theme.panel}" stroke="${theme.panelStroke}" />
  <text x="${x + 12}" y="${STATS_TOP + 16}" font-family="${FONT_SANS}" font-size="9" font-weight="600" fill="${theme.subtleText}" letter-spacing="0.7">${escapeXml(card.label.toUpperCase())}</text>
  <text x="${x + 12}" y="${STATS_TOP + 31}" font-family="${FONT_DISPLAY}" font-size="18" font-weight="700" fill="${theme.text}">${escapeXml(card.value)}</text>`;
    })
    .join('\n');
}

function estimateTextWidth(label, fontSize = 9) {
  return Math.ceil(String(label).length * fontSize * 0.62);
}

export function renderContributionSvg(data, options = {}) {
  const theme = { ...DEFAULT_THEME, ...(options.theme || {}) };
  const targetRepoLabel = options.targetRepoLabel || 'target repo';
  const anyRepoLabel = options.anyRepoLabel || 'Other repos';
  const weeks = data.weeks || [];
  const stats = data.stats || {};
  const weekCount = weeks.length;

  const gridWidth = weekCount * (CELL_SIZE + CELL_GAP) - CELL_GAP;
  const gridHeight = 7 * (CELL_SIZE + CELL_GAP) - CELL_GAP;
  const baseWidth = GRID_LEFT + WEEKDAY_LABEL_WIDTH + gridWidth + RIGHT_PADDING;
  const svgWidth = Math.max(baseWidth, CARD_LEFT * 2 + 348);
  const svgHeight = GRID_TOP + gridHeight + BOTTOM_PADDING;
  const monthLabels = buildMonthLabels(data.months, weeks);

  const weekdayLabels = [
    { text: 'Mon', row: 1 },
    { text: 'Wed', row: 3 },
    { text: 'Fri', row: 5 },
  ];

  const cells = [];
  for (let col = 0; col < weekCount; col += 1) {
    const week = weeks[col];
    for (let row = 0; row < week.contributionDays.length; row += 1) {
      const day = week.contributionDays[row];
      const x = GRID_LEFT + WEEKDAY_LABEL_WIDTH + col * (CELL_SIZE + CELL_GAP);
      const y = GRID_TOP + row * (CELL_SIZE + CELL_GAP);
      const presentation = dayPresentation(day, theme, data.maxGreen, data.maxPurple);
      const title = `${day.date}: ${day.totalContributionCount} total, ${day.targetRepoContributionCount} target-repo`;
      const glow =
        presentation.kind === 'target'
          ? `<rect x="${x - 1}" y="${y - 1}" width="${CELL_SIZE + 2}" height="${CELL_SIZE + 2}" rx="4" fill="${presentation.fill}" opacity="0.24" filter="url(#targetGlow)" />`
          : '';

      cells.push(
        `${glow}<rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="3" ry="3" fill="${presentation.fill}" stroke="${presentation.stroke}" stroke-width="0.6"><title>${escapeXml(title)}</title></rect>`
      );
    }
  }

  const legendRight = GRID_LEFT + WEEKDAY_LABEL_WIDTH + gridWidth;
  const legendGap = 18;
  const greenLabelWidth = estimateTextWidth(anyRepoLabel);
  const purpleLabelWidth = estimateTextWidth(targetRepoLabel);
  const greenSwatchWidth = theme.greenRamp.length * 10 + (theme.greenRamp.length - 1) * 3;
  const purpleSwatchWidth = theme.purpleRamp.length * 10 + (theme.purpleRamp.length - 1) * 3;
  const legendWidth =
    greenLabelWidth +
    12 +
    greenSwatchWidth +
    legendGap +
    purpleLabelWidth +
    12 +
    purpleSwatchWidth;
  const legendX = Math.max(CARD_LEFT, legendRight - legendWidth);
  const legendY = GRID_TOP + gridHeight + 24;
  const greenSwatchX = legendX + greenLabelWidth + 12;
  const purpleLabelX = greenSwatchX + greenSwatchWidth + legendGap;
  const purpleSwatchX = purpleLabelX + purpleLabelWidth + 12;
  const headerRepo = data.meta?.targetRepo || 'owner/repo';
  const titleText = `${targetRepoLabel} Activity`;
  const subtitleText = `${data.meta?.username || 'user'} · ${headerRepo} · ${formatWindowLabel(
    data.meta?.from || '',
    data.meta?.to || ''
  )}`;
  const cards = createStatCards(stats, theme, svgWidth - CARD_LEFT * 2);

  const greenLegend = theme.greenRamp
    .map(
      (color, index) =>
        `<rect x="${greenSwatchX + index * 13}" y="${legendY - 8}" width="10" height="10" rx="3" fill="${color}" stroke="rgba(255,255,255,0.05)" />`
    )
    .join('');

  const purpleLegend = theme.purpleRamp
    .map(
      (color, index) =>
        `<rect x="${purpleSwatchX + index * 13}" y="${legendY - 8}" width="10" height="10" rx="3" fill="${color}" stroke="rgba(255,255,255,0.05)" />`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-labelledby="title desc">
  <title id="title">Workout contribution graph</title>
  <desc id="desc">GitHub-style contribution calendar. Green cells are activity in other repositories, purple cells highlight ${escapeXml(targetRepoLabel)}.</desc>
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.bgStart}" />
      <stop offset="100%" stop-color="${theme.bgEnd}" />
    </linearGradient>
    <radialGradient id="headerGlow" cx="82%" cy="10%" r="65%">
      <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.26" />
      <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0" />
    </radialGradient>
    <filter id="targetGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="1.8" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <rect width="100%" height="100%" fill="url(#bgGradient)" rx="18" />
  <rect x="1" y="1" width="${svgWidth - 2}" height="${svgHeight - 2}" fill="none" stroke="rgba(255,255,255,0.06)" rx="17" />
  <rect x="${CARD_LEFT}" y="16" width="${svgWidth - CARD_LEFT * 2}" height="${HEADER_HEIGHT}" fill="${theme.panelHighlight}" fill-opacity="0.74" stroke="${theme.panelStroke}" rx="18" />
  <rect x="${CARD_LEFT}" y="16" width="${svgWidth - CARD_LEFT * 2}" height="${HEADER_HEIGHT}" fill="url(#headerGlow)" rx="18" />

  <text x="${CARD_LEFT + 16}" y="38" font-family="${FONT_SANS}" font-size="9" font-weight="700" fill="${theme.accent}" letter-spacing="1.2">TARGET REPO OVERLAY</text>
  <text x="${CARD_LEFT + 16}" y="56" font-family="${FONT_DISPLAY}" font-size="24" font-weight="700" fill="${theme.text}">${escapeXml(titleText)}</text>
  <text x="${CARD_LEFT + 16}" y="72" font-family="${FONT_SANS}" font-size="10" fill="${theme.subtleText}">${escapeXml(subtitleText)}</text>

  ${cards}

  ${monthLabels
    .map(
      (label) =>
        `<text x="${label.x}" y="${GRID_TOP - 12}" font-family="${FONT_SANS}" font-size="9" font-weight="600" fill="${theme.subtleText}" letter-spacing="0.4">${escapeXml(label.text)}</text>`
    )
    .join('\n  ')}

  ${weekdayLabels
    .map((label) => {
      const y = GRID_TOP + label.row * (CELL_SIZE + CELL_GAP) + 8;
      return `<text x="${GRID_LEFT}" y="${y}" font-family="${FONT_SANS}" font-size="9" fill="${theme.subtleText}">${label.text}</text>`;
    })
    .join('\n  ')}

  ${cells.join('\n  ')}

  <text x="${legendX}" y="${legendY}" font-family="${FONT_SANS}" font-size="9" font-weight="600" fill="${theme.subtleText}">${escapeXml(anyRepoLabel)}</text>
  ${greenLegend}
  <text x="${purpleLabelX}" y="${legendY}" font-family="${FONT_SANS}" font-size="9" font-weight="600" fill="${theme.subtleText}">${escapeXml(targetRepoLabel)}</text>
  ${purpleLegend}
</svg>`;
}
