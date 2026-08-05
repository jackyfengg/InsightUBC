import { InsightResult, ResultTooLargeError } from "../IInsightFacade";
import { Record } from "../types";
import { parseKeyFormat } from "../validation";
import { buildFilterTree } from "./filters/buildFilterTree";
import { applySort } from "./sort";
import { applyTransformations } from "./transformations";
import { ValidatedQuery } from "./validateQuery";

const MAX_RESULTS = 5000;

export function executeQuery(rows: Record[], q: ValidatedQuery): InsightResult[] {
	const whereKeys = Object.keys(q.where);
	let working: Record[];
	if (whereKeys.length === 0) {
		// No filter — short-circuit early-too-large only when there's no aggregation
		if (q.transformations === null && rows.length > MAX_RESULTS) {
			throw new ResultTooLargeError(`Query returned ${rows.length} results, max is ${MAX_RESULTS}`);
		}
		working = rows.slice();
	} else {
		const filter = buildFilterTree(q.where);
		working = [];
		for (const row of rows) {
			if (filter.matches(row)) {
				working.push(row);
				// Early exit only when no aggregation will reduce results
				if (q.transformations === null && working.length > MAX_RESULTS) {
					throw new ResultTooLargeError("Query returned too many results");
				}
			}
		}
	}

	let resultRows: Record[];
	if (q.transformations !== null) {
		resultRows = applyTransformations(working, q.transformations);
		if (resultRows.length > MAX_RESULTS) {
			throw new ResultTooLargeError("Query returned too many results");
		}
	} else {
		resultRows = working;
	}

	if (q.sort !== null) {
		const sortKeys = q.transformations !== null ? q.sort.keys : q.sort.keys.map((k) => parseKeyFormat(k).field);
		applySort(resultRows, { dir: q.sort.dir, keys: sortKeys });
	}

	return resultRows.map((row) => projectRow(row, q));
}

function projectRow(row: Record, q: ValidatedQuery): InsightResult {
	const out: InsightResult = {};
	for (const col of q.columns) {
		if (q.transformations !== null) {
			// In transformed result, row keys are exactly raw keys (group rawKey) and applykeys.
			out[col] = row[col] as string | number;
		} else {
			const field = parseKeyFormat(col).field;
			out[col] = row[field] as string | number;
		}
	}
	return out;
}

