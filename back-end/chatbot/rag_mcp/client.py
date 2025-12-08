import asyncio
from mcp.client import MCPClient

# MCP Client global (biar tidak buat proses baru berulang kali)
mcp_client: MCPClient | None = None


async def init_mcp():
    global mcp_client

    if mcp_client:
        return mcp_client

    # Jalankan MCP Server sebagai subprocess
    mcp_client = MCPClient(
        command="python",
        args=["rag_mcp/server.py"]  # Lokasi MCP Server Anda
    )

    await mcp_client.start()
    print("MCP Client: berhasil konek ke MCP Server")
    return mcp_client


async def ask_rag(question: str) -> str:
    """Memanggil tool rag_answer dari MCP."""
    client = await init_mcp()
    response = await client.call_tool("rag_answer", {"question": question})
    return response.result


async def reload_index():
    """Memanggil tool reload_rag dari MCP."""
    client = await init_mcp()
    response = await client.call_tool("reload_rag", {})
    return response.result
