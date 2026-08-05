<details>
<summary>AI usage disclaimer</summary>

Used AI to assist in writing RESTServer.md:

</details>

# RESTServer

REST API documentation for InsightUBC. The server (`src/rest/Server.ts`) exposes
five endpoints, all same-origin with the frontend served from `frontend/public/`
at the site root.

## RESTful conventions

- **Stateless.** Every request carries enough context to be answered on its own.
  No server-side session state. Datasets persist to disk and are reloaded by id.
- **Noun + verb.** Resources are named (`/dataset`, `/datasets`, `/query`,
  `/insights/course-pulse`); the HTTP verb describes the action (PUT to add,
  DELETE to remove, GET to list, POST to act).
- **Status codes.** `200` on success, `400` on invalid input, `404` on missing
  resource. Errors return `{ "error": "<reason>" }`; success returns
  `{ "result": ... }` (or a structured object for the custom endpoint).
- **Versioning.** This is the v1 API, served at the root path. A future v2
  would be served at `/v2/...` alongside.
- **CORS.** `cors()` middleware is enabled for cross-origin tooling.

---

## Endpoints

### `[PUT] /dataset/:id/:kind`

Add a dataset. The body is the raw bytes of a `.zip` archive.

**URL parameters:**
- `id` *(required)* — dataset id (no underscores, not all-whitespace)
- `kind` *(required)* — `sections` or `rooms`

**Request properties (body):**
- raw zip bytes; send with `Content-Type: application/x-zip-compressed` (any
  non-JSON content type works, since the server registers a wildcard raw parser)

**Status codes:**
- `200` on successful add
- `400` on validation failure: invalid id, duplicate id, invalid kind, non-zip
  body, or empty dataset

**Sample response:**
```json
{ "result": ["sections", "campus"] }
```
(returns the list of all dataset ids currently registered, including the new one)

---

### `[GET] /datasets`

List currently added datasets.

**No parameters.**

**Status codes:**
- `200` always (empty array if no datasets)

**Sample response:**
```json
{
  "result": [
    { "id": "sections", "kind": "sections", "numRows": 64612 },
    { "id": "campus",   "kind": "rooms",    "numRows": 364   }
  ]
}
```

---

### `[DELETE] /dataset/:id`

Remove a dataset previously added with `PUT /dataset/:id/:kind`.

**URL parameters:**
- `id` *(required)* — dataset id

**Status codes:**
- `200` on successful removal
- `404` if no dataset with that id has been added
- `400` on invalid id (underscore, all-whitespace, or empty)

**Sample response:**
```json
{ "result": "sections" }
```

---

### `[POST] /query`

Run a query against a previously-added dataset. The query JSON conforms to the
EBNF in the project specification (sections + rooms grammar).

**Request properties (body):**
- a JSON object with required `WHERE` and `OPTIONS` keys, optional
  `TRANSFORMATIONS`. See the InsightUBC spec for the full grammar.
- `Content-Type: application/json` recommended

**Status codes:**
- `200` on success
- `400` on invalid JSON, structural validation failure, missing dataset, or
  more than 5,000 results

**Sample request:**
```json
{
  "WHERE":   { "GT": { "sections_avg": 97 } },
  "OPTIONS": {
    "COLUMNS": ["sections_dept", "sections_avg"],
    "ORDER":   "sections_avg"
  }
}
```

**Sample response:**
```json
{
  "result": [
    { "sections_dept": "math", "sections_avg": 97.09 },
    { "sections_dept": "epse", "sections_avg": 97.09 }
  ]
}
```

---

### `[POST] /insights/course-pulse`  *(custom)*

Read the year-over-year **Pulse** of a single course: yearly average, top
instructors weighted by section count, and the department's year-by-year
baseline for context. Powers the **Course Pulse** feature on the frontend.

The handler issues three GROUP+APPLY queries against
`IInsightFacade.performQuery` (course trend, instructors, dept baseline) and
merges the results in-process. No new methods are added to the public
`IInsightFacade` interface.

**Request properties (body):**
- `id` *(required, string)* — id of a `sections` dataset
- `dept` *(required, string)* — department code, e.g. `"cpsc"` (case-insensitive)
- `course` *(required, string)* — course id, e.g. `"310"`
- `minYear` *(optional, number)* — minimum year to consider (default `1901`,
  which excludes UBC's "overall" rollup rows that are stamped year-1900)
- `topN` *(optional, number)* — number of instructors to return (default `5`,
  capped at `20`)

**Status codes:**
- `200` on success
- `400` on invalid body, `id` referring to a non-sections dataset, or malformed
  input
- `404` if the dataset id does not exist, or if the course has no matching
  sections in the requested year window

**Sample request:**
```json
{ "id": "sections", "dept": "cpsc", "course": "310", "minYear": 2010 }
```

**Sample response:**
```json
{
  "dept": "cpsc",
  "course": "310",
  "totalSections": 38,
  "overallAvg": 76.21,
  "trend": [
    { "year": 2010, "avg": 75.4, "sections": 4 },
    { "year": 2011, "avg": 77.1, "sections": 5 }
  ],
  "topInstructors": [
    { "instructor": "wolfman, dan", "avg": 78.10, "sections": 12, "weight": 1.00 },
    { "instructor": "murphy, gail", "avg": 77.40, "sections":  6, "weight": 0.45 }
  ],
  "deptBaseline": [
    { "year": 2010, "avg": 73.0, "sections": 88 },
    { "year": 2011, "avg": 73.5, "sections": 92 }
  ]
}
```

**Sample error response (course not found):**
```json
{ "error": "No sections found for CPSC 9999 in \"sections\"" }
```
