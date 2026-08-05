import { Record } from "../../types";

export interface FilterComponent {
	matches(row: Record): boolean;
}
