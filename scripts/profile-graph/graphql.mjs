const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const GITHUB_REST_URL = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const USER_AGENT = 'profile-purple-graph-generator';

function assertEnv(value, name) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

export function parseTargetRepo(targetRepo) {
  const [owner, name] = (targetRepo || '').split('/');
  if (!owner || !name) {
    throw new Error('TARGET_REPO must be in format "owner/name"');
  }
  return { owner, name };
}

function isoDate(input) {
  return input.toISOString().slice(0, 10);
}

function startOfUtcDay(input) {
  const date = new Date(input);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function endOfUtcDay(input) {
  const date = new Date(input);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

function startDateFromWindow(daysBack = 364, now = new Date()) {
  const date = startOfUtcDay(now);
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date;
}

function endDateFromNow(now = new Date()) {
  return endOfUtcDay(now);
}

function buildHeaders(token, extraHeaders = {}) {
  return {
    Authorization: `bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    ...extraHeaders,
  };
}

async function requestGraphQL({ token, query, variables, fetchImpl = fetch }) {
  const response = await fetchImpl(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub GraphQL request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    const message = payload.errors.map((item) => item.message).join(' | ');
    throw new Error(`GitHub GraphQL error: ${message}`);
  }

  return payload.data;
}

async function requestRestJson({ token, url, fetchImpl = fetch }) {
  const response = await fetchImpl(url, {
    headers: buildHeaders(token, {
      Accept: 'application/vnd.github+json',
    }),
  });

  return response;
}

const CALENDAR_QUERY = `
query CalendarOnly(
  $username: String!
  $from: DateTime!
  $to: DateTime!
) {
  user(login: $username) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        months {
          name
          year
          firstDay
          totalWeeks
        }
        weeks {
          contributionDays {
            contributionCount
            contributionLevel
            date
            weekday
          }
          firstDay
        }
      }
    }
  }
}
`;

function extractCommitDate(commit) {
  return (
    commit?.commit?.author?.date ||
    commit?.commit?.committer?.date ||
    commit?.author?.date ||
    null
  );
}

export function buildTargetContributionMap(commits, fromDateKey, toDateKey) {
  const map = new Map();

  for (const commit of commits || []) {
    const occurredAt = extractCommitDate(commit);
    if (!occurredAt) {
      continue;
    }

    const day = occurredAt.slice(0, 10);
    if (day < fromDateKey || day > toDateKey) {
      continue;
    }

    map.set(day, (map.get(day) ?? 0) + 1);
  }

  return map;
}

function flattenDays(weeks) {
  return weeks.flatMap((week) => week.contributionDays);
}

export function computeTargetStats(weeks, toDateKey) {
  const days = flattenDays(weeks).slice().sort((left, right) => left.date.localeCompare(right.date));
  const totalTargetDays = days.filter((day) => day.targetRepoContributionCount > 0).length;

  const last30Start = new Date(`${toDateKey}T00:00:00.000Z`);
  last30Start.setUTCDate(last30Start.getUTCDate() - 29);
  const last30StartKey = isoDate(last30Start);

  const last30TargetDays = days.filter(
    (day) => day.date >= last30StartKey && day.date <= toDateKey && day.targetRepoContributionCount > 0
  ).length;

  const byDate = new Map(days.map((day) => [day.date, day]));
  let currentStreak = 0;
  const streakCursor = new Date(`${toDateKey}T00:00:00.000Z`);

  while (streakCursor >= new Date(`${days[0]?.date || toDateKey}T00:00:00.000Z`)) {
    const cursorKey = isoDate(streakCursor);
    const currentDay = byDate.get(cursorKey);
    if (!currentDay || currentDay.targetRepoContributionCount <= 0) {
      break;
    }
    currentStreak += 1;
    streakCursor.setUTCDate(streakCursor.getUTCDate() - 1);
  }

  const lastTargetActivityDate =
    days.reduce((latest, day) => {
      if (day.targetRepoContributionCount <= 0) {
        return latest;
      }
      return !latest || day.date > latest ? day.date : latest;
    }, null) || null;

  return {
    totalTargetDays,
    last30TargetDays,
    currentStreak,
    lastTargetActivityDate,
  };
}

function normalizeCalendar({ contributionCalendar, targetMap, toDateKey }) {
  const weeks = contributionCalendar.weeks.map((week) => ({
    firstDay: week.firstDay,
    contributionDays: week.contributionDays.map((day) => {
      const targetRepoContributionCount = targetMap.get(day.date) ?? 0;
      return {
        date: day.date,
        weekday: day.weekday,
        totalContributionCount: day.contributionCount,
        targetRepoContributionCount,
        contributionLevel: day.contributionLevel,
      };
    }),
  }));

  const dailyIndex = {};
  let maxGreen = 0;
  let maxPurple = 0;

  for (const week of weeks) {
    for (const day of week.contributionDays) {
      dailyIndex[day.date] = {
        totalContributionCount: day.totalContributionCount,
        targetRepoContributionCount: day.targetRepoContributionCount,
      };

      if (day.targetRepoContributionCount > 0) {
        maxPurple = Math.max(maxPurple, day.targetRepoContributionCount);
      } else {
        maxGreen = Math.max(maxGreen, day.totalContributionCount);
      }
    }
  }

  return {
    totalContributions: contributionCalendar.totalContributions,
    months: contributionCalendar.months,
    weeks,
    dailyIndex,
    maxGreen,
    maxPurple,
    stats: computeTargetStats(weeks, toDateKey),
  };
}

async function fetchTargetRepoCommits({
  owner,
  name,
  username,
  token,
  fromDate,
  toDate,
  fetchImpl = fetch,
}) {
  const commits = [];
  let page = 1;

  while (true) {
    const url = new URL(`${GITHUB_REST_URL}/repos/${owner}/${name}/commits`);
    url.searchParams.set('author', username);
    url.searchParams.set('since', fromDate.toISOString());
    url.searchParams.set('until', toDate.toISOString());
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));

    const response = await requestRestJson({
      token,
      url: url.toString(),
      fetchImpl,
    });

    if (response.status === 409) {
      return {
        commits,
        isTargetRepoAccessible: true,
      };
    }

    if (response.status === 404) {
      throw new Error(`Target repo ${owner}/${name} was not found or is not accessible.`);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub commits request failed (${response.status}): ${body}`);
    }

    const pageCommits = await response.json();
    if (!Array.isArray(pageCommits)) {
      throw new Error('GitHub commits request returned an unexpected payload.');
    }

    commits.push(...pageCommits);
    if (pageCommits.length < 100) {
      break;
    }

    page += 1;
  }

  return {
    commits,
    isTargetRepoAccessible: true,
  };
}

export async function fetchContributionData({
  username,
  targetRepo,
  token,
  fetchImpl = fetch,
  now = new Date(),
}) {
  assertEnv(username, 'GITHUB_USERNAME');
  assertEnv(targetRepo, 'TARGET_REPO');
  assertEnv(token, 'GITHUB_TOKEN or GH_PAT');

  const { owner, name } = parseTargetRepo(targetRepo);

  const fromDate = startDateFromWindow(364, now);
  const toDate = endDateFromNow(now);
  const fromDateKey = isoDate(fromDate);
  const toDateKey = isoDate(toDate);

  const [calendarData, targetRepoData] = await Promise.all([
    requestGraphQL({
      token,
      query: CALENDAR_QUERY,
      variables: {
        username,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      fetchImpl,
    }),
    fetchTargetRepoCommits({
      owner,
      name,
      username,
      token,
      fromDate,
      toDate,
      fetchImpl,
    }),
  ]);

  const collection = calendarData?.user?.contributionsCollection;
  if (!collection?.contributionCalendar) {
    throw new Error('Missing contribution calendar in API response.');
  }

  if (!targetRepoData.isTargetRepoAccessible) {
    throw new Error(`Target repo ${targetRepo} could not be queried.`);
  }

  const targetMap = buildTargetContributionMap(targetRepoData.commits, fromDateKey, toDateKey);
  const normalized = normalizeCalendar({
    contributionCalendar: collection.contributionCalendar,
    targetMap,
    toDateKey,
  });

  normalized.meta = {
    username,
    targetRepo,
    from: fromDateKey,
    to: toDateKey,
    generatedAt: new Date().toISOString(),
    isTargetRepoAccessible: targetRepoData.isTargetRepoAccessible,
    targetCommitCount: targetRepoData.commits.length,
    lastTargetActivityDate: normalized.stats.lastTargetActivityDate,
  };

  return normalized;
}
