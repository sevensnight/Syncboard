import Peer, { DataConnection, PeerOptions } from "peerjs";
import { TranslateCode, code } from "./code";
import Config from "../config";

const peerOptions: PeerOptions = {
	// @ts-ignore
	debug: Config.PEER_DEBUG_LEVEL ?? 0,
};

if (typeof Config.PEER_SECURE === "boolean") {
	// @ts-ignore
	peerOptions.secure = Config.PEER_SECURE;
}

if (typeof Config.PEER_SERVER_PORT === "number") {
	// @ts-ignore
	peerOptions.port = Config.PEER_SERVER_PORT;
}

if (typeof Config.PEER_SERVER_HOST === "string" && Config.PEER_SERVER_HOST.trim().length > 0) {
	// @ts-ignore
	peerOptions.host = Config.PEER_SERVER_HOST.trim();
}


export function io(uri: string): Promise<Socket> {
	return new Promise((resolve, reject) => {
		const peer = new Peer(peerOptions);
		let settled = false;
		let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

		const cleanup = () => {
			if (timeoutHandle !== undefined) {
				clearTimeout(timeoutHandle);
				timeoutHandle = undefined;
			}
		};

		const rejectOnce = (error: unknown) => {
			if (settled) {
				return;
			}

			settled = true;
			cleanup();
			try {
				peer.destroy();
			} catch {
			}

			reject(error instanceof Error ? error : new Error(String(error)));
		};

		const resolveOnce = (socket: Socket) => {
			if (settled) {
				return;
			}

			settled = true;
			cleanup();
			resolve(socket);
		};

		timeoutHandle = setTimeout(() => {
			rejectOnce(new Error("the server took too long to respond"));
		}, 5000);

		peer.on("open", (id) => {
			const dataConnection = peer.connect(uri, { reliable: true });

			dataConnection.on("open", () => {
				const sock = new Socket(dataConnection);
				sock.id = id;
				resolveOnce(sock);
			});
			dataConnection.on("error", (error) => {
				rejectOnce(error instanceof Error ? error : new Error(String(error)));
			});
		});

		peer.on("error", (error) => {
			rejectOnce(error);
		});
	});
}

// class For Server
export class Socket {
	private client: DataConnection;
	public events: Map<string, (args: any) => void>;
	private pendingMessages: Array<{ event: string; args: any }>;
	public id: string;
	constructor(_socket: DataConnection) {
		this.id = "";
		this.client = _socket;
		this.events = new Map();
		this.pendingMessages = [];

		this.client.on("data", (data) => {
			try {
				const d = JSON.parse(data as string) as {
					event: string;
					args: any;
				};
				const xhandler = this.events.get(d.event);
				if (xhandler !== undefined) {
					xhandler(d.args);
					return;
				}

				this.pendingMessages.push({ event: d.event, args: d.args });
			} catch {}
		});

		this.client.on("error", (error) => {
			console.error("Data connection error:", error);
		});
		this.client.on("close", () => {
			try {
				const xhandler = this.events.get("disconnect");
				if (xhandler !== undefined) {
					xhandler("");
					return;
				}

				this.pendingMessages.push({ event: "disconnect", args: "" });
			} catch {}
		});
	}
	public on(event_name: string | "disconnect", handler: (args: any) => void) {
		this.events.set(event_name, handler);

		if (this.pendingMessages.length === 0) {
			return;
		}

		const remainingMessages: Array<{ event: string; args: any }> = [];
		for (const message of this.pendingMessages) {
			if (message.event === event_name) {
				handler(message.args);
				continue;
			}

			remainingMessages.push(message);
		}
		this.pendingMessages = remainingMessages;
	}
	public emit(event_name: string, args?: any) {
		this.client.send(
			JSON.stringify({ event: event_name, args: args ?? undefined })
		);
	}
	public disconnect() {
		this.emit("disconnect");
		this.client.close();
	}
}

export class Server {
	private socket: Peer;
	public logFunction: (...data: any[]) => void;
	public renderFunction: (v: Array<any[]>) => void;
	public logs: Array<any[]> = [];
	public code: string;
	constructor(
		idf?: (thisobj: Server) => void,
		onf?: (s: Socket, server: Server) => void,
		preferredCode?: string,
		onError?: (error: unknown) => void
	) {
		var error = true;

		var _code: string = "";
		var _socket: Peer;

		while (error) {
			try {
				_code = preferredCode ?? code();
				_socket = new Peer(TranslateCode(_code), peerOptions);
				error = false;
			} catch (e) {
				if (preferredCode !== undefined) {
					throw e;
				}
				error = true;
			}
		}
		this.code = _code;
		// @ts-ignore
		this.socket = _socket;
		this.logFunction = (...data) => {
			this.logs.push(data);
			this.renderFunction(this.logs);
		};
		this.renderFunction = () => {};
		this.socket.on("open", async () => {
			idf?.(this);
		});

		this.socket.on("error", (error) => {
			onError?.(error);
		});

		this.socket.on("connection", (dataConnection) => {
			dataConnection.on("open", () => {
				const socket = new Socket(dataConnection);
				socket.id = dataConnection.peer;
				onf?.(socket, this);
			});
		});
	}
	public set OnLogs(v: (...data: any[]) => void) {
		this.logFunction = v;
	}

	public RenderLogs(f: (v: Array<any[]>) => void) {
		this.renderFunction = f;
		f(this.logs);
	}
	public stop() {
		this.socket.destroy();
	}
}
