import { AddRoomStrategy } from "./AddRoomStrategy";
import { AddSectionStrategy } from "./AddSectionStrategy";
import { AddDatasetStrategy } from "./AddDatasetStrategy";
import { InsightDatasetKind, InsightError } from "../IInsightFacade";

export class AddDatasetFactory {
	public createDatasetStrategy(kind: InsightDatasetKind): AddDatasetStrategy {
		if (kind == InsightDatasetKind.Sections) return new AddSectionStrategy();
		else if (kind == InsightDatasetKind.Rooms) return new AddRoomStrategy();
		else throw new InsightError(`Unsupported dataset kind: ${kind}`);
	}
}
