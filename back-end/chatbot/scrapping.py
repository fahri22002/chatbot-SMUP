import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import os
import time
import hashlib # Tambah: Untuk penamaan file yang unik

# --- Konfigurasi Global ---
domain = "unpad.ac.id"
history_file = "doc/urlHistory.txt"
output_dir = "doc/pages"

# Inisialisasi set URL yang sudah dikunjungi
visited = set()
os.makedirs("doc", exist_ok=True) # Pastikan direktori doc ada
os.makedirs(output_dir, exist_ok=True) # Pastikan direktori pages ada

# Daftar path yang ingin dikecualikan
exclude_paths = ["/profil", "/login", "/admin", "/register", "/user", "/tag", "/category"]
# Tambah pengecualian umum untuk menghindari data yang tidak relevan (seperti navigasi)
exclude_texts = ["Pencarian", "Layanan", "Keranjang"] 

# --- Fungsi Utility ---

def load_history():
    """Memuat URL yang sudah dikunjungi dari file history."""
    if os.path.exists(history_file):
        with open(history_file, "r", encoding="utf-8") as f:
            for line in f:
                visited.add(line.strip())
    # Kembalikan jumlah URL yang sudah dimuat untuk pelaporan
    return len(visited)

def save_history(url):
    """Menyimpan URL yang baru dikunjungi ke file history."""
    with open(history_file, "a", encoding="utf-8") as f:
        f.write(url + "\n")

def get_filename_from_url(url):
    """Menghasilkan nama file yang unik dan aman dari URL menggunakan hash."""
    # Gunakan SHA256 dari URL untuk nama file
    url_hash = hashlib.sha256(url.encode('utf-8')).hexdigest()
    return os.path.join(output_dir, f"{url_hash}.txt")

def is_valid_url(url):
    """Memeriksa apakah URL valid untuk dicrawl."""
    parsed = urlparse(url)
    
    # Cek domain dan skema
    if domain not in parsed.netloc or parsed.scheme not in ["http", "https"]:
        return False
        
    # Cek tipe file yang dikecualikan
    if url.lower().endswith((".pdf", ".jpg", ".png", ".zip", ".docx", ".xls", ".ppt", ".mp4", ".css", ".js")):
        return False
        
    # Cek path yang dikecualikan
    for path in exclude_paths:
        if path in parsed.path.lower():
            return False
            
    return True

# --- Fungsi Inti Scraping dan Crawling ---

def scrape_page(url, current_count):
    """Mengambil dan membersihkan teks dari halaman, lalu menyimpannya."""
    filename = get_filename_from_url(url)
    
    # Jika file sudah ada, lewati scraping
    if os.path.exists(filename):
         # Cukup update visited jika logika history sudah sempurna
         return

    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; UnpadBot/1.0; +http://unpad.ac.id/crawler-policy)"} # Good practice: custom User-Agent
        response = requests.get(url, headers=headers, timeout=15) # Tingkatkan timeout sedikit
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        # Perluas tag yang dianggap valid untuk konten
        valid_tags = ["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "article", "section", "blockquote", "main", "span"]

        deepest_texts = []
        for tag in soup.find_all(valid_tags):
            # Hanya ambil teks dari tag terdalam untuk meminimalisir duplikasi
            if not tag.find(valid_tags):
                text = tag.get_text(strip=True)
                if text and len(text) > 30: # Filter teks terlalu pendek
                    # Filter teks yang termasuk dalam pengecualian (misal: menu navigasi umum)
                    is_excluded = False
                    for ex_text in exclude_texts:
                        if ex_text in text:
                            is_excluded = True
                            break
                    
                    if not is_excluded:
                        deepest_texts.append(text)

        # Gunakan dict.fromkeys untuk menjaga urutan dan menghilangkan duplikasi
        text_data = list(dict.fromkeys(deepest_texts)) 

        with open(filename, "w", encoding="utf-8") as f:
            for text in text_data:
                f.write(text + "\n")

        print(f"✅ ({current_count}) {url} → {len(text_data)} teks disimpan ke {filename}")
        return len(text_data)

    except requests.exceptions.RequestException as e:
        print(f"❌ Gagal request {url}: {e}")
    except Exception as e:
        print(f"❌ Gagal scraping {url}: Error lain: {e}")
    
    return 0


def crawl(url, depth=0, max_depth=2):
    """Fungsi rekursif untuk crawling."""
    
    # Perbaikan 1: Penambahan visited dilakukan setelah is_valid_url
    if url in visited or depth > max_depth or not is_valid_url(url):
        return
        
    visited.add(url)
    save_history(url)

    # Lakukan scraping
    scrape_page(url, len(visited)) 

    # Implementasi delay (sudah ada, sangat baik)
    time.sleep(1)

    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; UnpadBot/1.0; +http://unpad.ac.id/crawler-policy)"}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        links = soup.find_all("a", href=True)
        for link in links:
            full_url = urljoin(url, link["href"])
            
            # Perbaikan 2: Max depth dinamis berdasarkan path (jika diperlukan)
            # Logika ini perlu disempurnakan atau dihilangkan jika terlalu kompleks
            next_max_depth = max_depth
            if "/fakultas" in full_url or "/program-studi" in full_url:
                 # Di halaman penting, tingkatkan kedalaman pencarian
                 next_max_depth = max(max_depth, 3) 
                 
            # Perbaikan 3: Pengecekan is_valid_url di sini untuk memfilter link sebelum rekursif
            if is_valid_url(full_url) and full_url not in visited:
                
                # Panggil rekursif dengan max_depth yang mungkin telah disesuaikan
                crawl(full_url, depth + 1, next_max_depth) 

    except requests.exceptions.RequestException as e:
        print(f"⚠️ Tidak bisa lanjut dari {url}: Error request: {e}")
    except Exception as e:
        print(f"⚠️ Tidak bisa lanjut dari {url}: Error parsing/lain: {e}")

# --- Main Entry Point ---

def mainscrapping():
    """Fungsi utama yang dipanggil dari FastAPI untuk memulai crawling."""
    start_url = "https://smup.unpad.ac.id/"
    
    # Perbaikan 4: Logika untuk melaporkan status history
    initial_count = load_history()
    if initial_count > 0:
        print(f"Memuat {initial_count} URL dari riwayat. Lanjutkan crawling...")
    else:
        print(f"Mulai crawling baru dari: {start_url}")

    # Panggil fungsi crawl
    crawl(start_url, depth=0, max_depth=2) # Pertahankan max_depth 2 atau 3 agar tidak terlalu lama
    print(f"Selesai crawling. Total URL yang dikunjungi: {len(visited)}")
    return {"visited_count": len(visited)} # Kembalikan data untuk FastAPI response


if __name__ == "__main__":
    mainscrapping()