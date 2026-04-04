import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchContributionData } from '../scripts/profile-graph/graphql.mjs';
import { buildMonthLabels, renderContributionSvg } from '../scripts/profile-graph/renderSvg.mjs';

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function buildWeek(firstDay, countsByDate = {}) {
  const start = new Date(`${firstDay}T00:00:00.000Z`);
  const contributionDays = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const current = new Date(start);
    current.setUTCDate(current.getUTCDate() + offset);
    const date = current.toISOString().slice(0, 10);
    contributionDays.push({
      contributionCount: countsByDate[date] ?? 0,
      contributionLevel: 'NONE',
      date,
      weekday: current.getUTCDay(),
    });
  }

  return {
    firstDay,
    contributionDays,
  };
}

function createContributionCalendar(countsByDate = {}) {
  return {
    totalContributions: Object.values(countsByDate).reduce((sum, count) => sum + count, 0),
    months: [
      { name: 'Feb', year: 2026, firstDay: '2026-02-01', totalWeeks: 4 },
      { name: 'Mar', year: 2026, firstDay: '2026-03-01', totalWeeks: 5 },
      { name: 'Apr', year: 2026, firstDay: '2026-04-01', totalWeeks: 4 },
    ],
    weeks: [
      buildWeek('2026-02-22', countsByDate),
      buildWeek('2026-03-01', countsByDate),
      buildWeek('2026-03-29', countsByDate),
    ],
  };
}

function createCommit(date, id) {
  return {
    sha: `sha-${id}`,
    commit: {
      author: {
        date,
      },
    },
  };
}

test('fetchContributionData paginates target repo commits and computes stats', async () => {
  const fetchCalls = [];
  const calendar = createContributionCalendar({
    '2026-02-27': 2,
    '2026-02-28': 1,
    '2026-03-01': 3,
    '2026-03-03': 2,
  });

  const pageOne = [
    ...Array.from({ length: 40 }, (_, index) => createCommit('2026-02-27T09:00:00.000Z', `p1-a-${index}`)),
    ...Array.from({ length: 30 }, (_, index) => createCommit('2026-02-28T09:00:00.000Z', `p1-b-${index}`)),
    ...Array.from({ length: 30 }, (_, index) => createCommit('2026-03-01T09:00:00.000Z', `p1-c-${index}`)),
  ];
  const pageTwo = [
    createCommit('2026-03-01T18:00:00.000Z', 'p2-a'),
    createCommit('2026-02-27T18:00:00.000Z', 'p2-b'),
  ];

  const mockFetch = async (url, options = {}) => {
    fetchCalls.push(String(url));

    if (String(url).includes('/graphql')) {
      return createJsonResponse({
        data: {
          user: {
            contributionsCollection: {
              contributionCalendar: calendar,
            },
          },
        },
      });
    }

    const requestUrl = new URL(String(url));
    const page = requestUrl.searchParams.get('page');
    assert.equal(requestUrl.searchParams.get('author'), 'StefanNa');

    if (page === '1') {
      return createJsonResponse(pageOne);
    }

    if (page === '2') {
      return createJsonResponse(pageTwo);
    }

    throw new Error(`Unexpected page request: ${page}`);
  };

  const data = await fetchContributionData({
    username: 'StefanNa',
    targetRepo: 'StefanNa/MySportacus',
    token: 'test-token',
    fetchImpl: mockFetch,
    now: new Date('2026-03-01T12:00:00.000Z'),
  });

  assert.equal(fetchCalls.length, 3);
  assert.equal(data.meta.targetCommitCount, 102);
  assert.equal(data.dailyIndex['2026-02-27'].targetRepoContributionCount, 41);
  assert.equal(data.dailyIndex['2026-02-28'].targetRepoContributionCount, 30);
  assert.equal(data.dailyIndex['2026-03-01'].targetRepoContributionCount, 31);
  assert.equal(data.stats.totalTargetDays, 3);
  assert.equal(data.stats.last30TargetDays, 3);
  assert.equal(data.stats.currentStreak, 1);
  assert.equal(data.stats.lastTargetActivityDate, '2026-03-01');
});

test('fetchContributionData keeps zero-activity windows accessible', async () => {
  const calendar = createContributionCalendar({
    '2026-02-27': 1,
    '2026-03-03': 2,
  });

  const mockFetch = async (url) => {
    if (String(url).includes('/graphql')) {
      return createJsonResponse({
        data: {
          user: {
            contributionsCollection: {
              contributionCalendar: calendar,
            },
          },
        },
      });
    }

    return createJsonResponse([]);
  };

  const data = await fetchContributionData({
    username: 'StefanNa',
    targetRepo: 'StefanNa/MySportacus',
    token: 'test-token',
    fetchImpl: mockFetch,
    now: new Date('2026-03-01T12:00:00.000Z'),
  });

  assert.equal(data.meta.isTargetRepoAccessible, true);
  assert.equal(data.meta.targetCommitCount, 0);
  assert.equal(data.stats.totalTargetDays, 0);
  assert.equal(data.stats.last30TargetDays, 0);
  assert.equal(data.stats.currentStreak, 0);
  assert.equal(data.stats.lastTargetActivityDate, null);
});

test('buildMonthLabels keeps visible month labels spaced apart', () => {
  const weeks = [
    buildWeek('2026-01-25'),
    buildWeek('2026-02-01'),
    buildWeek('2026-02-08'),
    buildWeek('2026-03-01'),
  ];

  const labels = buildMonthLabels(
    [
      { name: 'Jan', firstDay: '2026-01-01' },
      { name: 'Feb', firstDay: '2026-02-01' },
      { name: 'Mar', firstDay: '2026-03-01' },
    ],
    weeks
  );

  assert.equal(labels[0].text, 'Jan');
  assert.equal(labels.at(-1).text, 'Mar');
  for (let index = 1; index < labels.length; index += 1) {
    assert.ok(labels[index].x - labels[index - 1].x >= 19);
  }
});

test('current streak skips an incomplete week until it reaches two target days', async () => {
  const calendar = createContributionCalendar({
    '2026-02-22': 1,
    '2026-02-24': 1,
    '2026-03-01': 1,
  });

  const commits = [
    createCommit('2026-02-22T09:00:00.000Z', 'week-a'),
    createCommit('2026-02-24T09:00:00.000Z', 'week-b'),
    createCommit('2026-03-01T09:00:00.000Z', 'current-week-a'),
  ];

  const mockFetch = async (url) => {
    if (String(url).includes('/graphql')) {
      return createJsonResponse({
        data: {
          user: {
            contributionsCollection: {
              contributionCalendar: calendar,
            },
          },
        },
      });
    }

    return createJsonResponse(commits);
  };

  const data = await fetchContributionData({
    username: 'StefanNa',
    targetRepo: 'StefanNa/MySportacus',
    token: 'test-token',
    fetchImpl: mockFetch,
    now: new Date('2026-03-03T12:00:00.000Z'),
  });

  assert.equal(data.stats.currentStreak, 1);
});

test('renderContributionSvg includes dashboard stats, legend labels, and target styling', () => {
  const svg = renderContributionSvg(
    {
      months: [
        { name: 'Feb', firstDay: '2026-02-01' },
        { name: 'Mar', firstDay: '2026-03-01' },
      ],
      weeks: [
        {
          firstDay: '2026-02-22',
          contributionDays: [
            {
              date: '2026-02-22',
              weekday: 0,
              totalContributionCount: 1,
              targetRepoContributionCount: 0,
              contributionLevel: 'FIRST_QUARTILE',
            },
            {
              date: '2026-02-23',
              weekday: 1,
              totalContributionCount: 2,
              targetRepoContributionCount: 2,
              contributionLevel: 'SECOND_QUARTILE',
            },
          ],
        },
      ],
      maxGreen: 1,
      maxPurple: 2,
      stats: {
        totalTargetDays: 12,
        last30TargetDays: 4,
        currentStreak: 2,
      },
      meta: {
        username: 'StefanNa',
        targetRepo: 'StefanNa/MySportacus',
        from: '2025-03-03',
        to: '2026-03-01',
      },
    },
    {
      targetRepoLabel: 'Sportacus',
      anyRepoLabel: 'Other repos',
    }
  );

  assert.match(svg, /TARGET REPO OVERLAY/);
  assert.match(svg, /TARGET DAYS/);
  assert.match(svg, /LAST 30 DAYS/);
  assert.match(svg, /2X\/WEEK STREAK/);
  assert.match(svg, /Sportacus Activity/);
  assert.match(svg, /Other repos/);
  assert.match(svg, /filter="url\(#targetGlow\)"/);
  assert.match(svg, /Sportacus/);
  assert.match(svg, />2w</);
});
