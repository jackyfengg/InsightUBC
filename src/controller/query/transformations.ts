import Decimal from "decimal.js";
import { Record } from "../types";
import { ApplyRule, Transformations } from "./validateQuery";

export function applyTransformations(rows: Record[], t: Transformations): Record[] {
	const groups = new Map<string, Record[]>();
	for (const row of rows) {
		const keyParts: string[] = [];
		for (const f of t.groupFields) {
			const v = row[f];
			keyParts.push(typeof v === "number" ? `n:${v}` : `s:${String(v)}`);
		}
		const k = keyParts.join("\u0000");
		const bucket = groups.get(k);
		if (bucket === undefined) groups.set(k, [row]);
		else bucket.push(row);
	}

	const out: Record[] = [];
	for (const bucket of groups.values()) {
		const aggregate: Record = {};
		// Carry the GROUP fields from the first row (all rows in a bucket share these by construction)
		const head = bucket[0];
		for (let i = 0; i < t.groupKeys.length; i++) {
			const rawKey = t.groupKeys[i];
			const field = t.groupFields[i];
			aggregate[rawKey] = head[field];
		}
		for (const rule of t.apply) {
			aggregate[rule.applykey] = computeApply(rule, bucket);
		}
		out.push(aggregate);
	}
	return out;
}

function computeApply(rule: ApplyRule, bucket: Record[]): string | number {
	const field = rule.field;
	switch (rule.token) {
		case "MAX":
			return computeMax(bucket, field);
		case "MIN":
			return computeMin(bucket, field);
		case "AVG":
			return computeAvg(bucket, field);
		case "SUM":
			return computeSum(bucket, field);
		case "COUNT":
			return computeCount(bucket, field);
	}
}

function computeMax(bucket: Record[], field: string): number {
	let max = -Infinity;
	for (const r of bucket) {
		const v = r[field] as number;
		if (v > max) max = v;
	}
	return max;
}

function computeMin(bucket: Record[], field: string): number {
	let min = Infinity;
	for (const r of bucket) {
		const v = r[field] as number;
		if (v < min) min = v;
	}
	return min;
}

function computeAvg(bucket: Record[], field: string): number {
	let total = new Decimal(0);
	for (const r of bucket) {
		total = total.add(new Decimal(r[field] as number));
	}
	const avg = total.toNumber() / bucket.length;
	return Number(avg.toFixed(2));
}

function computeSum(bucket: Record[], field: string): number {
	let sum = 0;
	for (const r of bucket) sum += r[field] as number;
	return Number(sum.toFixed(2));
}

function computeCount(bucket: Record[], field: string): number {
	const seen = new Set<string | number>();
	for (const r of bucket) seen.add(r[field] as string | number);
	return seen.size;
}

