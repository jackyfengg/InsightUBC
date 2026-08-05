import { InsightDatasetKind, InsightError } from "../IInsightFacade";
import { parseKeyFormat } from "../validation";
import { extractDatasetIdFromFilterStructure, validateFilter } from "./validateFilter";
import { SortSpec, Transformations, validateOrder, validateTransformations } from "./validateTransformations";
import { classify, datasetIdOfKey, KeyClassification, validateDatasetKey } from "./validateShared";

export type { ApplyRule, ApplyToken, SortSpec, Transformations } from "./validateTransformations";

export interface ValidatedQuery {
	datasetId: string;
	columns: string[];
	sort: SortSpec | null;
	where: { [k: string]: unknown };
	transformations: Transformations | null;
}

interface ParsedShell {
	whereObj: { [k: string]: unknown };
	opts: { [k: string]: unknown };
	columns: string[];
	transformationsRaw: { [k: string]: unknown } | null;
}

export function validateQuery(
	rawQuery: unknown,
	resolveKind: (id: string) => InsightDatasetKind | null
): ValidatedQuery {
	const shell = parseQueryShell(rawQuery);
	const datasetId = resolveDatasetId(shell);
	const kind = resolveKind(datasetId);
	if (kind === null) throw new InsightError(`Dataset "${datasetId}" has not been added`);
	const cls = classify(kind);

	if (Object.keys(shell.whereObj).length > 0) {
		validateFilter(shell.whereObj, datasetId, cls);
	}

	let transformations: Transformations | null = null;
	if (shell.transformationsRaw !== null) {
		transformations = validateTransformations(shell.transformationsRaw, datasetId, cls);
	}

	validateColumns(shell.columns, datasetId, cls, transformations);

	let sort: SortSpec | null = null;
	if (Object.hasOwn(shell.opts, "ORDER")) {
		sort = validateOrder(shell.opts.ORDER, shell.columns);
	}

	return { datasetId, columns: shell.columns, sort, where: shell.whereObj, transformations };
}

function parseQueryShell(rawQuery: unknown): ParsedShell {
	if (typeof rawQuery !== "object" || rawQuery === null || Array.isArray(rawQuery)) {
		throw new InsightError("Query must be a non-null object");
	}
	const q = rawQuery as { [k: string]: unknown };
	if (!Object.hasOwn(q, "WHERE")) throw new InsightError("Query must have WHERE");
	if (!Object.hasOwn(q, "OPTIONS")) throw new InsightError("Query must have OPTIONS");
	const allowedTopKeys = new Set(["WHERE", "OPTIONS", "TRANSFORMATIONS"]);
	for (const k of Object.keys(q)) {
		if (!allowedTopKeys.has(k)) throw new InsightError(`Unexpected top-level key: ${k}`);
	}
	const where = q.WHERE;
	if (typeof where !== "object" || where === null || Array.isArray(where)) {
		throw new InsightError("WHERE must be an object");
	}
	const options = q.OPTIONS;
	if (typeof options !== "object" || options === null || Array.isArray(options)) {
		throw new InsightError("OPTIONS must be an object");
	}
	const opts = options as { [k: string]: unknown };
	const columns = parseColumns(opts);
	const transformationsRaw = parseTransformationsRaw(q.TRANSFORMATIONS);
	return { whereObj: where as { [k: string]: unknown }, opts, columns, transformationsRaw };
}

function parseColumns(opts: { [k: string]: unknown }): string[] {
	for (const k of Object.keys(opts)) {
		if (k !== "COLUMNS" && k !== "ORDER") throw new InsightError(`Unexpected key in OPTIONS: ${k}`);
	}
	if (!Object.hasOwn(opts, "COLUMNS")) throw new InsightError("OPTIONS must have COLUMNS");
	const rawColumns = opts.COLUMNS;
	if (!Array.isArray(rawColumns) || rawColumns.length === 0) {
		throw new InsightError("COLUMNS must be a non-empty array");
	}
	for (const c of rawColumns) {
		if (typeof c !== "string") throw new InsightError("COLUMNS entries must be strings");
	}
	return rawColumns as string[];
}

function parseTransformationsRaw(t: unknown): { [k: string]: unknown } | null {
	if (t === undefined) return null;
	if (typeof t !== "object" || t === null || Array.isArray(t)) {
		throw new InsightError("TRANSFORMATIONS must be an object");
	}
	const obj = t as { [k: string]: unknown };
	for (const k of Object.keys(obj)) {
		if (k !== "GROUP" && k !== "APPLY") throw new InsightError(`Unexpected key in TRANSFORMATIONS: ${k}`);
	}
	if (!Object.hasOwn(obj, "GROUP")) throw new InsightError("TRANSFORMATIONS must have GROUP");
	if (!Object.hasOwn(obj, "APPLY")) throw new InsightError("TRANSFORMATIONS must have APPLY");
	const group = obj.GROUP;
	if (!Array.isArray(group) || group.length === 0) {
		throw new InsightError("GROUP must be a non-empty array");
	}
	for (const g of group) {
		if (typeof g !== "string") throw new InsightError("GROUP entries must be strings");
	}
	return obj;
}

function resolveDatasetId(shell: ParsedShell): string {
	let datasetId: string | null = null;
	if (shell.transformationsRaw !== null) {
		const group = shell.transformationsRaw.GROUP as string[];
		for (const g of group) {
			const id = datasetIdOfKey(g);
			if (datasetId === null) datasetId = id;
			else if (id !== datasetId) throw new InsightError("Query references multiple datasets");
		}
	}
	if (Object.keys(shell.whereObj).length > 0) {
		const whereId = extractDatasetIdFromFilterStructure(shell.whereObj);
		if (whereId !== null) {
			if (datasetId === null) datasetId = whereId;
			else if (whereId !== datasetId) throw new InsightError("Query references multiple datasets");
		}
	}
	for (const col of shell.columns) {
		if (col.includes("_")) {
			const parsed = parseKeyFormat(col);
			if (datasetId === null) datasetId = parsed.id;
			else if (parsed.id !== datasetId) throw new InsightError("Query references multiple datasets");
		}
	}
	if (datasetId === null) throw new InsightError("Query must reference a dataset");
	return datasetId;
}

function validateColumns(
	columns: string[],
	datasetId: string,
	cls: KeyClassification,
	transformations: Transformations | null
): void {
	if (transformations !== null) {
		const allowedSet = new Set<string>(transformations.groupKeys);
		for (const r of transformations.apply) allowedSet.add(r.applykey);
		for (const col of columns) {
			if (!allowedSet.has(col)) {
				throw new InsightError(`COLUMNS entry "${col}" must appear in GROUP or APPLY`);
			}
		}
	} else {
		for (const col of columns) {
			validateDatasetKey(col, datasetId, cls);
		}
	}
}

