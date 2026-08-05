import { Record } from "../../types";
import { FilterComponent } from "./FilterComponent";

export class IsFilter implements FilterComponent {
	private readonly lead: boolean;
	private readonly trail: boolean;
	private readonly core: string;

	constructor(
		private field: string,
		pattern: string
	) {
		this.lead = pattern.startsWith("*");
		this.trail = pattern.endsWith("*");
		let core = pattern;
		if (this.lead) core = core.slice(1);
		if (this.trail) core = core.slice(0, -1);
		this.core = core;
	}

	public matches(row: Record): boolean {
		const v = row[this.field];
		if (!this.lead && !this.trail) return v === this.core;
		if (typeof v !== "string") return false;
		if (this.lead && this.trail) return v.includes(this.core);
		if (this.trail) return v.startsWith(this.core);
		return v.endsWith(this.core);
	}
}
