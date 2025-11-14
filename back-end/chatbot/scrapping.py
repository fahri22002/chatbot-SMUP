import requests
import cloudscraper
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
    for path in exclude_paths:
        if path in parsed.path:
            return False
    return True

def remove_duplicate_blocks_auto(lines, max_block=20):
    n = len(lines)
    used = [False] * n  # menandai baris yang merupakan duplikat
    i = 0
    result = []

    while i < n:
        if used[i]:
            i += 1
            continue

        if i > 0 and lines[i] == lines[i - 1]:
            i += 1
            continue

        # Cari ukuran block yang mungkin (3 - 20 baris)
        found_duplicate = False
        for block_size in range(3, max_block + 1):
            if i + block_size > n:
                break

            block = tuple(lines[i:i+block_size])

            # Cari block identik di tempat lain (tidak berdekatan)
            for j in range(i + block_size, n - block_size + 1):
                if tuple(lines[j:j+block_size]) == block:
                    # tandai seluruh block j sebagai duplikat
                    for k in range(j, j + block_size):
                        used[k] = True
                    found_duplicate = True
            # Jika sudah ketemu duplikatnya, tidak perlu coba block_size lain
            if found_duplicate:
                break

        # Masukkan block pertama
        result.append(lines[i])
        i += 1

    return result



def save_texts_with_limit(deepest_texts, url, output_dir, page_number, limit_bytes=30000):
    os.makedirs(output_dir, exist_ok=True)
    # text_data = list(dict.fromkeys(deepest_texts))  # hapus duplikat
    text_data = remove_duplicate_blocks_auto(deepest_texts)
    
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


def scrape_page(url, page_number):
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

    valid_tags = ["div", "span", "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "b", "article", "section", "blockquote", "main", "tbody"]
    title_tags = ["h1", "h2"]
    exclude_tags = ["footer", "nav"]
    deepest_texts = []

    for tab in tab_contents:
        if any(tab.find_parent(ex_tag) for ex_tag in exclude_tags):
            continue
        for tag in tab.find_all(valid_tags):
            if any(tag.find_parent(ex_tag) for ex_tag in exclude_tags):
                continue

            # jika LI → selalu ambil text-nya
            if tag.name.lower() == "li":
                text = tag.get_text(" ", strip=True)
                if text:
                    deepest_texts.append(text)
                continue
            
            if not tag.find(valid_tags):
                text = tag.get_text(separator=" ", strip=True)
                if text:
                    # jika h1 atau h2 → tambahkan prefix Judul :
                    if tag.name.lower() in title_tags:
                        deepest_texts.append("Judul : " + text)
                    else:
                        deepest_texts.append(text)

    save_texts_with_limit(deepest_texts, url, output_dir, page_number)


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
                next_depth_limit = max_depth
                if "fakultas" in full_url or "program-studi" in full_url:
                # if full_url.rstrip("/").endswith(("fakultas", "program-studi")):
                    next_depth_limit = max_depth+1
                if "berita" in full_url:
                    next_depth_limit = depth
                time.sleep(1)
                crawl(full_url, depth + 1, next_depth_limit )

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
