# ocr_gemini.py
import os
import base64
from google import genai
from google.genai import types
from dotenv import load_dotenv
load_dotenv()

# Pastikan environment var
# export GEMINI_API_KEY=your_key_here
API_KEY = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=API_KEY)

def ocr_file(path: str) -> str:
    data = open(path, "rb").read()
    # tentukan MIME berdasarkan ekstensi
    ext = os.path.splitext(path)[1].lower()
    if ext in (".jpg", ".jpeg"):
        mime = "image/jpeg"
    elif ext in (".png",):
        mime = "image/png"
    elif ext in (".pdf",):
        mime = "application/pdf"
    else:
        raise ValueError("Unsupported file type")

    # kirim ke Gemini 2.5 Flash
    content = types.Part.from_bytes(data=data, mime_type=mime)
    prompt = """
Analisis dokumen berikut secara menyeluruh.

1. Identifikasi konteks utama dokumen:
   - Jelaskan jenis dokumen (gambar, formulir, surat, laporan, tabel, atau dokumen umum).
   - Jelaskan tujuan atau topik utama yang dapat dipahami.

2. Jika dokumen berisi teks:
   - Ekstrak seluruh teks secara lengkap.
   - Pertahankan urutan logis dari atas ke bawah.
   - Jika ada tabel, tulis kembali dalam format teks yang mudah dibaca.
   - Jika ada bagian yang tidak terbaca, tandai sebagai [tidak terbaca].

3. Jika dokumen mengandung elemen visual penting (tanda tangan, stempel, grafik, diagram):
   - Deskripsikan secara singkat tanpa mengubah makna.

4. Jangan menambahkan interpretasi yang tidak ada.
   - Fokus berikan konteks & isi asli dokumen.
   - Jangan menebak-nebak isi yang tidak terlihat.

Berikan jawaban dalam format:

Konteks Dokumen:
<penjelasan konteks>

Isi Dokumen:
<hasil OCR dalam bentuk teks>
"""

    resp = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[content, prompt]
    )

    # print(resp.text)

    return resp.text

if __name__ == "__main__":
    path = "C:/Users/USER/Documents/a kerja/pipp/smup/new service/ws/public/upload/69350e14da8085cfd1c6e6ec.png"
    text = ocr_file(path)
    print("=== OCR result ===")
    print(text)
