import os, re, time, shutil, hashlib, requests, cloudscraper
from bs4 import BeautifulSoup
from collections import deque
from urllib.parse import urljoin, urlparse, urlunparse

DOMAIN = "unpad.ac.id"
START_URL = "https://smup.unpad.ac.id/"
EXCLUDE_PATHS = ["/profil", "/login", "/admin", "/register", "/user", "/peraturan", "/uploads", "/pengumuman"]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOC_DIR = os.path.join(BASE_DIR, "doc")
NEW_DIR = os.path.join(BASE_DIR, "doc_new")
OUT_DIR = os.path.join(NEW_DIR, "pages")
HISTORY = os.path.join(NEW_DIR, "urlHistory.txt")

os.makedirs(OUT_DIR, exist_ok=True)

def normalize_url(url):
    p = urlparse(url)._replace(fragment="")
    clean = urlunparse(p)
    return clean.rstrip("/") if clean.endswith("/") and len(clean) > 8 else clean

def is_date_path(url):
    return re.search(r"/\d{4}/\d{1,2}/", url) is not None

def is_valid_url(url):
    p = urlparse(url)
    if DOMAIN not in p.netloc or p.scheme not in ["http", "https"]:
        return False
    if url.endswith((".pdf", ".jpg", ".png", ".zip", ".docx", ".xls", ".ppt")):
        return False
    if is_date_path(url):
        return False
    return not any(x in p.path for x in EXCLUDE_PATHS)

def fetch_html(url):
    try:
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        r.raise_for_status()
        return r.text
    except:
        scraper = cloudscraper.create_scraper(
            browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False}
        )
        return scraper.get(url, timeout=15).text

def save_texts(texts, url, idx, limit=30000):
    texts = list(dict.fromkeys(texts))
    size, part = 0, 0
    f = open(os.path.join(OUT_DIR, f"page_{idx}.txt"), "w", encoding="utf-8")
    f.write(f"URL: {url}\n\n")

    for t in texts:
        b = len((t + "\n").encode())
        if size + b > limit:
            f.close()
            part += 1
            f = open(os.path.join(OUT_DIR, f"page_{idx}-{part}.txt"), "w", encoding="utf-8")
            f.write(f"URL: {url}\n\n")
            size = 0
        f.write(t + "\n")
        size += b

    f.close()

def scrape_page(url, idx):
    soup = BeautifulSoup(fetch_html(url), "html.parser")
    for tag in soup.find_all(True):
        tag.attrs = {}

    valid = ["div","p","h1","h2","h3","h4","h5","h6","li","b","article","section","blockquote","main","table","th","td"]
    texts = []

    for tag in soup.find_all(valid):
        if not tag.find(valid) and not tag.find_parent(["footer","nav"]):
            txt = tag.get_text(" ", strip=True)
            if txt:
                texts.append(txt)

    save_texts(texts, url, idx)

def hash_folder(folder):
    hashes = []
    if not os.path.exists(folder):
        return hashes
    for r,_,fs in os.walk(folder):
        for f in sorted(x for x in fs if x.endswith(".txt")):
            h = hashlib.md5(open(os.path.join(r,f),"rb").read()).hexdigest()
            hashes.append(h)
    return hashes

def crawl_bfs(start, max_depth=1):
    visited, q = set(), deque([(start,0)])
    os.makedirs(NEW_DIR, exist_ok=True)
    open(HISTORY, "a").close()

    while q:
        raw, d = q.popleft()
        url = normalize_url(raw)
        if url in visited or d > max_depth:
            continue

        visited.add(url)
        scrape_page(url, len(visited))
        with open(HISTORY, "a") as f:
            f.write(f"{url} - {d}\n")

        soup = BeautifulSoup(fetch_html(url), "html.parser")
        for a in soup.find_all("a", href=True):
            full = urljoin(url, a["href"])
            if is_valid_url(full):
                q.append((full, d+1))
        time.sleep(1)

import time # Pastikan import time di bagian atas file

def main():
    shutil.rmtree(NEW_DIR, ignore_errors=True)
    crawl_bfs(START_URL)

    old_hash = hash_folder(os.path.join(DOC_DIR, "pages"))
    new_hash = hash_folder(OUT_DIR)

    if old_hash == new_hash:
        print("Data tidak berubah. Menghapus folder baru.")
        shutil.rmtree(NEW_DIR)
    else:
        print("Data berubah. Memperbarui folder dokumen...")
        shutil.rmtree(DOC_DIR, ignore_errors=True)
        os.rename(NEW_DIR, DOC_DIR)
        
        try:
            # Mengirim request ke endpoint RAG
            response = requests.get("http://127.0.0.1:3067/do-rag", timeout=10)
            
            # Print status code dan teks respons
            print(f"RAG Update Response Status: {response.status_code}")
            print(f"RAG Update Response Body: {response.text}")
        except Exception as e:
            print(f"Gagal menghubungi endpoint RAG: {e}")

    # Menunggu 5 detik sebelum keluar
    print("Selesai. Keluar dalam 5 detik...")
    time.sleep(50)
    
    # Gunakan os._exit(0) hanya jika benar-benar ingin menghentikan thread/proses secara paksa
    os._exit(0)

if __name__ == "__main__":
    main()
