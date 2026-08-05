import { InsightDatasetKind, InsightError } from "../IInsightFacade";
import { mfieldsFor, sfieldsFor } from "../types";
import { parseKeyFormat } from "../validation";

export interface KeyClassification {
	mfields: Set<string>;
	sfields: Set<string>;
}

export function classify(kind: InsightDatasetKind): KeyClassification {
	return { mfields: mfieldsFor(kind), sfields: sfieldsFor(kind) };
}

export function validateDatasetKey(
	key: string,
	datasetId: string,
	cls: KeyClassification
): { field: string; isM: boolean } {
	const parsed = parseKeyFormat(key);
	if (parsed.id !== datasetId) {
		throw new InsightError(`Key "${key}" references dataset other than "${datasetId}"`);
	}
	if (cls.mfields.has(parsed.field)) return { field: parsed.field, isM: true };
	if (cls.sfields.has(parsed.field)) return { field: parsed.field, isM: false };
	throw new InsightError(`Invalid field "${parsed.field}" in key "${key}"`);
}

export function datasetIdOfKey(key: string): string {
	return parseKeyFormat(key).id;
}

