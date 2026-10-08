#!/usr/bin/env bash
# Smoke test for a running Tidyr API (P7.4): health, register, login, project + task CRUD,
# cross-user 404 and the login rate limit.
#
#   scripts/smoke.sh https://tidyr-api.onrender.com        # "/api" is appended if missing
#   scripts/smoke.sh http://localhost:4000/api
#
# Uses only throwaway smoke-<timestamp>-*@tidyr.test accounts, so the rate-limit check never locks
# out the demo account (the login limiter is keyed by IP + email, D-015). Each run registers two
# users, and registration is limited to RATE_LIMIT_REGISTER_MAX (default 10) per hour per IP.
# Needs bash, curl and jq. Exits non-zero on the first failed check.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <API_URL>" >&2
  exit 2
fi
for tool in curl jq; do
  command -v "$tool" >/dev/null || { echo "smoke: $tool is required" >&2; exit 2; }
done

API="${1%/}"
[[ "$API" == */api ]] || API="$API/api"

TS="$(date +%s)"
TODAY="$(date +%F)"
EMAIL_A="smoke-$TS-a@tidyr.test"
EMAIL_B="smoke-$TS-b@tidyr.test"
EMAIL_LIMIT="smoke-$TS-limit@tidyr.test"
PASSWORD="Smoke-$(openssl rand -hex 8)-1a"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

STATUS=""
STEP=""

# request METHOD PATH [TOKEN] [JSON_BODY] [HEADER] → sets STATUS; body in $WORK/body, headers in
# $WORK/headers.
request() {
  local method="$1" path="$2" token="${3:-}" body="${4:-}" header="${5:-}"
  local args=(-sS -X "$method" -o "$WORK/body" -D "$WORK/headers" -w '%{http_code}' --max-time 30)
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$header" ]] && args+=(-H "$header")
  [[ -n "$body" ]] && args+=(-H 'Content-Type: application/json' --data "$body")
  STATUS="$(curl "${args[@]}" "$API$path")" || STATUS="000"
}

fail() {
  echo "✗ $STEP: $1" >&2
  [[ -s "$WORK/body" ]] && echo "  response: $(head -c 500 "$WORK/body")" >&2
  exit 1
}

pass() { echo "✓ $STEP"; }

# jsonf FILTER → the filter applied to the last response body (raw output).
jsonf() { jq -r "$1" "$WORK/body"; }

expect_status() {
  [[ "$STATUS" == "$1" ]] || fail "expected HTTP $1, got $STATUS"
}

# expect_error STATUS CODE: HTTP status and the error envelope's code.
expect_error() {
  expect_status "$1"
  [[ "$(jsonf '.error.code')" == "$2" ]] || fail "expected error.code $2, got $(jsonf '.error.code')"
}

expect_eq() {
  [[ "$1" == "$2" ]] || fail "expected '$2', got '$1'"
}

echo "Smoke test against $API ($EMAIL_A, $EMAIL_B)"

# --- Health (Render's free tier can take ~50 s to wake, so retry for up to ~2 minutes) ---------
STEP="health"
for _ in $(seq 1 12); do
  request GET /health
  [[ "$STATUS" == "200" ]] && break
  sleep 10
done
expect_status 200
expect_eq "$(jsonf '.data.status')" "ok"
pass

# --- Auth ---------------------------------------------------------------------------------------
STEP="register user A"
request POST /auth/register "" "$(jq -nc --arg e "$EMAIL_A" --arg p "$PASSWORD" \
  '{fullName: "Smoke A", email: $e, password: $p}')"
expect_status 201
expect_eq "$(jsonf '.data.user.email')" "$EMAIL_A"
expect_eq "$(jsonf '.data.user | has("passwordHash")')" "false"
pass

STEP="register duplicate email → 409 EMAIL_TAKEN"
request POST /auth/register "" "$(jq -nc --arg e "$EMAIL_A" --arg p "$PASSWORD" \
  '{fullName: "Smoke A", email: $e, password: $p}')"
expect_error 409 EMAIL_TAKEN
pass

STEP="register user B"
request POST /auth/register "" "$(jq -nc --arg e "$EMAIL_B" --arg p "$PASSWORD" \
  '{fullName: "Smoke B", email: $e, password: $p}')"
expect_status 201
TOKEN_B="$(jsonf '.data.accessToken')"
pass

STEP="login user A"
request POST /auth/login "" "$(jq -nc --arg e "$EMAIL_A" --arg p "$PASSWORD" '{email: $e, password: $p}')"
expect_status 200
TOKEN_A="$(jsonf '.data.accessToken')"
[[ -n "$TOKEN_A" && "$TOKEN_A" != "null" ]] || fail "no access token"
[[ "$(jsonf '.data.refreshToken')" != "null" ]] || fail "no refresh token"
pass

STEP="login with a wrong password → 401 INVALID_CREDENTIALS"
request POST /auth/login "" "$(jq -nc --arg e "$EMAIL_A" '{email: $e, password: "wrong-pass-1"}')"
expect_error 401 INVALID_CREDENTIALS
pass

STEP="GET /auth/me"
request GET /auth/me "$TOKEN_A"
expect_status 200
expect_eq "$(jsonf '.data.email')" "$EMAIL_A"
pass

STEP="no token → 401 UNAUTHENTICATED"
request GET /projects
expect_error 401 UNAUTHENTICATED
pass

# --- Projects -----------------------------------------------------------------------------------
STEP="create project"
request POST /projects "$TOKEN_A" \
  '{"name":"Smoke Project","description":"Created by smoke.sh","status":"NOT_STARTED"}'
expect_status 201
PROJECT_ID="$(jsonf '.data.id')"
expect_eq "$(jsonf '.data.key')" "SP"
expect_eq "$(jsonf '.data.taskCounts.total')" "0"
pass

STEP="create project with end before start → 400 VALIDATION_ERROR"
request POST /projects "$TOKEN_A" '{"name":"Bad dates","startDate":"2026-12-01","endDate":"2026-11-01"}'
expect_error 400 VALIDATION_ERROR
pass

STEP="get project"
request GET "/projects/$PROJECT_ID" "$TOKEN_A"
expect_status 200
expect_eq "$(jsonf '.data.name')" "Smoke Project"
pass

STEP="list projects with search"
request GET "/projects?search=smoke&status=NOT_STARTED" "$TOKEN_A"
expect_status 200
expect_eq "$(jsonf '.meta.total')" "1"
expect_eq "$(jsonf '.data[0].id')" "$PROJECT_ID"
pass

STEP="update project"
request PUT "/projects/$PROJECT_ID" "$TOKEN_A" '{"status":"IN_PROGRESS","startDate":"2026-10-01"}'
expect_status 200
expect_eq "$(jsonf '.data.status')" "IN_PROGRESS"
expect_eq "$(jsonf '.data.startDate')" "2026-10-01"
pass

# --- Tasks --------------------------------------------------------------------------------------
STEP="create task"
request POST /tasks "$TOKEN_A" "$(jq -nc --arg p "$PROJECT_ID" \
  '{projectId: $p, name: "Smoke task", priority: "HIGH", dueDate: "2026-12-31"}')"
expect_status 201
TASK_ID="$(jsonf '.data.id')"
expect_eq "$(jsonf '.data.key')" "SP-1"
expect_eq "$(jsonf '.data.status')" "PENDING"
pass

STEP="get task"
request GET "/tasks/$TASK_ID" "$TOKEN_A"
expect_status 200
expect_eq "$(jsonf '.data.project.id')" "$PROJECT_ID"
pass

STEP="list tasks by project, key search and filters"
request GET "/tasks?projectId=$PROJECT_ID&search=sp-1&priority=HIGH&today=$TODAY" "$TOKEN_A"
expect_status 200
expect_eq "$(jsonf '.meta.total')" "1"
expect_eq "$(jsonf '.data[0].id')" "$TASK_ID"
pass

STEP="mark task completed"
request PUT "/tasks/$TASK_ID" "$TOKEN_A" '{"status":"COMPLETED"}'
expect_status 200
expect_eq "$(jsonf '.data.status')" "COMPLETED"
[[ "$(jsonf '.data.completedAt')" != "null" ]] || fail "completedAt not set"
pass

STEP="project task counts"
request GET "/projects/$PROJECT_ID" "$TOKEN_A"
expect_status 200
expect_eq "$(jsonf '.data.taskCounts | "\(.total)/\(.completed)"')" "1/1"
pass

STEP="dashboard"
request GET "/dashboard?today=$TODAY" "$TOKEN_A"
expect_status 200
expect_eq "$(jsonf '"\(.data.totalProjects)/\(.data.totalTasks)/\(.data.completedTasks)"')" "1/1/1"
pass

# --- Cross-user isolation: B can't see or touch A's data ----------------------------------------
STEP="B gets A's project → 404"
request GET "/projects/$PROJECT_ID" "$TOKEN_B"
expect_error 404 NOT_FOUND
pass

STEP="B updates A's project → 404"
request PUT "/projects/$PROJECT_ID" "$TOKEN_B" '{"name":"Hijacked"}'
expect_error 404 NOT_FOUND
pass

STEP="B deletes A's project → 404"
request DELETE "/projects/$PROJECT_ID" "$TOKEN_B"
expect_error 404 NOT_FOUND
pass

STEP="B gets A's task → 404"
request GET "/tasks/$TASK_ID" "$TOKEN_B"
expect_error 404 NOT_FOUND
pass

STEP="B updates A's task → 404"
request PUT "/tasks/$TASK_ID" "$TOKEN_B" '{"name":"Hijacked"}'
expect_error 404 NOT_FOUND
pass

STEP="B deletes A's task → 404"
request DELETE "/tasks/$TASK_ID" "$TOKEN_B"
expect_error 404 NOT_FOUND
pass

STEP="B creates a task in A's project → 404"
request POST /tasks "$TOKEN_B" "$(jq -nc --arg p "$PROJECT_ID" '{projectId: $p, name: "Intruder"}')"
expect_error 404 NOT_FOUND
pass

STEP="B's lists don't include A's data"
request GET /projects "$TOKEN_B"
expect_status 200
expect_eq "$(jsonf '.meta.total')" "0"
request GET "/tasks?projectId=$PROJECT_ID" "$TOKEN_B"
expect_status 200
expect_eq "$(jsonf '.meta.total')" "0"
pass

STEP="A's data is unchanged"
request GET "/projects/$PROJECT_ID" "$TOKEN_A"
expect_status 200
expect_eq "$(jsonf '.data.name')" "Smoke Project"
expect_eq "$(jsonf '.data.taskCounts.total')" "1"
request GET "/tasks/$TASK_ID" "$TOKEN_A"
expect_status 200
expect_eq "$(jsonf '.data.name')" "Smoke task"
pass

# --- Deletes ------------------------------------------------------------------------------------
STEP="delete task"
request DELETE "/tasks/$TASK_ID" "$TOKEN_A"
expect_status 204
request GET "/tasks/$TASK_ID" "$TOKEN_A"
expect_error 404 NOT_FOUND
pass

STEP="delete project"
request DELETE "/projects/$PROJECT_ID" "$TOKEN_A"
expect_status 204
request GET "/projects/$PROJECT_ID" "$TOKEN_A"
expect_error 404 NOT_FOUND
pass

# --- Login rate limit (throwaway email) ---------------------------------------------------------
# Exactly RATE_LIMIT_AUTH_MAX failures (read from the RateLimit header), then 429. Every attempt
# claims a different client in X-Forwarded-For: if the API trusted that, or keyed on a rotating
# proxy address instead of the client, the 429 would come late or never (D-035).
STEP="login rate limit → 429 RATE_LIMITED after exactly RATE_LIMIT_AUTH_MAX failures"
LIMIT_BODY="$(jq -nc --arg e "$EMAIL_LIMIT" '{email: $e, password: "wrong-pass-1"}')"
spoof() { echo "X-Forwarded-For: 198.51.100.$1"; }
request POST /auth/login "" "$LIMIT_BODY" "$(spoof 1)"
expect_error 401 INVALID_CREDENTIALS
LIMIT="$(grep -i '^ratelimit:' "$WORK/headers" | sed -E 's/.*limit=([0-9]+).*/\1/' | tr -d '\r')"
[[ "$LIMIT" =~ ^[0-9]+$ ]] || fail "no RateLimit header"
for ((attempt = 2; attempt <= LIMIT; attempt++)); do
  request POST /auth/login "" "$LIMIT_BODY" "$(spoof "$attempt")"
  expect_error 401 INVALID_CREDENTIALS
done
request POST /auth/login "" "$LIMIT_BODY" "$(spoof $((LIMIT + 1)))"
expect_error 429 RATE_LIMITED
grep -qi '^retry-after:' "$WORK/headers" || fail "no Retry-After header"
STEP="$STEP ($LIMIT)"
pass

STEP="another account still logs in from the same IP"
request POST /auth/login "" "$(jq -nc --arg e "$EMAIL_A" --arg p "$PASSWORD" '{email: $e, password: $p}')"
expect_status 200
pass

# --- Logout -------------------------------------------------------------------------------------
STEP="logout revokes the session"
request POST /auth/logout "$TOKEN_B"
expect_status 204
request GET /auth/me "$TOKEN_B"
expect_error 401 SESSION_REVOKED
pass

echo "All smoke checks passed."
