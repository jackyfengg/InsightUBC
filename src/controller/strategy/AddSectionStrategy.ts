import { Record } from "../types";
import { AddDatasetStrategy } from "./AddDatasetStrategy";
import { parseSectionsFromZip } from "../sections/parseSections";

export class AddSectionStrategy implements AddDatasetStrategy {
	public async parseDataset(content: string): Promise<Record[]> {
		return parseSectionsFromZip(content);
	}
}
