import { InsightError } from "./IInsightFacade";

export function validateId(id: string): void {
	if (typeof id !== "string") {
		throw new InsightError("Invalid id: must be a string");
	}
	if (id.includes("_")) {
		throw new InsightError(`Invalid id: contains underscore`);
	}
	if (id.trim().length === 0) {
		throw new InsightError(`Invalid id: only whitespace or empty`);
	}
}

export interface ParsedKey {
	id: string;
	field: string;
}

// Parse a key of the form "<idstring>_<field>". Throws if format invalid.
// Does NOT validate field against any kind-specific set.
export function parseKeyFormat(key: string): ParsedKey {
	if (typeof key !== "string") {
		throw new InsightError("Key must be a string");
	}
	const idx = key.indexOf("_");
	if (idx <= 0) {
		throw new InsightError(`Invalid key format: "${key}"`);
	}
	const id = key.slice(0, idx);
	const field = key.slice(idx + 1);
	if (id.includes("_") || id.trim().length === 0) {
		throw new InsightError(`Invalid idstring in key: "${key}"`);
	}
	if (field.length === 0) {
		throw new InsightError(`Invalid field in key: "${key}"`);
	}
	return { id, field };
}

