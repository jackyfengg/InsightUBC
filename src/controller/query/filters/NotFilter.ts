import { Record } from "../../types";
import { FilterComponent } from "./FilterComponent";

export class NotFilter implements FilterComponent {
	constructor(private child: FilterComponent) {}

	public matches(row: Record): boolean {
		return !this.child.matches(row);
	}
}
