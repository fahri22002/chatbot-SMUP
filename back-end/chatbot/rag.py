import os
import numpy as np
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path
import json
import re
from collections import Counter

# --- IMPORT LANGCHAIN ---
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferWindowMemory
from langchain.chains import LLMChain
from langchain.output_parsers import CommaSeparatedListOutputParser

# --- IMPORT NLTK (WORDNET) ---
import nltk
from nltk.corpus import wordnet as wn
from nltk.tokenize import word_tokenize

# Setup NLTK (Download data jika belum ada)
try:
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('tokenizers/punkt_tab') # Cek keberadaan punkt_tab
    nltk.data.find('corpora/wordnet')
    nltk.data.find('corpora/omw-1.4')
except LookupError:
    print("Downloading NLTK data (WordNet & Tokenizers)...")
    nltk.download('punkt')
    nltk.download('punkt_tab') # <--- TAMBAHKAN BARIS INI (PENTING!)
    nltk.download('wordnet')
    nltk.download('omw-1.4') 
    print("NLTK data downloaded.")

# 1. Load environment variables
load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("WARNING: GOOGLE_API_KEY not found in .env")

# Konfigurasi GenAI Native (hanya untuk embedding manual)
genai.configure(api_key=api_key)

# --- GLOBAL VARIABLES ---
INDEXED_DOCS = [] 

# --- LANGCHAIN SETUP ---

# Model Utama
llm = ChatGoogleGenerativeAI(
    model="gemini-flash-latest",
    google_api_key=api_key,
    temperature=0.3,
    timeout=600,
    convert_system_message_to_human=True
)

# A. Setup Memory
memory = ConversationBufferWindowMemory(
    k=5, 
    memory_key="chat_history", 
    input_key="question"
)

# B. Setup Prompt Reranking (LLM Menentukan Similarity)
rerank_template = """
Anda adalah sistem penilai relevansi dokumen.
Diberikan pertanyaan pengguna dan daftar kutipan dokumen, tugas Anda adalah memilih dokumen mana yang paling relevan untuk menjawab pertanyaan tersebut.

PERTANYAAN: {question}

DAFTAR DOKUMEN:
{docs_list}

INSTRUKSI:
1. Analisis relevansi setiap dokumen terhadap pertanyaan.
2. Pilih maksimal 3 ID dokumen yang paling relevan (misal: DOC_1, DOC_3).
3. Urutkan dari yang paling relevan.
4. HANYA kembalikan ID dokumen dipisahkan koma. Contoh: DOC_2, DOC_5, DOC_1
5. Jika tidak ada yang relevan, kembalikan: NONE

OUTPUT ID:
"""
rerank_prompt = PromptTemplate(
    input_variables=["question", "docs_list"],
    template=rerank_template
)
rerank_chain = LLMChain(llm=llm, prompt=rerank_prompt)

# C. Setup Prompt Jawaban Akhir (Format HTML)
qa_template = """
Anda adalah asisten AI untuk Universitas Padjadjaran (Unpad).
Jawablah pertanyaan berdasarkan dokumen terpilih di bawah ini.

KONTEKS DOKUMEN TERPILIH:
{context}

RIWAYAT PERCAKAPAN:
{chat_history}

PERTANYAAN: {question}

⚙️ FORMAT JAWABAN (WAJIB HTML):
- Jawaban HARUS ditulis dalam format HTML yang valid.
- Gunakan tag <p> untuk paragraf.
- Gunakan tag <ul> dan <li> untuk list/poin-poin.
- Gunakan tag <table>, <thead>, <tbody>, <tr>, <th>, <td> dengan atribut border="1" style="border-collapse: collapse; width: 100%;" untuk menyajikan data tabel.
- Gunakan <strong> untuk penekanan teks.
- JANGAN gunakan Markdown (seperti **bold** atau markdown table).
- Jika konteks tidak menjawab, katakan: "Maaf, informasi tidak ditemukan."

JAWABAN (HTML):
"""

qa_prompt = PromptTemplate(
    input_variables=["chat_history", "context", "question"],
    template=qa_template
)
qa_chain = LLMChain(llm=llm, prompt=qa_prompt, memory=memory)


# --- FUNGSI UTILITY ---

# 1. Embedding
def get_embedding(text):
    try:
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text
        )
        return np.array(result["embedding"], dtype=np.float32)
    except Exception as e:
        print(f"Error embedding: {e}")
        return np.zeros(768, dtype=np.float32)

# 2. Cosine Similarity
def cosine_similarity(a, b):
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return np.dot(a, b) / (norm_a * norm_b)

# 3. Load & Index
def load_and_index_documents(folder_path="doc/pages", cache_path="doc/embeddings_cache.json"):
    global INDEXED_DOCS
    print(f"\n--- Memulai Indexing Dokumen dari: {folder_path} ---")

    folder = Path(folder_path)
    if not folder.exists():
        os.makedirs(folder_path, exist_ok=True)
        INDEXED_DOCS = []
        return

    cache = {}
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cache = json.load(f)
        except Exception:
            pass

    new_docs = []
    files = list(folder.glob("*.txt"))
    
    for i, file in enumerate(files):
        try:
            text = file.read_text(encoding="utf-8").strip()
            if not text: continue

            mtime = os.path.getmtime(file)
            key = f"{file.name}:{mtime}"

            if key in cache:
                emb = np.array(cache[key], dtype=np.float32)
            else:
                emb = get_embedding(text)
                cache[key] = emb.tolist()

            # Pre-tokenize text untuk WordNet search agar cepat
            tokens = set(word_tokenize(text.lower()))

            new_docs.append({
                "id": f"DOC_{i}",
                "filename": file.name,
                "text": text,
                "tokens": tokens, # Simpan token set
                "embedding": emb
            })
        except Exception as e:
            print(f"Skip {file.name}: {e}")

    # Simpan cache
    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(cache, f)
    except: pass

    INDEXED_DOCS = new_docs
    print(f"--- Selesai! {len(INDEXED_DOCS)} dokumen terindeks. ---")


# --- RETRIEVAL ENGINE ---

# A. Retrieval via Embedding (Semantic)
def retrieve_by_embedding(question, k=5):
    if not INDEXED_DOCS: return []
    try:
        q_emb = get_embedding(question)
        if np.all(q_emb == 0): return []

        scored = []
        for doc in INDEXED_DOCS:
            score = cosine_similarity(q_emb, doc["embedding"])
            scored.append((score, doc))
        
        scored.sort(reverse=True, key=lambda x: x[0])
        return [doc for score, doc in scored[:k]]
    except:
        return []

# B. Retrieval via WordNet/Keyword (Lexical)
def retrieve_by_wordnet(question, k=5):
    if not INDEXED_DOCS: return []
    
    # 1. Tokenisasi Pertanyaan
    q_tokens = word_tokenize(question.lower())
    
    # 2. Perluas Keyword dengan WordNet (Bahasa Indonesia)
    expanded_keywords = set(q_tokens)
    for token in q_tokens:
        # Ambil synsets bahasa indonesia
        synsets = wn.synsets(token, lang='ind')
        for syn in synsets:
            for lemma in syn.lemmas(lang='ind'):
                expanded_keywords.add(lemma.name().lower().replace('_', ' '))
    
    # print(f"DEBUG: Expanded Keywords via WordNet: {expanded_keywords}")

    # 3. Scoring Dokumen (Hitung overlap kata)
    scored = []
    for doc in INDEXED_DOCS:
        # Hitung irisan antara token dokumen dan keyword query
        doc_tokens = doc["tokens"]
        match_count = len(doc_tokens.intersection(expanded_keywords))
        
        if match_count > 0:
            scored.append((match_count, doc))
    
    # 4. Sortir berdasarkan jumlah match
    scored.sort(reverse=True, key=lambda x: x[0])
    return [doc for score, doc in scored[:k]]


# --- MAIN RAG LOGIC ---

def mainrag(question):
    global INDEXED_DOCS
    if not INDEXED_DOCS:
        load_and_index_documents()

    print(f"\nProcessing: {question}")

    # 1. HYBRID RETRIEVAL (Embedding + WordNet)
    # Ambil 5 dari embedding, 5 dari wordnet
    docs_emb = retrieve_by_embedding(question, k=5)
    docs_wn = retrieve_by_wordnet(question, k=5)

    # Gabungkan dan hapus duplikat
    combined_docs = {d['id']: d for d in (docs_emb + docs_wn)}.values()
    
    if not combined_docs:
        return "<p>Maaf, tidak ditemukan informasi yang relevan.</p>"

    # 2. LLM RERANKING (LLM Nentuin Similarity)
    # Siapkan string untuk prompt reranking
    docs_str = "\n".join([f"ID: {d['id']}\nCuplikan: {d['text'][:300]}...\n" for d in combined_docs])
    
    try:
        print("--- Melakukan Reranking via LLM ---")
        rerank_res = rerank_chain.invoke({
            "question": question,
            "docs_list": docs_str
        })
        
        # Parse output ID dari LLM (contoh: "DOC_1, DOC_5")
        relevant_ids = [x.strip() for x in rerank_res['text'].split(',')]
        
        # Filter dokumen berdasarkan ID yang dipilih LLM
        final_docs = [d for d in combined_docs if d['id'] in relevant_ids]
        
        # Fallback: Jika LLM salah format atau jawab NONE, pakai Top-3 Embedding
        if not final_docs:
            print("Fallback: Reranking tidak menemukan hasil, menggunakan Top Embedding.")
            final_docs = docs_emb[:3]
        else:
            print(f"LLM Memilih Dokumen: {[d['filename'] for d in final_docs]}")

    except Exception as e:
        print(f"Reranking Error: {e}")
        final_docs = docs_emb[:3]

    # 3. GENERATE ANSWER (Format HTML)
    context_text = "\n\n".join([f"Sumber: {d['filename']}\nIsi: {d['text']}" for d in final_docs])

    try:
        response = qa_chain.invoke({
            "question": question,
            "context": context_text
        })
        return response['text']

    except Exception as e:
        return f"<p>Error generation: {str(e)}</p>"


def reload_rag():
    load_and_index_documents()
    memory.clear()