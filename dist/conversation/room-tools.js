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
export const ROOM_TOOLS_METHOD = 'prosodyai.tools';
export const ROOM_TOOL_METHOD_PREFIX = 'prosodyai.tool.';
/** The RPC method the worker performs to run the tool called `name`. */
export function roomToolMethod(name) {
    return `${ROOM_TOOL_METHOD_PREFIX}${name}`;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function roomToolManifest(tools) {
    return { tools: tools.map((tool) => ({ ...tool.definition })) };
}
/** The manifest a participant answered `prosodyai.tools` with. Throws when it is not one. */
export function parseRoomToolManifest(payload) {
    const body = JSON.parse(payload);
    if (!isRecord(body) || !Array.isArray(body.tools)) {
        throw new Error('A tool manifest is an object with a tools array');
    }
    const tools = [];
    for (const entry of body.tools) {
        if (!isRecord(entry) || typeof entry.name !== 'string' || !entry.name) {
            throw new Error('Every tool in a manifest has a name');
        }
        tools.push({
            name: entry.name,
            description: typeof entry.description === 'string' ? entry.description : '',
            parameters: isRecord(entry.parameters) ? entry.parameters : {},
        });
    }
    return { tools };
}
/** The arguments a tool call carried. An empty payload is no arguments. */
export function parseRoomToolArguments(payload) {
    if (!payload.trim())
        return {};
    const body = JSON.parse(payload);
    if (!isRecord(body))
        throw new Error('Tool arguments are a JSON object');
    return body;
}
/** The envelope a tool answered with. Throws when it is neither an output nor an error. */
export function parseRoomToolReply(payload) {
    const body = JSON.parse(payload);
    if (isRecord(body)) {
        if (typeof body.error === 'string')
            return { error: body.error };
        if (typeof body.output === 'string')
            return { output: body.output };
    }
    throw new Error('A tool reply carries an output or an error');
}
function replyJson(reply) {
    return JSON.stringify(reply);
}
function failureText(cause) {
    return cause instanceof Error && cause.message ? cause.message : String(cause);
}
/**
 * Offer `tools` to the agent from this participant: answer `prosodyai.tools`
 * with their manifest and run each one on its own RPC method. Returns the
 * function that withdraws them.
 */
export function registerRoomTools(host, tools) {
    const manifest = JSON.stringify(roomToolManifest(tools));
    host.registerRpcMethod(ROOM_TOOLS_METHOD, async () => manifest);
    for (const tool of tools) {
        host.registerRpcMethod(roomToolMethod(tool.definition.name), async ({ payload }) => {
            let args;
            try {
                args = parseRoomToolArguments(payload);
            }
            catch {
                return replyJson({ error: 'Malformed arguments' });
            }
            try {
                return replyJson({ output: await tool.run(args) });
            }
            catch (cause) {
                return replyJson({ error: failureText(cause) });
            }
        });
    }
    return () => {
        host.unregisterRpcMethod(ROOM_TOOLS_METHOD);
        for (const tool of tools)
            host.unregisterRpcMethod(roomToolMethod(tool.definition.name));
    };
}
