const {
    createClient,
    HTTPClientTransport
} = require("@modelcontextprotocol/sdk");

let client = null;

async function initMCP() {
    if (client) return client;

    // MCP server Anda harus expose HTTP endpoint, misal port 8000
    const transport = new HTTPClientTransport({
        url: "http://localhost:8000/"
    });

    client = createClient({
        name: "node-mcp-client",
        version: "1.0.0",
        capabilities: {},
        transport,
    });

    await client.connect();
    console.log("MCP Client connected (v1.18)");

    return client;
}

async function callTool(name, params) {
    const c = await initMCP();

    // v1.18: pemanggilan tool -> call()
    const response = await c.call(name, params);
    return response;
}

module.exports = {
    initMCP,
    callTool
};
