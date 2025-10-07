from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import scrapping as sc
import rag

app = FastAPI()

# Variabel global
temp = 0

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    global temp
    temp += 1
    return {"Hello": "World", "Temp": temp}

@app.get("/do-scrapping")
def do_scrapping():
    sc.mainscrapping()
    return {"Status": "Succeed", "Work": "Scrapping", "Temp": temp}

@app.get("/do-rag")
def do_scrapping():
    rag.mainrag()
    return {"Status": "Succeed", "Work": "RAG", "Temp": temp}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8080)
