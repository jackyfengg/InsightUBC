import { Record } from "../../types";
import { FilterComponent } from "./FilterComponent";

export class EqFilter implements FilterComponent {
	constructor(
		private field: string,
		private threshold: number
	) {}

	public matches(row: Record): boolean {
		return (row[this.field] as number) === this.threshold;
	}
}
