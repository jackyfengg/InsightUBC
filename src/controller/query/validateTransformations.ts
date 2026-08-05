import { InsightError } from "../IInsightFacade";
import { KeyClassification, validateDatasetKey } from "./validateShared";

export type ApplyToken = "MAX" | "MIN" | "AVG" | "SUM" | "COUNT";

export interface ApplyRule {
	applykey: string;
	token: ApplyToken;
	field: string;
	rawKey: string;
}

export interface Transformations {
	groupKeys: string[];
	groupFields: string[];
	apply: ApplyRule[];
}

export interface SortSpec {
	dir: "UP" | "DOWN";
	keys: string[];
}

const APPLY_TOKENS = new Set<string>(["MAX", "MIN", "AVG", "SUM", "COUNT"]);

export function validateOrder(orderRaw: unknown, columns: string[]): SortSpec {
	if (typeof orderRaw === "string") {
		if (!columns.includes(orderRaw)) {
			throw new InsightError("ORDER key must be in COLUMNS");
		}
		return { dir: "UP", keys: [orderRaw] };
	}
	if (typeof orderRaw === "object" && orderRaw !== null && !Array.isArray(orderRaw)) {
		return validateOrderObject(orderRaw as { [k: string]: unknown }, columns);
	}
	throw new InsightError("ORDER must be a string or object");
}

function validateOrderObject(o: { [k: string]: unknown }, columns: string[]): SortSpec {
	for (const k of Object.keys(o)) {
		if (k !== "dir" && k !== "keys") throw new InsightError(`Unexpected key in ORDER: ${k}`);
	}
	if (!Object.hasOwn(o, "dir")) throw new InsightError("ORDER object must have dir");
	if (!Object.hasOwn(o, "keys")) throw new InsightError("ORDER object must have keys");
	const dir = o.dir;
	if (dir !== "UP" && dir !== "DOWN") throw new InsightError("ORDER dir must be UP or DOWN");
	const keys = o.keys;
	if (!Array.isArray(keys) || keys.length === 0) {
		throw new InsightError("ORDER keys must be a non-empty array");
	}
	for (const k of keys) {
		if (typeof k !== "string") throw new InsightError("ORDER keys entries must be strings");
		if (!columns.includes(k)) throw new InsightError(`ORDER key "${k}" must be in COLUMNS`);
	}
	return { dir, keys: keys as string[] };
}

export function validateTransformations(
	t: { [k: string]: unknown },
	datasetId: string,
	cls: KeyClassification
): Transformations {
	const { groupKeys, groupFields } = validateGroup(t.GROUP, datasetId, cls);
	const apply = validateApply(t.APPLY, datasetId, cls);
	return { groupKeys, groupFields, apply };
}

function validateGroup(
	groupRaw: unknown,
	datasetId: string,
	cls: KeyClassification
): { groupKeys: string[]; groupFields: string[] } {
	const groupKeys: string[] = [];
	const groupFields: string[] = [];
	for (const k of groupRaw as unknown[]) {
		const key = k as string;
		const { field } = validateDatasetKey(key, datasetId, cls);
		groupKeys.push(key);
		groupFields.push(field);
	}
	return { groupKeys, groupFields };
}

function validateApply(applyRaw: unknown, datasetId: string, cls: KeyClassification): ApplyRule[] {
	if (!Array.isArray(applyRaw)) throw new InsightError("APPLY must be an array");
	const seen = new Set<string>();
	const applyRules: ApplyRule[] = [];
	for (const ruleRaw of applyRaw) {
		applyRules.push(validateApplyRule(ruleRaw, datasetId, cls, seen));
	}
	return applyRules;
}

function validateApplyRule(ruleRaw: unknown, datasetId: string, cls: KeyClassification, seen: Set<string>): ApplyRule {
	if (typeof ruleRaw !== "object" || ruleRaw === null || Array.isArray(ruleRaw)) {
		throw new InsightError("APPLY entries must be objects");
	}
	const rule = ruleRaw as { [k: string]: unknown };
	const ruleKeys = Object.keys(rule);
	if (ruleKeys.length !== 1) throw new InsightError("APPLY rule must have exactly one applykey");
	const applykey = ruleKeys[0];
	if (applykey.includes("_") || applykey.trim().length === 0) {
		throw new InsightError(`Invalid applykey: "${applykey}"`);
	}
	if (seen.has(applykey)) throw new InsightError(`Duplicate applykey: "${applykey}"`);
	seen.add(applykey);
	return parseApplyBody(applykey, rule[applykey], datasetId, cls);
}

function parseApplyBody(applykey: string, inner: unknown, datasetId: string, cls: KeyClassification): ApplyRule {
	if (typeof inner !== "object" || inner === null || Array.isArray(inner)) {
		throw new InsightError("APPLY rule body must be an object");
	}
	const innerObj = inner as { [k: string]: unknown };
	const innerKeys = Object.keys(innerObj);
	if (innerKeys.length !== 1) throw new InsightError("APPLY rule must have exactly one APPLYTOKEN");
	const token = innerKeys[0];
	if (!APPLY_TOKENS.has(token)) throw new InsightError(`Invalid APPLYTOKEN: "${token}"`);
	const target = innerObj[token];
	if (typeof target !== "string") throw new InsightError("APPLY target key must be a string");
	const { field, isM } = validateDatasetKey(target, datasetId, cls);
	if (token !== "COUNT" && !isM) {
		throw new InsightError(`APPLYTOKEN ${token} requires a numeric (mfield) key, got "${target}"`);
	}
	return { applykey, token: token as ApplyToken, field, rawKey: target };
}
