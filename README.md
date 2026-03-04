# Purple Contribution Graph (SNK-Inspired, No Snake)

This setup creates a custom contribution graph image for your GitHub profile README:
- normal contribution days = green
- days with commits to one target repo = neon purple
- GitHub-style day-square layout
- no snake animation

It works on a free GitHub account.

## What this changes

This does not modify GitHub's built-in contribution chart.
It generates `assets/github-contribution-purple.svg` and displays that image in your profile README.

## Bulletproof Setup (StefanNa example)

Use these exact values:
- profile repo: `StefanNa/StefanNa`
- profile username: `StefanNa`
- target repo: `StefanNa/MySportacus`

### 1. Confirm profile repo exists and is public

Repo must be exactly `<username>/<username>`:
- `StefanNa/StefanNa`

`README.md` must be on the default branch (`main`).

### 2. Copy scaffold files into profile repo

From local machine:

```bash
cp -R \
  /home/stefan/projects/cubes_plugin/.github \
  /home/stefan/projects/cubes_plugin/scripts \
  /home/stefan/projects/cubes_plugin/package.json \
  /home/stefan/projects/cubes_plugin/.gitignore \
  /home/stefan/projects/StefanNa/

mkdir -p /home/stefan/projects/StefanNa/assets
```

### 3. Put the graph block into profile README

Edit `/home/stefan/projects/StefanNa/README.md` and include:

```md
## Workout Contribution Graph
![Workout contribution graph](./assets/github-contribution-purple.svg)

Green = non-target repo activity  
Neon purple = commits to StefanNa/MySportacus
```

### 4. Add repository variables (Actions -> Variables)

In `StefanNa/StefanNa`:
- `PROFILE_USERNAME = StefanNa`
- `TARGET_REPO = StefanNa/MySportacus`

Important: do not create variables starting with `GITHUB_` (GitHub blocks that).

### 5. Optional secret

Only if needed:
- `GH_PAT` (Personal Access Token)

Most cases work with default `GITHUB_TOKEN` only.

### 6. Commit and push profile repo

```bash
cd /home/stefan/projects/StefanNa
git add .
git commit -m "Add purple contribution graph automation"
git push
```

### 7. Run workflow once manually

On GitHub:
- open `StefanNa/StefanNa`
- go to `Actions`
- run `Update Purple Contribution Graph` via `Run workflow`

First successful run should generate/refresh:
- `assets/github-contribution-purple.svg`

## What your log means

If the job says:
- `Wrote .../assets/github-contribution-purple.svg`
- then `No SVG changes to commit`

That means the generated file content matched what was already in git on that run.
This is normal and not an error.

## Why graph may still not show on profile page

Check these in order:
1. Repo is exactly `StefanNa/StefanNa`.
2. Repo is public.
3. `README.md` exists on default branch.
4. `README.md` contains `![...](./assets/github-contribution-purple.svg)`.
5. `assets/github-contribution-purple.svg` exists in the same repo/branch.
6. Browser cache is refreshed (hard refresh).

## Trigger behavior

- Daily auto-run: `02:17 UTC`
- Manual run: anytime from Actions tab

## Local test command

```bash
cd /home/stefan/projects/StefanNa
export GITHUB_USERNAME="StefanNa"
export TARGET_REPO="StefanNa/MySportacus"
export GH_PAT="your_token" # optional if GITHUB_TOKEN unavailable
npm run generate
```

## Files in this scaffold

- `scripts/profile-graph/generate.mjs`: entrypoint
- `scripts/profile-graph/graphql.mjs`: GitHub GraphQL fetch/normalize
- `scripts/profile-graph/renderSvg.mjs`: SVG rendering
- `.github/workflows/update-profile-graph.yml`: automation workflow
- `assets/github-contribution-purple.svg`: generated output
