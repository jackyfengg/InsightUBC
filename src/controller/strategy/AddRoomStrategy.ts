import { Record } from "../types";
import { parseRoomsFromZip } from "../rooms/parseRooms";
import { AddDatasetStrategy } from "./AddDatasetStrategy";

export class AddRoomStrategy implements AddDatasetStrategy {
	public async parseDataset(content: string): Promise<Record[]> {
		return parseRoomsFromZip(content);
	}
}
