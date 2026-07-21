#!/usr/bin/env bash
# Create GitHub issues from issues.jsonl (produced by backlog-to-issues.mjs).
# Idempotent: skips any title that already exists. Safe to re-run after a failure.
#
#   node scripts/backlog-to-issues.mjs --out /tmp/issues.jsonl
#   scripts/post-backlog-issues.sh /tmp/issues.jsonl
set -euo pipefail

JSONL="${1:?usage: post-backlog-issues.sh <issues.jsonl>}"
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
WORKDIR="$(mktemp -d)"
FAILED="$WORKDIR/failed.jsonl"

echo "repo: $REPO"

# --- milestones ---------------------------------------------------------
existing_ms="$(gh api "repos/$REPO/milestones?state=all&per_page=100" --jq '.[].title')"
while IFS= read -r title; do
  if grep -Fxq "$title" <<<"$existing_ms"; then
    echo "milestone exists: $title"
  else
    gh api -X POST "repos/$REPO/milestones" -f title="$title" --jq '.title' >/dev/null
    echo "milestone created: $title"
  fi
done < <(jq -r 'select(.milestone != null) | .milestone' "$JSONL" | sort -u)

# --- labels -------------------------------------------------------------
gh label create partial -c FBCA04 -d "Scaffolding exists but incomplete" 2>/dev/null \
  && echo "label created: partial" || echo "label exists: partial"

# --- issues -------------------------------------------------------------
gh issue list --state all --limit 500 --json title -q '.[].title' > "$WORKDIR/have.txt"

created=0; skipped=0; closed=0; failed=0
while IFS= read -r row; do
  title="$(jq -r .title <<<"$row")"
  if grep -Fxq "$title" "$WORKDIR/have.txt"; then
    skipped=$((skipped + 1)); continue
  fi

  jq -r .body <<<"$row" > "$WORKDIR/body.md"
  labels="$(jq -r '.labels | join(",")' <<<"$row")"
  milestone="$(jq -r '.milestone // empty' <<<"$row")"

  args=(--title "$title" --body-file "$WORKDIR/body.md" --label "$labels")
  [ -n "$milestone" ] && args+=(--milestone "$milestone")

  if ! url="$(gh issue create "${args[@]}" 2>&1)"; then
    echo "FAILED: $title -- $url" >&2
    printf '%s\n' "$row" >> "$FAILED"
    failed=$((failed + 1))
    sleep 2
    continue
  fi
  num="${url##*/}"
  created=$((created + 1))
  echo "#$num $title"

  if [ "$(jq -r .state <<<"$row")" = "closed" ]; then
    gh issue close "$num" --reason completed >/dev/null && closed=$((closed + 1))
  fi
  sleep 2   # ponytail: flat throttle; GitHub secondary rate limits bite on bulk creates
done < "$JSONL"

echo "created $created, closed $closed, skipped $skipped, failed $failed"
[ "$failed" -gt 0 ] && echo "retry rows: $FAILED"
exit 0
