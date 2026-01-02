# FIX
import requests
import cloudscraper
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import os
import time

visited = set()
domain = "unpad.ac.id"
current_dir = os.path.dirname(os.path.abspath(__file__))
sc_dir = "doc"
history_file = "doc_new/urlHistory.txt"
output_dir = "doc/pages"
history_file = os.path.join(current_dir, history_file)
USE_NEW = True
if USE_NEW:
    output_dir = os.path.join(current_dir, "doc_new/pages")
else:
    output_dir = os.path.join(current_dir, "doc/pages")

sc_dir = os.path.join(current_dir, sc_dir)
os.makedirs(output_dir, exist_ok=True)

# daftar path yang ingin dikecualikan
exclude_paths = ["/profil", "/login", "/admin", "/register", "/user", "/peraturan", "/uploads", "/pengumuman"]

import hashlib
import os

def hash_all_txt(folder):
    hashes = []

    if not os.path.exists(folder):
        return []

    for root, _, files in os.walk(folder):
        for f in sorted(files):  # menjaga deterministik
            if f.endswith(".txt"):
                file_path = os.path.join(root, f)

                hash_md5 = hashlib.md5()

                with open(file_path, "rb") as file:
                    while chunk := file.read(4096):
                        hash_md5.update(chunk)

                # simpan hasil hash untuk file ini
                hashes.append(hash_md5.hexdigest())

    return hashes


def save_hash(hashes, folder):
    path = os.path.join(folder, "hash.txt")
    with open(path, "w", encoding="utf-8") as f:
        for h in hashes:
            f.write(h + "\n")

def safe_delete(folder):
    if os.path.exists(folder):
        shutil.rmtree(folder)


def setup_document_structure():

    # Buat folder doc jika belum ada
    os.makedirs("doc", exist_ok=True)

    # Buat folder doc/pages jika belum ada
    os.makedirs(output_dir, exist_ok=True)

    # Buat file urlHistory.txt jika belum ada
    if not os.path.exists(history_file):
        with open(history_file, "w", encoding="utf-8") as f:
            f.write("")  # file kosong
        print(f"File '{history_file}' dibuat.")
    else:
        print(f"File '{history_file}' sudah ada.")

    print("Struktur folder dan file selesai dibuat.")

def load_history():
    setup_document_structure()
    if os.path.exists(history_file):
        with open(history_file, "r", encoding="utf-8") as f:
            for line in f:
                visited.add(line.strip())

def save_history(url, depth):
    with open(history_file, "a", encoding="utf-8") as f:
        f.write(url + " - " + str(depth) + "\n")

def is_valid_url(url):
    parsed = urlparse(url)
    if domain not in parsed.netloc or parsed.scheme not in ["http", "https"]:
        return False
    if url.endswith((".pdf", ".jpg", ".png", ".zip", ".docx", ".xls", ".ppt")):
        return False
    if is_date_path(url):
        return False
    for path in exclude_paths:
        if path in parsed.path:
            return False
    return True

def save_texts_with_limit(deepest_texts, url, output_dir, page_number, limit_bytes=30000):
    os.makedirs(output_dir, exist_ok=True)
    text_data = list(dict.fromkeys(deepest_texts))  # hapus duplikat
    
    file_index = 0
    filename = os.path.join(output_dir, f"page_{page_number}.txt")
    f = open(filename, "w", encoding="utf-8")
    f.write(f"URL page ini: {url}\n\n")

    current_size = f.tell()

    for text in text_data:
        text_to_add = text + "\n"
        text_size = len(text_to_add.encode("utf-8"))
        if current_size + text_size > limit_bytes:
            f.close()
            file_index += 1
            filename = os.path.join(output_dir, f"page_{page_number}-{file_index}.txt")
            f = open(filename, "w", encoding="utf-8")
            f.write(f"URL page ini: {url}\n\n")
            current_size = f.tell()
        
        f.write(text_to_add)
        current_size += text_size

    f.close()
    print(f"✅ ({page_number}) {url} → {len(text_data)} teks disimpan ke {filename}")


def scrape_page0(url, page_number):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        html = response.text
    except Exception as e:
        print(f"⚠️ Gagal scraping {url} dengan requests ({e}), mencoba cloudscraper...")
        try:
            scraper = cloudscraper.create_scraper(
                browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False}
            )
            response = scraper.get(url, timeout=15)
            response.raise_for_status()
            html = response.text
            print(f"✅ Berhasil scraping {url} dengan cloudscraper.")
        except Exception as e2:
            print(f"❌ Gagal scraping {url} (cloudscraper juga gagal): {e2}")
            return

    soup = BeautifulSoup(html, "html.parser")

    # HANYA mengambil elemen dengan class tertentu
    tab_contents = soup.select(".tabcontent, .content, .container, .elementor-container, .PAGES_CONTAINER")
    if not tab_contents:
        print(f"⏭️ Lewati {url} (tidak ada .tabcontent, .content, .elementor-container, .PAGES_CONTAINER, atau .container)")
        return

    valid_tags = ["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "b", "article", "section", "blockquote", "main", "table", "th", "td"]
    exclude_tags = ["footer", "nav"]
    deepest_texts = []

    for tab in tab_contents:
        if any(tab.find_parent(ex_tag) for ex_tag in exclude_tags):
            continue
        for tag in tab.find_all(valid_tags):
            if any(tag.find_parent(ex_tag) for ex_tag in exclude_tags):
                continue
            if not tag.find(valid_tags):
                text = tag.get_text(separator=" ", strip=True)
                if text:
                    deepest_texts.append(text)

    save_texts_with_limit(deepest_texts, url, output_dir, page_number)


def strip_attributes(tag):
    for attr in list(tag.attrs.keys()):
        del tag.attrs[attr]
    return tag

def scrape_page(url, page_number):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        html = response.text
    except Exception as e:
        print(f"Gagal scraping {url} dengan requests ({e}), mencoba cloudscraper...")
        try:
            scraper = cloudscraper.create_scraper(
                browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False}
            )
            response = scraper.get(url, timeout=15)
            response.raise_for_status()
            html = response.text
            print(f"Berhasil scraping {url} dengan cloudscraper.")
        except Exception as e2:
            print(f"Gagal scraping {url} (cloudscraper juga gagal): {e2}")
            return

    soup = BeautifulSoup(html, "html.parser")

    # 1. BERSIHKAN SEMUA ATRIBUT TAG HTML
    for tag in soup.find_all(True):
        tag.attrs = {}

    # 2. AMBIL SEMUA TAG VALID SEBAGAI HTML (BUKAN TEKS)
    valid_tags = ["div", "p", "h1", "h2", "h3", "h4", "h5", "h6",
                  "li", "b", "article", "section", "blockquote",
                  "main", "table", "th", "td"]

    exclude_tags = ["footer", "nav"]

    deepest_texts = []

    for tag in soup.find_all(valid_tags):
        if any(tag.find_parent(ex) for ex in exclude_tags):
            continue

        # hanya ambil tag yang tidak punya subtree valid
        if not tag.find(valid_tags):
            cleaned_html = str(tag)
            if cleaned_html.strip():
                deepest_texts.append(cleaned_html)

    # 3. TETAP MEMAKAI FUNSI ANDA
    save_texts_with_limit(deepest_texts, url, output_dir, page_number)

from collections import deque
from urllib.parse import urljoin
import time
import requests
from bs4 import BeautifulSoup
import re

from urllib.parse import urlparse, urlunparse

def normalize_url(url):
    parsed = urlparse(url)

    # Hapus fragment (#...)
    parsed = parsed._replace(fragment="")

    # Hapus trailing slash kecuali root
    cleaned = urlunparse(parsed)
    if cleaned.endswith("/") and len(cleaned) > len("https://x"):
        cleaned = cleaned.rstrip("/")

    return cleaned

def is_date_path(url):
    # Cocokkan pola /YYYY/MM/ atau /YYYY/M/
    pattern = r"/\d{4}/\d{1,2}/"
    return re.search(pattern, url) is not None

def crawl_bfs(start_url, depth, max_depth=2):
    queue = deque()
    queue.append((start_url, 0))  # (url, depth)
    visited = set()

    while queue:
        raw_url, depth = queue.popleft()
        url = normalize_url(raw_url)  # normalisasi dulu

        if url in visited or depth > max_depth:
            continue

        visited.add(url)
        save_history(url, depth)
        scrape_page(url, len(visited))

        print(f"\n[Depth {depth}] Sedang memproses: {url}")

        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            response = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(response.text, "html.parser")

            links = soup.find_all("a", href=True)

            # Tampilkan semua link dari halaman
            print("Daftar link yang ditemukan:")
            for a in links:
                print(" -", urljoin(url, a["href"]))

            for link in links:
                full_url = urljoin(url, link["href"])

                if is_valid_url(full_url) and full_url not in visited:
                    next_depth = depth+1

                    # Aturan peningkatan depth
                    # if "program-studi" in full_url:
                    #     next_depth = depth + 1

                    # Masukkan ke queue BFS
                    queue.append((full_url, next_depth))

            time.sleep(1)  # Delay agar tidak terlalu cepat

        except Exception as e:
            print(f"⚠️ Tidak bisa lanjut dari {url}: {e}")


import shutil
import os

def delete_folder(folder_path=sc_dir):
    if os.path.exists(folder_path):
        shutil.rmtree(folder_path)   # hapus folder dan seluruh isinya
        print(f"Folder '{folder_path}' berhasil dihapus.")
    else:
        print(f"Folder '{folder_path}' tidak ditemukan.")


    

import requests
import asyncio
import websockets
import json

def mainscrapping(start_url="https://smup.unpad.ac.id/"):

    global output_dir, USE_NEW

    # 1. Hapus doc_new jika ada
    safe_delete(os.path.join(current_dir, "doc_new"))

    # 2. Set output dir ke doc_new/pages
    USE_NEW = True
    output_dir = os.path.join(current_dir, "doc_new/pages")

    load_history()

    print(f"Mulai crawling dari: {start_url}")
    crawl_bfs(start_url, depth=0, max_depth=1)
    print("Selesai crawling.")

    # 3. Hitung hash untuk doc/pages (lama) dan doc_new/pages (baru)
    old_folder = os.path.join(current_dir, "doc/pages")
    new_folder = os.path.join(current_dir, "doc_new/pages")

    old_hash = hash_all_txt(old_folder)
    new_hash = hash_all_txt(new_folder)

    # 4. Simpan hash baru
    save_hash(new_hash, os.path.join(current_dir, "doc_new"))

    # 5. Bandingkan
    if old_hash == new_hash:
        print("HASH SAMA: tidak ada perubahan konten. Menghapus doc_new...")
        safe_delete(os.path.join(current_dir, "doc_new"))
    else:
        print("HASH BERBEDA: update dataset...")
        # 1. Update folder fisik
        safe_delete(os.path.join(current_dir, "doc"))
        os.rename(os.path.join(current_dir, "doc_new"), os.path.join(current_dir, "doc"))

        # 2. Update via HTTP (FastAPI)
        try:
            r = requests.get("http://127.0.0.1:3067/do-rag", timeout=10)
            print("Server FastAPI RAG response:", r.text)
        except Exception as e:
            print("Gagal GET ke FastAPI RAG:", e)

        # 3. Update via WebSocket (Server WS)
        # Kita buat fungsi internal async agar bisa dipanggil di main() sinkron
        async def notify_ws():
            uri = "ws://localhost:8765"
            try:
                async with websockets.connect(uri) as websocket:
                    payload = {"action": "admin_reload_rag"}
                    await websocket.send(json.dumps(payload))
                    # Tunggu konfirmasi dari server
                    response = await asyncio.wait_for(websocket.recv(), timeout=5)
                    print(f"WS Notification Response: {response}")
            except Exception as e:
                print(f"Gagal mengirim sinyal reload ke WebSocket: {e}")

        # Jalankan fungsi async di tengah fungsi sync
        asyncio.run(notify_ws())

    
    print("Selesai. Keluar dalam 50 detik...")
    time.sleep(50)
    # 7. Exit program
    print("Program selesai. Keluar.")
    os._exit(0)


if __name__ == "__main__":
    mainscrapping("https://smup.unpad.ac.id/")