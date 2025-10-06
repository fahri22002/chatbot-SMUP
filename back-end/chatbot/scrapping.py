import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import os
import time

visited = set()
domain = "unpad.ac.id"
history_file = "doc/urlHistory.txt"
output_dir = "doc/pages"
os.makedirs(output_dir, exist_ok=True)

# daftar path yang ingin dikecualikan
exclude_paths = ["/profil", "/login", "/admin", "/register", "/user"]

def load_history():
    if os.path.exists(history_file):
        with open(history_file, "r", encoding="utf-8") as f:
            for line in f:
                visited.add(line.strip())

def save_history(url):
    with open(history_file, "a", encoding="utf-8") as f:
        f.write(url + "\n")

def is_valid_url(url):
    parsed = urlparse(url)
    if domain not in parsed.netloc or parsed.scheme not in ["http", "https"]:
        return False
    if url.endswith((".pdf", ".jpg", ".png", ".zip", ".docx", ".xls", ".ppt")):
        return False
    # cek path yang dikecualikan
    for path in exclude_paths:
        if path in parsed.path:
            return False
    return True

def scrape_page(url, page_number):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        valid_tags = ["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "article", "section", "blockquote"]

        deepest_texts = []
        for tag in soup.find_all(valid_tags):
            if not tag.find(valid_tags):
                text = tag.get_text(strip=True)
                if text:
                    deepest_texts.append(text)

        text_data = list(dict.fromkeys(deepest_texts))

        filename = os.path.join(output_dir, f"page_{page_number}.txt")
        with open(filename, "w", encoding="utf-8") as f:
            for text in text_data:
                f.write(text + "\n")

        print(f"✅ ({page_number}) {url} → {len(text_data)} teks disimpan ke {filename}")

    except Exception as e:
        print(f"❌ Gagal scraping {url}: {e}")

def crawl(url, depth=0, max_depth=2):
    if url in visited or depth > max_depth:
        return
    visited.add(url)
    save_history(url)

    scrape_page(url, len(visited))

    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")

        links = soup.find_all("a", href=True)
        for link in links:
            full_url = urljoin(url, link["href"])
            if is_valid_url(full_url) and full_url not in visited:
                if "/fakultas" in full_url:
                    next_depth = 3
                time.sleep(1)
                crawl(full_url, depth + 1, max_depth)

    except Exception as e:
        print(f"⚠️ Tidak bisa lanjut dari {url}: {e}")

if __name__ == "__main__":
    start_url = "https://smup.unpad.ac.id/"
    load_history()
    print(f"Mulai crawling dari: {start_url}")
    crawl(start_url, depth=0, max_depth=2)
    print("Selesai crawling.")

def mainscrapping():
    start_url = "https://smup.unpad.ac.id/"
    load_history()
    print(f"Mulai crawling dari: {start_url}")
    crawl(start_url, depth=0, max_depth=2)
    print("Selesai crawling.")
