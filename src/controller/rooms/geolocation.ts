import * as http from "http";

export interface GeoResponse {
	lat?: number;
	lon?: number;
	error?: string;
}

const TEAM_NUMBER = "039";
const HOST = "cs310.students.cs.ubc.ca";
const PORT = 11316;
const PATH_PREFIX = `/api/v1/project_team${TEAM_NUMBER}/`;
const REQUEST_TIMEOUT_MS = 5000;
const HTTP_OK_MIN = 200;
const HTTP_OK_MAX_EXCLUSIVE = 300;

export async function fetchGeolocation(address: string): Promise<GeoResponse> {
	const url = `http://${HOST}:${PORT}${PATH_PREFIX}${encodeURIComponent(address)}`;
	return new Promise<GeoResponse>((resolve) => {
		const req = http.get(url, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
			let data = "";
			res.setEncoding("utf-8");
			res.on("data", (chunk: string) => {
				data += chunk;
			});
			res.on("end", () => {
				const status = res.statusCode;
				if (status !== undefined && (status < HTTP_OK_MIN || status >= HTTP_OK_MAX_EXCLUSIVE)) {
					resolve({ error: `HTTP ${status}` });
					return;
				}
				try {
					const parsed = JSON.parse(data);
					resolve(parsed as GeoResponse);
				} catch {
					resolve({ error: "Invalid JSON response from geolocation service" });
				}
			});
		});
		req.on("timeout", () => {
			req.destroy();
			resolve({ error: "Geolocation request timed out" });
		});
		req.on("error", (err) => {
			resolve({ error: err.message });
		});
	});
}

export class GeolocationCache {
	private readonly cache = new Map<string, Promise<GeoResponse>>();

	public async get(address: string): Promise<GeoResponse> {
		if (!this.cache.has(address)) {
			this.cache.set(address, fetchGeolocation(address));
		}
		return this.cache.get(address)!;
	}
}

