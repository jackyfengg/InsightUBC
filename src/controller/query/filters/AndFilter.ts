import { Record } from "../../types";
import { FilterComponent } from "./FilterComponent";

export class AndFilter implements FilterComponent {
	constructor(private children: FilterComponent[]) {}

	public matches(row: Record): boolean {
		return this.children.every((c) => c.matches(row));
	}
}
