import { parseKeyFormat } from "../../validation";
import { FilterComponent } from "./FilterComponent";
import { AndFilter } from "./AndFilter";
import { OrFilter } from "./OrFilter";
import { NotFilter } from "./NotFilter";
import { GtFilter } from "./GtFilter";
import { LtFilter } from "./LtFilter";
import { EqFilter } from "./EqFilter";
import { IsFilter } from "./IsFilter";

export function buildFilterTree(filter: { [k: string]: unknown }): FilterComponent {
	const op = Object.keys(filter)[0];

	if (op === "AND") return new AndFilter((filter.AND as { [k: string]: unknown }[]).map(buildFilterTree));
	if (op === "OR") return new OrFilter((filter.OR as { [k: string]: unknown }[]).map(buildFilterTree));
	if (op === "NOT") return new NotFilter(buildFilterTree(filter.NOT as { [k: string]: unknown }));

	if (op === "GT" || op === "LT" || op === "EQ") {
		const inner = filter[op] as { [k: string]: unknown };
		const key = Object.keys(inner)[0];
		const field = parseKeyFormat(key).field;
		const threshold = inner[key] as number;
		if (op === "GT") return new GtFilter(field, threshold);
		if (op === "LT") return new LtFilter(field, threshold);
		return new EqFilter(field, threshold);
	}

	if (op === "IS") {
		const inner = filter[op] as { [k: string]: unknown };
		const key = Object.keys(inner)[0];
		const field = parseKeyFormat(key).field;
		return new IsFilter(field, inner[key] as string);
	}

	throw new Error(`Unknown filter operator: ${op}`);
}
