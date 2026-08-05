/* ============================================================================
 * Course Pulse — custom insight backed entirely by IInsightFacade.performQuery.
 *
 * Given a sections dataset, a department, and a course id, fan out three
 * GROUP+APPLY queries and merge the results:
 *   1. Course trend by year      — avg + section count of THIS course per year
 *   2. Top instructors           — avg + section count of THIS course per prof
 *   3. Department baseline       — avg of the WHOLE dept per year (for context)
 *
 * Why this design:
 *  - Exercises the C2-grammar hard parts (GROUP, APPLY, ORDER object form,
 *    NOT) instead of just filter+columns.
 *  - The cross-query comparison (course vs dept baseline) cannot be expressed
 *    in a single query — three calls, merged in-process, is the right shape.
 *  - The "year=1900 overall sentinel" is filtered out in every query (GT 1900).
 *  - Empty-instructor rollup rows are filtered with NOT(IS(instructor:"")).
 *
 * Exposed shape:
 *   POST /insights/course-pulse
 *   body: { id: string, dept: string, course: string, minYear?: number, topN?: number }
 *   response: {
 *     dept, course, totalSections, overallAvg,
 *     trend:        [{ year, avg, sections }],
 *     topInstructors: [{ instructor, avg, sections, weight }],
 *     deptBaseline: [{ year, avg, sections }],
 *   }
 * ========================================================================== */
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { IInsightFacade, InsightDatasetKind, InsightResult } from "../controller/IInsightFacade";

const DEFAULT_MIN_YEAR = 1901; // 1900 is the "overall" sentinel; exclude it.
const DEFAULT_TOP_N = 5;
const MAX_TOP_N = 20;
const TWO_DP = 2;

interface PulseRequest {
	id: string;
	dept: string;
	course: string;
	minYear?: number;
	topN?: number;
}

interface YearPoint {
	year: number;
	avg: number;
	sections: number;
}

interface InstructorPoint {
	instructor: string;
	avg: number;
	sections: number;
	weight: number; // 0..1 confidence proxy by section count quantile
}

export function makeCoursePulseHandler(facade: IInsightFacade) {
	return async function handle(req: Request, res: Response): Promise<void> {
		try {
			const body = parseBody(req.body);

			const datasets = await facade.listDatasets();
			const target = datasets.find((d) => d.id === body.id);
			if (!target) {
				res.status(StatusCodes.NOT_FOUND).json({ error: `Dataset "${body.id}" not found` });
				return;
			}
			if (target.kind !== InsightDatasetKind.Sections) {
				res.status(StatusCodes.BAD_REQUEST).json({ error: `Dataset "${body.id}" is not a sections dataset` });
				return;
			}

			const minYear = body.minYear ?? DEFAULT_MIN_YEAR;
			const topN = clamp(body.topN ?? DEFAULT_TOP_N, 1, MAX_TOP_N);

			const [trendRaw, instructorsRaw, baselineRaw] = await Promise.all([
				facade.performQuery(buildCourseTrendQuery(body.id, body.dept, body.course, minYear)),
				facade.performQuery(buildInstructorsQuery(body.id, body.dept, body.course, minYear)),
				facade.performQuery(buildDeptBaselineQuery(body.id, body.dept, minYear)),
			]);

			const trend = sortByYear(toYearPoints(trendRaw));
			const baseline = sortByYear(toYearPoints(baselineRaw));
			const totalSections = trend.reduce((s, p) => s + p.sections, 0);

			if (totalSections === 0) {
				res.status(StatusCodes.NOT_FOUND).json({
					error: `No sections found for ${body.dept.toUpperCase()} ${body.course} in "${body.id}"`,
				});
				return;
			}

			const instructors = rankInstructors(instructorsRaw, topN);
			const overallAvg = round2(weightedYearAvg(trend));

			res.status(StatusCodes.OK).json({
				dept: body.dept,
				course: body.course,
				totalSections,
				overallAvg,
				trend,
				topInstructors: instructors,
				deptBaseline: baseline,
			});
		} catch (err) {
			res.status(StatusCodes.BAD_REQUEST).json({ error: errMessage(err) });
		}
	};
}

function parseBody(raw: unknown): PulseRequest {
	const body = unwrapJsonBody(raw);
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		throw new Error("Request body must be a JSON object");
	}
	const b = body as { [k: string]: unknown };
	const id = requireString(b, "id");
	const dept = requireString(b, "dept").toLowerCase();
	const course = requireString(b, "course");

	const out: PulseRequest = { id, dept, course };
	if (b.minYear !== undefined) {
		if (typeof b.minYear !== "number" || !Number.isFinite(b.minYear)) {
			throw new Error('Field "minYear" must be a number');
		}
		out.minYear = b.minYear;
	}
	if (b.topN !== undefined) {
		if (typeof b.topN !== "number" || !Number.isFinite(b.topN)) {
			throw new Error('Field "topN" must be a number');
		}
		out.topN = b.topN;
	}
	return out;
}

function requireString(b: { [k: string]: unknown }, name: string): string {
	const v = b[name];
	if (typeof v !== "string" || v.trim().length === 0) {
		throw new Error(`Field "${name}" is required`);
	}
	return v.trim();
}

function unwrapJsonBody(raw: unknown): unknown {
	if (Buffer.isBuffer(raw)) {
		const text = raw.toString("utf8").trim();
		if (text.length === 0) return {};
		return JSON.parse(text);
	}
	return raw;
}

// ----- Query builders -------------------------------------------------------
function buildCourseTrendQuery(id: string, dept: string, course: string, minYear: number): unknown {
	return {
		WHERE: {
			AND: [
				{ IS: { [`${id}_dept`]: dept } },
				{ IS: { [`${id}_id`]: course } },
				{ GT: { [`${id}_year`]: minYear - 1 } },
			],
		},
		OPTIONS: {
			COLUMNS: [`${id}_year`, "avgAvg", "numSections"],
			ORDER: { dir: "UP", keys: [`${id}_year`] },
		},
		TRANSFORMATIONS: {
			GROUP: [`${id}_year`],
			APPLY: [{ avgAvg: { AVG: `${id}_avg` } }, { numSections: { COUNT: `${id}_uuid` } }],
		},
	};
}

function buildInstructorsQuery(id: string, dept: string, course: string, minYear: number): unknown {
	return {
		WHERE: {
			AND: [
				{ IS: { [`${id}_dept`]: dept } },
				{ IS: { [`${id}_id`]: course } },
				{ GT: { [`${id}_year`]: minYear - 1 } },
				{ NOT: { IS: { [`${id}_instructor`]: "" } } },
			],
		},
		OPTIONS: {
			COLUMNS: [`${id}_instructor`, "avgAvg", "numSections"],
			ORDER: { dir: "DOWN", keys: ["avgAvg", "numSections"] },
		},
		TRANSFORMATIONS: {
			GROUP: [`${id}_instructor`],
			APPLY: [{ avgAvg: { AVG: `${id}_avg` } }, { numSections: { COUNT: `${id}_uuid` } }],
		},
	};
}

function buildDeptBaselineQuery(id: string, dept: string, minYear: number): unknown {
	return {
		WHERE: {
			AND: [{ IS: { [`${id}_dept`]: dept } }, { GT: { [`${id}_year`]: minYear - 1 } }],
		},
		OPTIONS: {
			COLUMNS: [`${id}_year`, "avgAvg", "numSections"],
			ORDER: { dir: "UP", keys: [`${id}_year`] },
		},
		TRANSFORMATIONS: {
			GROUP: [`${id}_year`],
			APPLY: [{ avgAvg: { AVG: `${id}_avg` } }, { numSections: { COUNT: `${id}_uuid` } }],
		},
	};
}

// ----- Result shaping -------------------------------------------------------
function toYearPoints(rows: InsightResult[]): YearPoint[] {
	return rows
		.map((r) => {
			// The year key may be `<id>_year` or already stripped if upstream changed.
			let year = NaN;
			for (const k of Object.keys(r)) {
				if (k.endsWith("_year")) {
					year = Number(r[k]);
					break;
				}
			}
			return {
				year,
				avg: round2(Number(r.avgAvg)),
				sections: Number(r.numSections),
			};
		})
		.filter((p) => Number.isFinite(p.year));
}

function sortByYear(points: YearPoint[]): YearPoint[] {
	return points.slice().sort((a, b) => a.year - b.year);
}

function rankInstructors(rows: InsightResult[], topN: number): InstructorPoint[] {
	const cleaned = rows
		.map((r) => {
			let instructor = "";
			for (const k of Object.keys(r)) {
				if (k.endsWith("_instructor")) {
					instructor = String(r[k]);
					break;
				}
			}
			return {
				instructor,
				avg: round2(Number(r.avgAvg)),
				sections: Number(r.numSections),
			};
		})
		.filter((p) => p.instructor.trim().length > 0);

	if (cleaned.length === 0) return [];

	// Confidence weight = section-count percentile (0..1). Visualizes how many
	// sections back each prof's average — a 95% with 1 section reads weaker
	// than an 80% with 20 sections.
	const counts = cleaned.map((p) => p.sections).sort((a, b) => a - b);
	const maxCount = counts[counts.length - 1] || 1;
	const minCount = counts[0] || 1;
	const span = maxCount === minCount ? 1 : maxCount - minCount;

	return cleaned.slice(0, topN).map((p) => ({
		...p,
		weight: round2(Math.max(0.15, (p.sections - minCount) / span)),
	}));
}

function weightedYearAvg(points: YearPoint[]): number {
	let totalAvg = 0;
	let totalSections = 0;
	for (const p of points) {
		totalAvg += p.avg * p.sections;
		totalSections += p.sections;
	}
	return totalSections === 0 ? 0 : totalAvg / totalSections;
}

function round2(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Number(n.toFixed(TWO_DP));
}

function clamp(n: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, n));
}

function errMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

