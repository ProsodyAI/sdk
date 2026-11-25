/**
 * Room tools: what a participant on the call lets the agent do, declared and
 * run over LiveKit RPC.
 *
 * The worker asks each participant `prosodyai.tools` and gets the
 * participant's manifest back. The gateway's thinking track decides when a
 * tool runs; the worker then performs `prosodyai.tool.<name>` on the
 * participant that declared it, with the arguments as the payload, and the
 * reply is an envelope: what the agent is told, or why the tool failed. The
 * Python plugin (`room_tools.py`), the website's Talk page and the simulator's
 * caller carry this same contract.
 */
export declare const ROOM_TOOLS_METHOD = "prosodyai.tools";
export declare const ROOM_TOOL_METHOD_PREFIX = "prosodyai.tool.";
/** The RPC method the worker performs to run the tool called `name`. */
export declare function roomToolMethod(name: string): string;
/** One tool a participant offers, as the deciding model sees it. */
export type RoomToolDefinition = {
    name: string;
    description: string;
    /** The arguments' JSON Schema. */
    parameters: Record<string, unknown>;
};
export type RoomToolManifest = {
    tools: RoomToolDefinition[];
};
export type RoomToolArguments = Record<string, unknown>;
/** The reply to a tool call: what the agent is told, or why it failed. */
export type RoomToolReply = {
    output: string;
    error?: never;
} | {
    error: string;
    output?: never;
};
export type RoomToolHandler = (args: RoomToolArguments) => Promise<string> | string;
export interface RoomTool {
    definition: RoomToolDefinition;
    run: RoomToolHandler;
}
/**
 * The RPC surface this module needs from a LiveKit participant. livekit-client's
 * `Room` and `LocalParticipant`, and rtc-node's `LocalParticipant`, all have it.
 */
export interface RoomRpcHost {
    registerRpcMethod(method: string, handler: (data: {
        payload: string;
    }) => Promise<string>): void;
    unregisterRpcMethod(method: string): void;
}
export declare function roomToolManifest(tools: readonly RoomTool[]): RoomToolManifest;
/** The manifest a participant answered `prosodyai.tools` with. Throws when it is not one. */
export declare function parseRoomToolManifest(payload: string): RoomToolManifest;
/** The arguments a tool call carried. An empty payload is no arguments. */
export declare function parseRoomToolArguments(payload: string): RoomToolArguments;
/** The envelope a tool answered with. Throws when it is neither an output nor an error. */
export declare function parseRoomToolReply(payload: string): RoomToolReply;
/**
 * Offer `tools` to the agent from this participant: answer `prosodyai.tools`
 * with their manifest and run each one on its own RPC method. Returns the
 * function that withdraws them.
 */
export declare function registerRoomTools(host: RoomRpcHost, tools: readonly RoomTool[]): () => void;
