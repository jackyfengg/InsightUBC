import { InsightError } from "../IInsightFacade";
import { datasetIdOfKey, KeyClassification, validateDatasetKey } from "./validateShared";

export function extractDatasetIdFromFilterStructure(filter: { [k: string]: unknown }): string | null {
	const keys = Object.keys(filter);
	if (keys.length !== 1) {
		throw new InsightError(`Filter must have exactly one key, got: ${keys.join(", ")}`);
	}
	const op = keys[0];
	if (op === "AND" || op === "OR") return idFromLogical(op, filter[op]);
	if (op === "NOT") return idFromNot(filter[op]);
	if (op === "LT" || op === "GT" || op === "EQ" || op === "IS") return idFromComparator(op, filter[op]);
	throw new InsightError(`Unknown filter operator: "${op}"`);
}

function idFromLogical(op: "AND" | "OR", list: unknown): string | null {
	if (!Array.isArray(list) || list.length === 0) {
		throw new InsightError(`${op} must have a non-empty array`);
	}
	let id: string | null = null;
	for (const item of list) {
		if (typeof item !== "object" || item === null || Array.isArray(item)) {
			throw new InsightError(`${op} list items must be filter objects`);
		}
		const sub = extractDatasetIdFromFilterStructure(item as { [k: string]: unknown });
		if (id === null) id = sub;
		else if (sub !== null && sub !== id) throw new InsightError("Query references multiple datasets");
	}
	return id;
}

function idFromNot(inner: unknown): string | null {
	if (typeof inner !== "object" || inner === null || Array.isArray(inner)) {
		throw new InsightError("NOT must contain a filter object");
	}
	return extractDatasetIdFromFilterStructure(inner as { [k: string]: unknown });
}

function idFromComparator(op: string, inner: unknown): string | null {
	if (typeof inner !== "object" || inner === null || Array.isArray(inner)) {
		throw new InsightError(`${op} must be an object`);
	}
	const innerObj = inner as { [k: string]: unknown };
	const innerKeys = Object.keys(innerObj);
	if (innerKeys.length !== 1) throw new InsightError(`${op} must have exactly one key`);
	return datasetIdOfKey(innerKeys[0]);
}

export function validateFilter(filter: { [k: string]: unknown }, datasetId: string, cls: KeyClassification): void {
	const keys = Object.keys(filter);
	if (keys.length !== 1) throw new InsightError(`Filter must have exactly one key`);
	const op = keys[0];
	if (op === "AND" || op === "OR") return validateLogical(op, filter[op], datasetId, cls);
	if (op === "NOT") return validateNot(filter[op], datasetId, cls);
	if (op === "LT" || op === "GT" || op === "EQ") return validateMComparator(op, filter[op], datasetId, cls);
	if (op === "IS") return validateIs(filter[op], datasetId, cls);
	throw new InsightError(`Unknown filter operator: "${op}"`);
}

function validateLogical(op: "AND" | "OR", list: unknown, datasetId: string, cls: KeyClassification): void {
	if (!Array.isArray(list) || list.length === 0) throw new InsightError(`${op} must have a non-empty array`);
	for (const item of list) {
		if (typeof item !== "object" || item === null || Array.isArray(item)) {
			throw new InsightError(`${op} list items must be filter objects`);
		}
		validateFilter(item as { [k: string]: unknown }, datasetId, cls);
	}
}

function validateNot(inner: unknown, datasetId: string, cls: KeyClassification): void {
	if (typeof inner !== "object" || inner === null || Array.isArray(inner)) {
		throw new InsightError("NOT must contain a filter object");
	}
	const innerObj = inner as { [k: string]: unknown };
	if (Object.keys(innerObj).length === 0) throw new InsightError("NOT must contain a filter");
	validateFilter(innerObj, datasetId, cls);
}

function validateMComparator(op: "LT" | "GT" | "EQ", inner: unknown, datasetId: string, cls: KeyClassification): void {
	if (typeof inner !== "object" || inner === null || Array.isArray(inner)) {
		throw new InsightError(`${op} must be an object`);
	}
	const innerObj = inner as { [k: string]: unknown };
	const innerKeys = Object.keys(innerObj);
	if (innerKeys.length !== 1) throw new InsightError(`${op} must have exactly one key`);
	const key = innerKeys[0];
	const val = innerObj[key];
	if (typeof val !== "number") throw new InsightError(`${op} value must be a number`);
	const { isM } = validateDatasetKey(key, datasetId, cls);
	if (!isM) throw new InsightError(`${op} requires an mfield key`);
}

function validateIs(inner: unknown, datasetId: string, cls: KeyClassification): void {
	if (typeof inner !== "object" || inner === null || Array.isArray(inner)) {
		throw new InsightError("IS must be an object");
	}
	const innerObj = inner as { [k: string]: unknown };
	const innerKeys = Object.keys(innerObj);
	if (innerKeys.length !== 1) throw new InsightError("IS must have exactly one key");
	const key = innerKeys[0];
	const val = innerObj[key];
	if (typeof val !== "string") throw new InsightError("IS value must be a string");
	validateWildcard(val);
	const { isM } = validateDatasetKey(key, datasetId, cls);
	if (isM) throw new InsightError("IS requires an sfield key");
}

function validateWildcard(val: string): void {
	const stripped = val.replace(/^\*/, "").replace(/\*$/, "");
	if (stripped.includes("*")) {
		throw new InsightError(`Asterisk "*" not allowed in the middle of IS string`);
	}
}

