# # rag.py
# import os
# import google.generativeai as genai
# from dotenv import load_dotenv
# import time # <-- TAMBAHKAN IMPORT INI

# from langchain_community.document_loaders import DirectoryLoader, TextLoader
# from langchain_community.vectorstores import Chroma
# from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
# from langchain.text_splitter import RecursiveCharacterTextSplitter
# from langchain.prompts import PromptTemplate
# from langchain.chains import LLMChain

# # --- Konfigurasi Global ---

# load_dotenv()
# genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# DATA_PATH = "doc/pages"
# VECTOR_STORE_PATH = "vector_store"

# try:
#     embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
# except Exception as e:
#     print(f"Error inisialisasi Embeddings: {e}")
#     embeddings = None

# # --- Fungsi 1: Membangun Vector Store (dipanggil oleh /do-rag) ---

# def mainrag():
#     """
#     Fungsi ini dipanggil oleh admin (/do-rag) untuk membangun atau 
#     memperbarui vector store setelah scrapping.
#     """
#     if embeddings is None:
#         print("Embeddings gagal dimuat. Periksa API Key.")
#         return 0
        
#     print("Memulai proses RAG (Indexing)...")
    
#     # 1. Tentukan argumen untuk TextLoader, yaitu encoding='utf-8'
#     loader_kwargs = {'encoding': 'utf-8'}
    
#     print(f"Memuat dokumen dari: {DATA_PATH}")
#     loader = DirectoryLoader(
#         DATA_PATH, 
#         glob="*.txt", 
#         loader_cls=TextLoader, 
#         loader_kwargs=loader_kwargs
#     )
#     documents = loader.load()
    
#     if not documents:
#         print("Peringatan: Tidak ada dokumen yang ditemukan. Pastikan /do-scrapping sudah dijalankan.")
#         return 0

#     # 2. Pecah dokumen menjadi bagian-bagian kecil (chunks)
#     print(f"Memecah {len(documents)} dokumen menjadi chunks...")
#     text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
#     texts = text_splitter.split_documents(documents)

#     if not texts:
#         print("Peringatan: Dokumen ada, tapi gagal di-split menjadi chunks.")
#         return 0

#     # --- MODIFIKASI UTAMA DIMULAI DI SINI ---
    
#     print(f"Akan memproses {len(texts)} chunks ke vector store.")

#     # 3. Buat objek vector store KOSONG terlebih dahulu
#     vector_store = Chroma(
#         persist_directory=VECTOR_STORE_PATH, 
#         embedding_function=embeddings
#     )

#     # 4. Tentukan ukuran batch (misal: 50 chunks per request)
#     batch_size = 50
#     total_batches = (len(texts) // batch_size) + 1
    
#     print(f"Memulai pembuatan embeddings dalam {total_batches} batch...")

#     # 5. Loop melalui teks dalam batch
#     for i in range(0, len(texts), batch_size):
#         batch = texts[i:i+batch_size]
        
#         # Cek jika batch kosong
#         if not batch:
#             continue
            
#         current_batch_num = (i // batch_size) + 1
#         print(f"  - Memproses batch {current_batch_num} / {total_batches} ({len(batch)} chunks)...")
        
#         try:
#             # Tambahkan dokumen batch ini ke vector store
#             vector_store.add_documents(documents=batch)
            
#             # 6. WAJIB: Beri jeda 1 detik untuk menghindari rate limit API
#             print("  - Jeda 1 detik untuk rate limit...")
#             time.sleep(1)
            
#         except Exception as e:
#             print(f"    !! GAGAL PADA BATCH {current_batch_num}: {e}")
#             print("    !! Melanjutkan ke batch berikutnya...")
#             time.sleep(1) # Beri jeda lebih lama jika terjadi error
#             continue

#     # --- MODIFIKASI UTAMA SELESAI ---

#     print("Vector store berhasil dibuat/diperbarui.")
#     return len(texts)


# # --- Fungsi 2: Menjawab Pertanyaan (dipanggil oleh /reply) ---

# prompt_template_text = """
# Anda adalah asisten AI yang informatif untuk website Universitas Padjadjaran (Unpad).
# Tugas Anda adalah menjawab pertanyaan user HANYA berdasarkan konteks yang diberikan di bawah ini.
# Jika jawaban tidak ada di dalam konteks, katakan "Maaf, saya tidak menemukan informasi tersebut di data saya."
# Jangan mencoba menjawab di luar konteks.

# Konteks:
# {context}

# Pertanyaan:
# {question}

# Jawaban Informatif:
# """

# PROMPT_TEMPLATE = PromptTemplate(
#     template=prompt_template_text, 
#     input_variables=["context", "question"]
# )

# try:
#     llm = ChatGoogleGenerativeAI(model="gemini-pro", temperature=0.3)
#     rag_chain = LLMChain(llm=llm, prompt=PROMPT_TEMPLATE)
# except Exception as e:
#     print(f"Error inisialisasi LLM: {e}")
#     rag_chain = None

# def get_rag_response(query: str) -> str:
#     """
#     Fungsi ini dipanggil oleh user (/reply) untuk mendapatkan jawaban.
#     """
#     if rag_chain is None or embeddings is None:
#         return "Error: Model AI (LLM atau Embeddings) gagal dimuat. Periksa API Key atau koneksi."
        
#     try:
#         # 1. Muat vector store yang SUDAH ADA dari disk
#         vector_store = Chroma(
#             persist_directory=VECTOR_STORE_PATH, 
#             embedding_function=embeddings
#         )

#         # 2. Lakukan pencarian dokumen yang relevan (Retrieval)
#         retriever = vector_store.as_retriever(search_kwargs={"k": 4})
#         relevant_docs = retriever.invoke(query)
        
#         context = "\n\n".join([doc.page_content for doc in relevant_docs])

#         # 3. Berikan konteks dan query ke LLM (Generation)
#         response = rag_chain.invoke({"context": context, "question": query})
        
#         return response.get('text', 'Terjadi kesalahan saat memproses jawaban.')

#     except FileNotFoundError:
#         return "Database pengetahuan (vector store) belum dibuat. Admin perlu menjalankan proses RAG terlebih dahulu."
#     except Exception as e:
#         print(f"Error di get_rag_response: {e}")
#         return f"Terjadi kesalahan: {e}"


# rag.py
import os
import google.generativeai as genai
from dotenv import load_dotenv
import time 

# Ubah import: Kita tidak perlu DirectoryLoader lagi
from langchain_community.document_loaders import TextLoader
from langchain_community.vectorstores import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain

# --- Konfigurasi Global ---

load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

DATA_PATH = "doc/pages"
VECTOR_STORE_PATH = "vector_store"

try:
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
except Exception as e:
    print(f"Error inisialisasi Embeddings: {e}")
    embeddings = None

# --- Fungsi 1: Membangun Vector Store (dipanggil oleh /do-rag) ---

def mainrag():
    """
    Fungsi ini dipanggil oleh admin (/do-rag) untuk membangun atau 
    memperbarui vector store setelah scrapping.
    """
    if embeddings is None:
        print("Embeddings gagal dimuat. Periksa API Key.")
        return 0
        
    print("Memulai proses RAG (Indexing)...")
    
    # --- MODIFIKASI UTAMA DIMULAI DI SINI ---
    
    # 1. Tentukan NAMA FILE yang ingin Anda tes
    # Ganti nama file ini dengan file .txt dari doc/pages/ yang ingin Anda gunakan
    # Saya ambil contoh dari error log Anda sebelumnya
    nama_file_tes = "0b0a8edea3f55d1b9d28c2dc12ceb772fbf052ea1ca17269ffc2421f79c17c55.txt"
    path_file_tes = os.path.join(DATA_PATH, nama_file_tes)

    # 2. Cek apakah file tes ada
    if not os.path.exists(path_file_tes):
        print(f"Error: File tes '{path_file_tes}' tidak ditemukan.")
        print(f"Pastikan file tersebut ada di dalam folder '{DATA_PATH}'")
        return 0

    # 3. Muat SATU file tes tersebut
    print(f"Memuat SATU file tes: {path_file_tes}")
    loader = TextLoader(path_file_tes, encoding='utf-8')
    documents = loader.load()
    
    # --- MODIFIKASI UTAMA SELESAI ---

    if not documents:
        print("Peringatan: Dokumen ada, tapi gagal dimuat.")
        return 0

    # 4. Pecah dokumen menjadi bagian-bagian kecil (chunks)
    print(f"Memecah {len(documents)} dokumen menjadi chunks...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    texts = text_splitter.split_documents(documents)

    if not texts:
        print("Peringatan: Dokumen ada, tapi gagal di-split menjadi chunks.")
        return 0

    print(f"Akan memproses {len(texts)} chunks ke vector store.")

    # 5. Buat objek vector store KOSONG terlebih dahulu
    vector_store = Chroma(
        persist_directory=VECTOR_STORE_PATH, 
        embedding_function=embeddings
    )

    # 6. Tentukan ukuran batch (kita tetap pakai batching untuk jaga-jaga)
    batch_size = 50
    total_batches = (len(texts) // batch_size) + 1
    
    print(f"Memulai pembuatan embeddings dalam {total_batches} batch...")

    # 7. Loop melalui teks dalam batch
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        
        if not batch:
            continue
            
        current_batch_num = (i // batch_size) + 1
        print(f"  - Memproses batch {current_batch_num} / {total_batches} ({len(batch)} chunks)...")
        
        try:
            vector_store.add_documents(documents=batch)
            print("  - Jeda 1 detik untuk rate limit...")
            time.sleep(1)
            
        except Exception as e:
            print(f"    !! GAGAL PADA BATCH {current_batch_num}: {e}")
            print("    !! Melanjutkan ke batch berikutnya...")
            time.sleep(1) 
            continue

    print("Vector store berhasil dibuat/diperbarui.")
    return len(texts)


# --- Fungsi 2: Menjawab Pertanyaan (dipanggil oleh /reply) ---
# (Tidak ada perubahan di sini, semua tetap sama)

prompt_template_text = """
Anda adalah asisten AI yang informatif untuk website Universitas Padjadjaran (Unpad).
Tugas Anda adalah menjawab pertanyaan user HANYA berdasarkan konteks yang diberikan di bawah ini.
Jika jawaban tidak ada di dalam konteks, katakan "Maaf, saya tidak menemukan informasi tersebut di data saya."
Jangan mencoba menjawab di luar konteks.

Konteks:
{context}

Pertanyaan:
{question}

Jawaban Informatif:
"""

PROMPT_TEMPLATE = PromptTemplate(
    template=prompt_template_text, 
    input_variables=["context", "question"]
)

try:
    llm = ChatGoogleGenerativeAI(model="gemini-pro", temperature=0.3)
    rag_chain = LLMChain(llm=llm, prompt=PROMPT_TEMPLATE)
except Exception as e:
    print(f"Error inisialisasi LLM: {e}")
    rag_chain = None

def get_rag_response(query: str) -> str:
    """
    Fungsi ini dipanggil oleh user (/reply) untuk mendapatkan jawaban.
    """
    if rag_chain is None or embeddings is None:
        return "Error: Model AI (LLM atau Embeddings) gagal dimuat. Periksa API Key atau koneksi."
        
    try:
        vector_store = Chroma(
            persist_directory=VECTOR_STORE_PATH, 
            embedding_function=embeddings
        )
        retriever = vector_store.as_retriever(search_kwargs={"k": 4})
        relevant_docs = retriever.invoke(query)
        context = "\n\n".join([doc.page_content for doc in relevant_docs])
        response = rag_chain.invoke({"context": context, "question": query})
        
        return response.get('text', 'Terjadi kesalahan saat memproses jawaban.')

    except FileNotFoundError:
        return "Database pengetahuan (vector store) belum dibuat. Admin perlu menjalankan proses RAG terlebih dahulu."
    except Exception as e:
        print(f"Error di get_rag_response: {e}")
        return f"Terjadi kesalahan: {e}"