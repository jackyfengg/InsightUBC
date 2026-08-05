import Server from "./Server";

const DEFAULT_PORT = 4321;

const portEnv = process.env.PORT;
const port = portEnv !== undefined && portEnv.length > 0 ? Number(portEnv) : DEFAULT_PORT;

const server = new Server(port);
server
	.start()
	.then(() => {
		process.stdout.write(`InsightUBC server listening on port ${port}\n`);
	})
	.catch((err: unknown) => {
		process.stderr.write(`Server failed to start: ${String(err)}\n`);
		process.exit(1);
	});

