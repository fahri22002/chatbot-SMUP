from fastapi import FastAPI
from rag_mcp.client import ask_rag, reload_index

app = FastAPI()


@app.get("/rag")
async def rag_api(q: str):
    """Endpoint untuk nanya ke RAG (via MCP Server)."""
    answer = await ask_rag(q)
    return {"answer": answer}


@app.post("/reload")
async def reload_rag_api():
    """Endpoint untuk me-reload index dokumen RAG."""
    result = await reload_index()
    return {"status": result}
if __name__ == "__main__":
    # Pastikan port sama dengan yang dipanggil di frontend (8080)
    uvicorn.run(app, host="127.0.0.1", port=8080)