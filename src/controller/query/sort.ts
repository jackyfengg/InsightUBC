import { Record } from "../types";
import { SortSpec } from "./validateQuery";

export function applySort(rows: Record[], sort: SortSpec): void {
	const { dir, keys } = sort;
	const sign = dir === "UP" ? 1 : -1;
	rows.sort((a, b) => {
		for (const key of keys) {
			const va = a[key];
			const vb = b[key];
			if (va < vb) return -1 * sign;
			if (va > vb) return 1 * sign;
		}
		return 0;
	});
}

