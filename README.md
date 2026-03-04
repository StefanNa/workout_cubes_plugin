# workout_cubes_plugin

Reusable GitHub profile graph plugin.

It generates a GitHub-style contribution SVG where commits from one chosen target repo are shown in neon purple.

## How it works

- `TARGET_REPO` is the repo you want to highlight (for example `StefanNa/MySportacus`).
- The SVG is generated in your profile repo (`<username>/<username>`) as `assets/github-contribution-purple.svg`.
- Your profile `README.md` embeds that SVG.

## Quickstart (3 commands)

```bash
# 1) In your profile repo, add this plugin as a submodule
cd /path/to/<username>
git submodule add https://github.com/StefanNa/workout_cubes_plugin.git tools/workout_cubes_plugin

# 2) Copy the workflow from plugin into your profile repo
cp tools/workout_cubes_plugin/.github/workflows/update-profile-graph.yml .github/workflows/update-profile-graph.yml

# 3) Configure profile variables in one step
./tools/workout_cubes_plugin/scripts/setup/bootstrap.sh \
  --profile-repo <username>/<username> \
  --target-repo <owner>/<repo> \
  --tz Europe/Berlin
```

## Profile README block

```md
## Workout Contribution Graph
![Workout contribution graph](./assets/github-contribution-purple.svg)

Green = non-target repo activity  
Neon purple = commits to <owner>/<repo>
```

## Required profile repo variables

- `PROFILE_USERNAME`
- `TARGET_REPO`
- `PROFILE_TZ` (IANA timezone, used for local 08:00 + 20:00 schedule)

## Optional profile repo secret

- `GH_PAT` (fallback; default `GITHUB_TOKEN` is preferred)

## Optional push-trigger from TARGET_REPO

Add this workflow to your target repo as `.github/workflows/dispatch-profile-graph.yml`:

```yaml
name: Dispatch Profile Workout Graph Update

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Skip if token is missing
        if: ${{ secrets.PROFILE_REPO_DISPATCH_TOKEN == '' }}
        run: |
          echo "PROFILE_REPO_DISPATCH_TOKEN is not set."

      - name: Dispatch profile workflow
        if: ${{ secrets.PROFILE_REPO_DISPATCH_TOKEN != '' }}
        env:
          DISPATCH_TOKEN: ${{ secrets.PROFILE_REPO_DISPATCH_TOKEN }}
        run: |
          curl -fsSL -X POST \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer ${DISPATCH_TOKEN}" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            https://api.github.com/repos/<username>/<username>/dispatches \
            -d '{"event_type":"workout-graph-update","client_payload":{"target_repo":"<owner>/<repo>"}}'
```

## Local test

```bash
export GITHUB_USERNAME="<username>"
export TARGET_REPO="<owner>/<repo>"
export GH_PAT="<token>" # optional
node scripts/profile-graph/generate.mjs
```
