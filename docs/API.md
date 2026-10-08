# Tidyr API

The REST API behind the Tidyr web app and Android app: one Express + PostgreSQL backend for both clients.

|                       |                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Base URL (local)      | `http://localhost:4000/api`                                                               |
| Base URL (production) | _added after deployment (Phase 7)_                                                        |
| Interactive docs      | `GET /api/docs` (Swagger UI)                                                              |
| OpenAPI 3.1 document  | `GET /api/docs/openapi.json` (generated from the same Zod schemas the API validates with) |

Request schemas live in `packages/shared/src/schemas` and response types in `packages/shared/src/types.ts`, so the API, the web app and the mobile app share one contract. References like (D-007) are design decisions; the README's design-decisions section summarizes them.

---

## 1. Conventions

| Topic              | Rule                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Base URL           | `{API_ORIGIN}/api`, e.g. `http://localhost:4000/api`                                                             |
| Format             | JSON. Requests with a body send `Content-Type: application/json`. Max body 100 kb.                               |
| Auth               | `Authorization: Bearer <accessToken>` on every endpoint marked 🔒                                                |
| IDs                | UUID v4 strings                                                                                                  |
| Field case         | `camelCase`                                                                                                      |
| Date-only fields   | `"YYYY-MM-DD"` strings (`startDate`, `endDate`, `dueDate`, `today`)                                              |
| Timestamps         | ISO-8601 UTC strings (`createdAt`, `updatedAt`, `completedAt`)                                                   |
| Nullable fields    | Returned as `null`, never omitted. Send `null` to clear a value.                                                 |
| Request tracing    | Response header `X-Request-Id`. Clients may send their own (UUID).                                               |
| Rate-limit headers | `RateLimit-*` (draft-7) on limited routes. `Retry-After` on 429.                                                 |
| Update semantics   | `PUT` accepts a **partial** body (only the changed fields, at least one). Fields not sent are unchanged. (D-007) |

### 1.1 Envelopes

```jsonc
// Single resource
{ "data": { /* resource */ } }

// List
{ "data": [ /* resources */ ], "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 } }

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [ { "path": "endDate", "message": "End date must be on or after start date" } ],  // optional
    "requestId": "8f0c…"                                                                          // present on 500
  }
}
```

`DELETE` and `logout` return **204 No Content** with no body.
A `page` past the last page returns `200` with `data: []` and the real `meta` (`total`, `totalPages`), so clients can step back a page after deleting the last item on it. An empty list has `totalPages: 0` (D-032).

### 1.2 Error codes

| HTTP | `code`                      | When                                                                             | Client behaviour                                                      |
| ---- | --------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`          | Body, params or query fail the schema                                            | Map `details[].path` to form fields; otherwise toast                  |
| 400  | `INVALID_JSON`              | Malformed JSON body                                                              | Generic toast                                                         |
| 401  | `UNAUTHENTICATED`           | No bearer token on a 🔒 route                                                    | → session-expired flow                                                |
| 401  | `TOKEN_EXPIRED`             | Access JWT expired                                                               | Refresh once, then retry. If the refresh fails → session-expired flow |
| 401  | `TOKEN_INVALID`             | Bad signature, malformed token or wrong algorithm                                | → session-expired flow                                                |
| 401  | `SESSION_REVOKED`           | Session logged out, expired or reused                                            | Refresh once (it will normally fail) → session-expired flow           |
| 401  | `INVALID_CREDENTIALS`       | Login failed                                                                     | Form error "Invalid email or password" (**not** session-expired)      |
| 401  | `INVALID_REFRESH_TOKEN`     | Refresh token is unknown, expired, revoked or reused                             | → session-expired flow                                                |
| 404  | `NOT_FOUND`                 | Resource doesn't exist **or isn't owned by the caller**, or the route is unknown | "Not found" screen or toast                                           |
| 409  | `EMAIL_TAKEN`               | Registering an existing email                                                    | Form error on email                                                   |
| 409  | `CONFLICT`                  | Unique clash (e.g. a project key already used by this user)                      | Form error on that field                                              |
| 413  | `PAYLOAD_TOO_LARGE`         | Body over 100 kb                                                                 | Toast                                                                 |
| 429  | `RATE_LIMITED`              | Too many requests                                                                | "Too many attempts. Try again in N minutes." (N from `Retry-After`)   |
| 500  | `INTERNAL_ERROR`            | Unexpected server error                                                          | "Something went wrong" + Retry                                        |
| —    | `NETWORK_ERROR` / `TIMEOUT` | **Client-side only**, set by the shared API client                               | Offline / Retry UI                                                    |

---

## 2. Resource types

```ts
type ProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

interface User {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}

interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface TaskCounts {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

interface Project {
  id: string;
  key: string; // "WEB"
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  taskCounts: TaskCounts;
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: string;
  key: string; // "WEB-12" (project.key + '-' + number)
  number: number;
  projectId: string;
  project: { id: string; key: string; name: string };
  name: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null; // YYYY-MM-DD
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Dashboard {
  today: string;
  totalProjects: number;
  projectsInProgress: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  projectsByStatus: Record<ProjectStatus, number>;
  tasksByPriority: Record<TaskPriority, number>;
  overdue: Task[]; // up to 5, non-completed, dueDate < today, oldest due first
  upcoming: Task[]; // up to 5, non-completed, dueDate >= today, ascending
}

interface ActivityEntry {
  // bonus (BON-08)
  id: string;
  entityType: 'PROJECT' | 'TASK';
  entityId: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED';
  changes: Record<string, { from: unknown; to: unknown }> | null;
  createdAt: string;
}

interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

### 2.1 Field validation (shared Zod schemas)

| Field                             | Rule                                                                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fullName`                        | trim · 2–100 characters                                                                                                                                                 |
| `email`                           | trim · lowercase · valid email · max 255                                                                                                                                |
| `password`                        | at least 8 characters and at most **72 bytes** in UTF-8 (bcrypt's limit) · at least 1 letter and 1 number (on register only; login only checks 1 character to 72 bytes) |
| `project.name`                    | trim · 1–120                                                                                                                                                            |
| `project.key`                     | trim · uppercase · `^[A-Z][A-Z0-9]{1,9}$` (2–10 characters)                                                                                                             |
| `description`                     | trim · max 5000 · empty string → `null`                                                                                                                                 |
| `status` / `priority`             | exact enum values (case-sensitive)                                                                                                                                      |
| `startDate`, `endDate`, `dueDate` | `YYYY-MM-DD` and a real calendar date, or `null`                                                                                                                        |
| `endDate`                         | `>= startDate` when both are set (checked after merging on update)                                                                                                      |
| `task.name`                       | trim · 1–200                                                                                                                                                            |
| `projectId`                       | UUID                                                                                                                                                                    |
| `:id` params                      | UUID (invalid → 400 `VALIDATION_ERROR`)                                                                                                                                 |
| `page`                            | int ≥ 1, default 1                                                                                                                                                      |
| `limit`                           | int 1–100, default 20                                                                                                                                                   |
| `search`                          | trim · max 100 · empty → ignored                                                                                                                                        |
| list enums in query               | comma-separated, each must be valid, e.g. `status=PENDING,IN_PROGRESS`                                                                                                  |
| `today`                           | `YYYY-MM-DD`, default = the server's UTC date                                                                                                                           |
| Unknown body fields               | stripped silently (`ownerId`, `id`, `number`, `completedAt` … are never accepted)                                                                                       |

---

## 3. Health

### `GET /api/health`

200 → `{ "data": { "status": "ok", "uptime": 123.4 } }`. No auth and no database access. Used by Render.

### `GET /api/docs` · `GET /api/docs/openapi.json`

Swagger UI and the OpenAPI 3.1 document it loads. No auth. The document is built from the shared Zod request schemas; response schemas are checked against the shared response types at compile time.

---

## 4. Auth

### `POST /api/auth/register`

Rate limit: 10 per hour per IP.

```json
// request
{ "fullName": "Demo User", "email": "demo@tidyr.test", "password": "Passw0rd!" }
```

**201** → `{ "data": AuthResult }`
Errors: 400 `VALIDATION_ERROR`, 409 `EMAIL_TAKEN`, 429 `RATE_LIMITED`.
Notes: lowercases the email, hashes the password with bcrypt, creates the user and a session in one transaction. Stores the `User-Agent` on the session (truncated to 255 characters).

### `POST /api/auth/login`

Rate limit: 10 failed attempts per 15 min per **IP + email** pair (successful logins aren't counted). Keying on the pair means testing the limit with one email never locks out another account from the same network (D-015).

```json
{ "email": "demo@tidyr.test", "password": "Passw0rd!" }
```

**200** → `{ "data": AuthResult }`
Errors: 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS` (same message whether the email or the password is wrong; timing equalized), 429 `RATE_LIMITED`.

### `POST /api/auth/refresh`

Rate limit: 60 per 15 min per IP. No access token needed.

```json
{ "refreshToken": "<sessionId>.<secret>" }
```

**200** → `{ "data": { "accessToken": "...", "refreshToken": "..." } }`. The refresh token is **rotated**: the old one stops working.
Errors: 400 `VALIDATION_ERROR`, 401 `INVALID_REFRESH_TOKEN`, 429.
**Reuse handling (D-016):** if a token that was already rotated is presented again **within `REFRESH_REUSE_GRACE_SECONDS` (30 s)** of its rotation, it's treated as a retry (for example, the response was lost on a flaky mobile network). The session is rotated again and a new pair is returned. Presenting it **after** the grace window counts as theft: the session is revoked and 401 `INVALID_REFRESH_TOKEN` is returned.

### `POST /api/auth/logout` 🔒

No body. Revokes the **current** session only. **204**.
Errors: 401 (clients ignore errors and clear local tokens anyway). Logout never triggers the session-expired flow on the client.

### `GET /api/auth/me` 🔒

**200** → `{ "data": User }`. Errors: 401.

---

## 5. Projects 🔒

### `GET /api/projects`

| Query           | Type                                        | Default                                                                     |
| --------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| `search`        | string                                      | — (case-insensitive `contains` on name; `%` and `_` match literally, D-032) |
| `status`        | `ProjectStatus[]` (comma list)              | all                                                                         |
| `sort`          | `createdAt \| updatedAt \| name \| endDate` | `createdAt`                                                                 |
| `order`         | `asc \| desc`                               | `desc`                                                                      |
| `page`, `limit` | int                                         | 1, 20                                                                       |

**200** → `{ "data": Project[], "meta": PageMeta }`. Only the caller's projects. `endDate` sorts with nulls last.

### `GET /api/projects/:id`

**200** → `{ "data": Project }`. Errors: 400 (bad uuid), 404.
Tasks are fetched separately: `GET /api/tasks?projectId=:id`.

### `POST /api/projects`

```json
{
  "name": "Website Redesign",
  "description": "Q4 refresh of marketing site",
  "status": "NOT_STARTED",
  "startDate": "2026-10-10",
  "endDate": "2026-12-15",
  "key": "WEB"
}
```

Only `name` is required. If `key` is missing, it's generated from the name: the initials of up to 4 words, or the first 3 letters of a single word, A–Z only. If that gives fewer than 2 letters, the key is `PRJ`. If the key is already taken, a number suffix is added (`WR`, `WR2`, …).
**201** → `{ "data": Project }` (with `taskCounts` all 0).
Errors: 400, 409 `CONFLICT` (an explicitly supplied `key` is already used by this user).

### `PUT /api/projects/:id`

Partial body with any of `name, description, status, startDate, endDate, key` (at least one).
**200** → `{ "data": Project }`. Errors: 400 (including end before start after merging), 404, 409.

### `DELETE /api/projects/:id`

Deletes the project and **all its tasks** (DB cascade). Writes an audit entry. **204**. Errors: 400, 404.

---

## 6. Tasks 🔒

### `GET /api/tasks`

| Query           | Type                                                               | Default         | Notes                                                                                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectId`     | uuid                                                               | —               | Restrict to one project. A project that isn't owned or doesn't exist gives an empty list.                                                                                                                                                                                       |
| `search`        | string                                                             | —               | Name `contains` (case-insensitive, LIKE wildcards literal). If it matches `^[A-Za-z][A-Za-z0-9]{1,9}-\d+$`, it's **also** matched as a task key (project key + number), only among the caller's tasks. A number beyond int4 can't be a key, so it's a name search only (D-033). |
| `status`        | `TaskStatus[]`                                                     | all             |                                                                                                                                                                                                                                                                                 |
| `priority`      | `TaskPriority[]`                                                   | all             |                                                                                                                                                                                                                                                                                 |
| `due`           | `overdue \| today \| week \| none`                                 | —               | Relative to `today`. `overdue` = dueDate < today and not completed. `week` = today … today+6. `none` = no due date. Combined with the other filters by AND, so `due=overdue&status=COMPLETED` is empty (D-033).                                                                 |
| `today`         | YYYY-MM-DD                                                         | server UTC date | The client's local date                                                                                                                                                                                                                                                         |
| `sort`          | `createdAt \| updatedAt \| dueDate \| priority \| name \| urgency` | `createdAt`     | `priority` sorts by enum order LOW < MEDIUM < HIGH. `dueDate` puts nulls last. `urgency`: open tasks by due date (overdue first, no date last), then completed tasks, most recently completed first; ignores `order` (D-038).                                                   |
| `order`         | `asc \| desc`                                                      | `desc`          |                                                                                                                                                                                                                                                                                 |
| `page`, `limit` | int                                                                | 1, 20           |                                                                                                                                                                                                                                                                                 |

**200** → `{ "data": Task[], "meta": PageMeta }`.

### `GET /api/tasks/:id`

**200** → `{ "data": Task }`. Errors: 400, 404.

### `POST /api/tasks`

```json
{
  "projectId": "6b1f…",
  "name": "Design hero section",
  "description": "Use new brand colors",
  "priority": "HIGH",
  "status": "PENDING",
  "dueDate": "2026-10-20"
}
```

`projectId` and `name` are required. In one transaction: check that the project is owned (404 if not), increment `project.taskSeq`, insert the task with `number` = the new sequence value, and write an audit entry. If `status = COMPLETED`, set `completedAt = now()`.
**201** → `{ "data": Task }`. Errors: 400, 404.

### `PUT /api/tasks/:id`

Partial body with any of `name, description, priority, status, dueDate` (at least one). `projectId` is **not accepted** (D-008; it's stripped).
Status transitions: anything → `COMPLETED` sets `completedAt = now()` (if it isn't set already). `COMPLETED` → anything else clears `completedAt`.
**200** → `{ "data": Task }`. Errors: 400, 404.

> "Mark completed" = `PUT /api/tasks/:id { "status": "COMPLETED" }`. Both clients use exactly this.

### `DELETE /api/tasks/:id`

**204**. Errors: 400, 404.

---

## 7. Dashboard 🔒

### `GET /api/dashboard?today=YYYY-MM-DD`

**200**

```json
{
  "data": {
    "today": "2026-10-07",
    "totalProjects": 5,
    "projectsInProgress": 2,
    "totalTasks": 42,
    "completedTasks": 18,
    "pendingTasks": 15,
    "inProgressTasks": 9,
    "overdueTasks": 3,
    "projectsByStatus": { "NOT_STARTED": 2, "IN_PROGRESS": 2, "COMPLETED": 1 },
    "tasksByPriority": { "LOW": 10, "MEDIUM": 20, "HIGH": 12 },
    "overdue": [/* Task, max 5 */],
    "upcoming": [/* Task, max 5 */]
  }
}
```

Required by the brief: `totalProjects`, `totalTasks`, `completedTasks`, `pendingTasks`, `projectsInProgress`. The rest is extra. Every enum key is always present (0 if none).
`today` defaults to the server's UTC date; send the client's local date (D-009). `overdueTasks` uses exactly the `GET /tasks?due=overdue` rule, so the count matches the list it links to. `tasksByPriority` counts every task, completed ones included, so it sums to `totalTasks`. `overdue` and `upcoming` are ordered by `dueDate` ascending, then priority (HIGH first), then `id` (D-034).

---

## 8. Activity (bonus, BON-08) 🔒

### `GET /api/projects/:id/activity?page&limit`

Entries for the project **and** its tasks, newest first. 404 if the project isn't owned. **200** → `{ data: ActivityEntry[], meta }`.

### `GET /api/tasks/:id/activity?page&limit`

Entries for one task. 404 if the task isn't owned, or has been deleted (its history stays in the project feed). **200** → `{ data: ActivityEntry[], meta }`.

Both lists are newest first (ties broken by `id`), paginated like other lists (`page` default 1, `limit` 1–100, default 20), and return 400 for a non-uuid id (D-034).

`changes` only lists the fields that changed, e.g. `{ "status": { "from": "PENDING", "to": "COMPLETED" } }`. For `CREATED` and `DELETED` it is `null`. An update that changes nothing writes no entry (D-032). Descriptions are recorded as `{ from: "…", to: "…" }`, truncated to 200 characters.

---

## 9. Examples

```bash
# Register
curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"fullName":"Demo User","email":"demo@tidyr.test","password":"Passw0rd!"}'

# Authenticated list with filters
curl -s "$API/tasks?status=PENDING,IN_PROGRESS&priority=HIGH&sort=dueDate&order=asc" \
  -H "Authorization: Bearer $TOKEN"

# Mark complete
curl -s -X PUT $API/tasks/$TASK_ID -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"COMPLETED"}'

# Cross-user access (expected 404)
curl -s -o /dev/null -w '%{http_code}\n' $API/projects/$OTHER_USERS_PROJECT -H "Authorization: Bearer $TOKEN"

# Dashboard for the client's local date
curl -s "$API/dashboard?today=2026-10-07" -H "Authorization: Bearer $TOKEN"

# Activity of a project (its own entries and its tasks'), newest first
curl -s "$API/projects/$PROJECT_ID/activity?limit=10" -H "Authorization: Bearer $TOKEN"
```

Example dashboard response for the seeded demo user (`today=2026-10-08`, lists shortened):

```json
{
  "data": {
    "today": "2026-10-08",
    "totalProjects": 4,
    "projectsInProgress": 2,
    "totalTasks": 24,
    "completedTasks": 8,
    "pendingTasks": 13,
    "inProgressTasks": 3,
    "overdueTasks": 3,
    "projectsByStatus": { "NOT_STARTED": 1, "IN_PROGRESS": 2, "COMPLETED": 1 },
    "tasksByPriority": { "LOW": 6, "MEDIUM": 10, "HIGH": 8 },
    "overdue": [{ "key": "WEB-3", "dueDate": "2026-10-04", "status": "PENDING", "…": "…" }],
    "upcoming": [{ "key": "MOB-3", "dueDate": "2026-10-08", "status": "PENDING", "…": "…" }]
  }
}
```

Example activity entry:

```json
{
  "id": "2034a0e1-9bb3-4ad5-a1c9-e4e88afb0591",
  "entityType": "TASK",
  "entityId": "09af1bcd-be3a-4211-963a-26628225c36b",
  "action": "UPDATED",
  "changes": { "priority": { "from": "HIGH", "to": "LOW" } },
  "createdAt": "2026-10-07T18:30:41.753Z"
}
```

---

## 10. Shared API client surface (`packages/shared/src/api-client`)

```ts
createApiClient({
  baseUrl: string,
  tokenStore: {
    getAccessToken(): Promise<string | null>;
    getRefreshToken(): Promise<string | null>;
    setTokens(t: { accessToken: string; refreshToken: string }): Promise<void>;
    clear(): Promise<void>;
  },
  onSessionExpired: (reason: 'expired' | 'invalid') => void,
  timeoutMs?: number,              // default 15000
  fetchImpl?: typeof fetch,
  runExclusive?: <T>(fn: () => Promise<T>) => Promise<T>,  // web: navigator.locks so only one tab refreshes at a time
}) => {
  auth:      { register, login, logout, me, refresh },
  projects:  { list(params), get(id), create(body), update(id, body), remove(id), activity(id, params) },
  tasks:     { list(params), get(id), create(body), update(id, body), remove(id), activity(id, params) },
  dashboard: { get({ today }) },
}
// Methods resolve to the unwrapped `data` (lists resolve to `{ data, meta }`).
// Methods reject with ApiError { status, code, message, details?, retryAfter? }.
// login/register/refresh store tokens via tokenStore; logout always clears them.
// login/register/refresh/logout never call onSessionExpired.
// The refresh step re-reads the refresh token from tokenStore *inside* runExclusive, so a tab that waited
// on the lock uses the token another tab just rotated instead of replaying the old one.
```
