# InsightUBC 

A web app for UBC course planning. Upload sections and rooms datasets, browse
your library, search by professor / grade / department / title / year /
building, and read the year-over-year **Course Pulse** of any UBC course.
The frontend is served by the same Express server that exposes the REST API.

Showcase Video: https://www.youtube.com/watch?v=vOoid99DFIM

---

## Quick start 

**Prerequisites:** Node.js `>= 24 < 25` (see `.nvmrc`) and Yarn.

```bash
# 1. From the project root
cd InsightUBC

# 2. Install dependencies
yarn install

# 3. (Optional) build / type-check
yarn build (Run "yarn prettier:fix" if yarn build fails)

# 4. Start the server (serves the REST API and the web frontend)
yarn start
```

Then open the app:

```
http://localhost:4321
```

> The frontend uses **same-origin** requests, so open it through the running
> server at `http://localhost:4321` — not by double-clicking `index.html`.
>
> To use a different port, edit `src/App.ts` (or pass via env if you wired it
> up). The default is `4321`.

### Sample data (`test/resources/archives/`)

| Kind       | File          | Suggested id |
| ---------- | ------------- | ------------ |
| `sections` | `pair.zip`    | `sections`   |
| `rooms`    | `campus.zip`  | `rooms`      |

> Parsing a `rooms` archive calls UBC's geolocation service, so it needs
> network access to `cs310.students.cs.ubc.ca`. The five core user stories
> below all work with the `sections` dataset alone (`pair.zip`); rooms
> features (rooms search + Course Pulse anchor lookups) need `campus.zip`.

---

## Features (what to demo)

### 1 · Upload a dataset
*"As a student, I want to upload sections or rooms data."*

- The **Add a dataset** form takes a **kind** (`sections` / `rooms`), an
  **id**, and a `.zip` archive (drag-and-drop or browse).
- A valid zip + id is added and immediately appears in **Your library**.
- Submitting **without a file**, with an **invalid id** (underscore, empty,
  whitespace-only), or with a **non-zip body** → an inline error message
  matching the backend's `addDataset()` reasons; the request is rejected.
- Backed by `[PUT] /dataset/:id/:kind`.

### 2 · See your library and remove an entry
*"As a student, I want to see and prune the datasets I've added."*

- The **Your library** section is a ledger that lists every added dataset
  with its **id**, **kind** (with a colored dot — indigo for sections, cyan
  for rooms), and **row count**.
- Hovering a row reveals a **Retire** action. Clicking it removes the dataset
  via `[DELETE] /dataset/:id`; the list updates immediately.
- With nothing added, the list shows an italic **"No archives yet."** state.
- Backed by `[GET] /datasets` and `[DELETE] /dataset/:id`.

### 3 · Search sections (and rooms)
*"As a student, I want to find sections by professor, grade, dept, course id,
title, or year — and rooms by capacity, type, building, or furniture."*

- The **Search** section toggles between two modes via underline tabs.
- **Sections mode** filters: Professor (token-contains), Department (with
  full UBC subject-code autocomplete via a `<datalist>`), Course id (exact
  match), Title contains (with synonym expansion — typing
  *"artificial intelligence"* also matches the abbreviated *"Artif Intell"*
  forms in the dataset), Section average (below / above / equals + value),
  Year (exact match), and an *Include year-1900 rollups* opt-in for the
  "overall" summary rows.
- **Rooms mode** filters: Minimum seats, Building code (with autocomplete
  populated from the active dataset and substring matching across both
  shortname *and* fullname — typing `BUC` finds Buchanan, `klinck` finds
  LSK, `ICCS` resolves to LSK via the alias map), Room type (dropdown of
  UBC's 6 official type buckets), Furniture (dropdown of common UBC
  furniture configurations + a *Custom keyword* fallback).
- An invalid query returns an inline **"This query is invalid … please
  adjust and retry"** message.
- Results render in a sorted table with course-title expansion (3,586
  abbreviations mapped to full English names), professor name normalization
  (`smith, john a` → `John A Smith`, with Mc/Mac/O' / hyphen handling),
  zebra striping, and incremental pagination (50 rows by default with
  *Show 50 more* and *show every record* affordances).
- An **Expert mode** pill in the top-right of the search panel exposes a
  raw JSON query textarea for the rubric's "submit a query as JSON" demo.
- Backed by `[POST] /query`.

### 4 · Course Pulse (custom feature)
*"As a student, I want to read the historical pulse of a course — its
year-by-year grade average, who teaches it best, and how it compares to its
department."*

- Pick a sections dataset, type a department + course id (or use one of the
  one-click presets like *CPSC 310* or *MATH 100*), and click **Read pulse**.
- The masthead shows the course code in gradient serif type, the full course
  title, the department's full name, and a sparkline of the trend.
- Four KPIs animate in via count-up: total sections, overall weighted avg,
  year range, and the **vs Dept** delta (green if the course is easier than
  its department, red if harder).
- A dual-line SVG chart plots the course's year-over-year average against
  the department baseline, with a rich tooltip on every point showing the
  year, course avg + sections, dept avg + sections, and the delta.
- A horizontal bar chart shows the top instructors weighted by section
  count — bar opacity scales with the section-count quantile, so a 95% from
  one section reads quieter than 80% from twenty.
- A year strip beneath shows one tile per year coloured on a diverging
  scale (indigo → violet → pink → gold) by avg, with tile height
  proportional to section count.
- Backed by the custom `[POST] /insights/course-pulse` endpoint, which
  fans out three GROUP+APPLY queries (course trend, top instructors,
  department baseline) against the existing `IInsightFacade.performQuery`
  and merges the results — exercising the C2 EBNF (TRANSFORMATIONS,
  GROUP, APPLY, ORDER objects, NOT, OR) end-to-end.

> **Filter year-1900 rollups by default.** UBC stamps year `1900` on every
> section's "overall" summary row. The default search drops these via
> `NOT EQ year:1900` so result counts aren't doubled. The opt-in checkbox
> brings them back if needed.

---

## How the frontend talks to the backend

| Action            | Request |
| ----------------- | ------- |
| Add a dataset     | `[PUT] /dataset/:id/:kind` with the raw `.zip` as the body (`Content-Type: application/x-zip-compressed`) |
| List datasets     | `[GET] /datasets` → `{ result: [{ id, kind, numRows }] }` |
| Remove a dataset  | `[DELETE] /dataset/:id` |
| Run a query       | `[POST] /query` with a JSON query body → `{ result: InsightResult[] }` |
| Course Pulse      | `[POST] /insights/course-pulse` with `{ id, dept, course, ... }` *(custom)* |

Static frontend files live in `frontend/public/` (`index.html`, `styles.css`,
`app.js`) and are served by `src/rest/Server.ts` via `express.static`.

Full endpoint documentation lives in **[`RESTServer.md`](./RESTServer.md)**.

---

## Project layout

```
src/
  App.ts                       — server entrypoint
  rest/
    Server.ts                  — Express setup, route registration
    coursePulse.ts             — custom endpoint handler
    index.ts                   — start-up bootstrap
  controller/
    IInsightFacade.ts          — public API contract (do not modify)
    InsightFacade.ts           — facade implementation
    persistence.ts             — disk persistence
    sections/parseSections.ts  — sections zip → records
    rooms/parseRooms.ts        — rooms zip → records (HTML + parse5)
    rooms/geolocation.ts       — UBC geo web service
    query/                     — query validate + execute pipeline
    strategy/                  — add-dataset strategies (sections / rooms)
frontend/public/
  index.html                   — single-page UI
  styles.css                   — editorial-product theme
  app.js                       — frontend logic, no framework
test/
  controller/                  — facade + query tests
  unit/rest/Server.spec.ts     — supertest HTTP tests for every endpoint
  resources/archives/          — pair.zip, campus.zip
data/                          — persisted datasets (created at runtime)
```

---

## Build & test

```bash
yarn build                              # tsc + prettier check
yarn test                               # full suite (controller + REST)
yarn cover                              # coverage report → coverage/index.html
yarn prettier:fix                       # auto-fix formatting
```

`yarn test` includes the `Server.spec.ts` HTTP suite (17 tests) covering
every endpoint including the four Course Pulse cases.

---

## Submission links

- **REST design:** [`RESTServer.md`](./RESTServer.md)
- **Server source:** [`src/rest/Server.ts`](./src/rest/Server.ts)
- **Custom endpoint source:** [`src/rest/coursePulse.ts`](./src/rest/coursePulse.ts)

---

### License

While the readings for this course are licensed using
[CC-by-SA](https://creativecommons.org/licenses/by-sa/3.0/), **checkpoint
descriptions and implementations are considered private materials**. Please
do not post or share your project solutions. Please be considerate with these
private materials and not pass them along to others, make your repos public,
or post them to other sites online.
