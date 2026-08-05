import { Record } from "../../types";
import { FilterComponent } from "./FilterComponent";

export class OrFilter implements FilterComponent {
	constructor(private children: FilterComponent[]) {}

	public matches(row: Record): boolean {
		return this.children.some((c) => c.matches(row));
	}
}
