#!/usr/bin/env bash
set -euo pipefail

PROFILE_REPO=""
TARGET_REPO=""
TARGET_REPO_LABEL=""
PROFILE_USERNAME=""
PROFILE_TZ="Europe/Berlin"

usage() {
  cat <<'USAGE'
Usage:
  scripts/setup/bootstrap.sh \
    --profile-repo owner/profileRepo \
    --target-repo owner/targetRepo \
    [--target-repo-label label] \
    [--profile-username username] \
    [--tz IANA_TIMEZONE]

Example:
  scripts/setup/bootstrap.sh \
    --profile-repo StefanNa/StefanNa \
    --target-repo StefanNa/MySportacus \
    --target-repo-label Sportacus \
    --profile-username StefanNa \
    --tz Europe/Berlin
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile-repo)
      PROFILE_REPO="${2:-}"
      shift 2
      ;;
    --target-repo)
      TARGET_REPO="${2:-}"
      shift 2
      ;;
    --target-repo-label)
      TARGET_REPO_LABEL="${2:-}"
      shift 2
      ;;
    --profile-username)
      PROFILE_USERNAME="${2:-}"
      shift 2
      ;;
    --tz)
      PROFILE_TZ="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [ -z "${PROFILE_REPO}" ] || [ -z "${TARGET_REPO}" ]; then
  echo "--profile-repo and --target-repo are required." >&2
  usage
  exit 1
fi

if [ -z "${PROFILE_USERNAME}" ]; then
  PROFILE_USERNAME="${PROFILE_REPO%%/*}"
fi

if [ -z "${TARGET_REPO_LABEL}" ]; then
  TARGET_REPO_LABEL="${TARGET_REPO##*/}"
fi

echo "Configuring ${PROFILE_REPO} ..."
gh variable set PROFILE_USERNAME -R "${PROFILE_REPO}" -b "${PROFILE_USERNAME}"
gh variable set TARGET_REPO -R "${PROFILE_REPO}" -b "${TARGET_REPO}"
gh variable set TARGET_REPO_LABEL -R "${PROFILE_REPO}" -b "${TARGET_REPO_LABEL}"
gh variable set PROFILE_TZ -R "${PROFILE_REPO}" -b "${PROFILE_TZ}"

echo
echo "Configured variables:"
echo "  PROFILE_USERNAME=${PROFILE_USERNAME}"
echo "  TARGET_REPO=${TARGET_REPO}"
echo "  TARGET_REPO_LABEL=${TARGET_REPO_LABEL}"
echo "  PROFILE_TZ=${PROFILE_TZ}"

echo
echo "Next steps:"
echo "1) Ensure ${PROFILE_REPO} has .github/workflows/update-profile-graph.yml from this plugin."
echo "2) Ensure ${PROFILE_REPO} contains README image link to ./assets/github-contribution-purple.svg."
echo "3) In ${TARGET_REPO}, create secret PROFILE_REPO_DISPATCH_TOKEN (fine-grained token with Actions write for ${PROFILE_REPO})."
echo "4) Add target-repo dispatch workflow (see plugin README)."
