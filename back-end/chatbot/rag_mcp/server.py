from mcp import Server
from mcp.types import Tool, TextCompletionRequest
from rag_core import run_rag, load_and_index_documents
import asyncio

server = Server("rag-mcp")

# === Tool: Generate Jawaban RAG ===
@server.tool()
async def rag_answer(question: str) -> str:
    """Jawab pertanyaan menggunakan RAG Unpad."""
    return run_rag(question)

# === Tool: Reload RAG Index ===
@server.tool()
async def reload_rag() -> str:
    load_and_index_documents()
    return "Index RAG berhasil diperbarui."

# === Startup load ===
@server.on_startup
async def startup():
    load_and_index_documents()
    print("RAG MCP Server siap.")

if __name__ == "__main__":
    asyncio.run(server.run_stdio())
