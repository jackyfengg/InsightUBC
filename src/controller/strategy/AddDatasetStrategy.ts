import { Record } from "../types";

export interface AddDatasetStrategy {
	parseDataset(content: string): Promise<Record[]>;
}
