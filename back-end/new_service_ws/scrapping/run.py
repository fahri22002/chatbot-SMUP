# main.py
import subprocess
import sys
import os
import platform
import time

# Tentukan perintah untuk membuka terminal baru dan menjalankan skrip
# Perlu diingat: Perintah terminal bisa bervariasi tergantung pada distribusi Linux/emulator terminal!
current_dir = os.path.dirname(os.path.abspath(__file__))
worker_filename = 'scrapping.py'
if platform.system() == "Windows":
    # Untuk Windows, gunakan 'start' dan flag CREATE_NEW_CONSOLE
    command = [
        "start", 
        "cmd", 
        "/k",  # /k agar terminal tetap terbuka setelah program selesai
        f"python \"{os.path.join(current_dir, worker_filename)}\""
    ]
    # CREATE_NEW_CONSOLE memastikan jendela baru
    creation_flags = subprocess.CREATE_NEW_CONSOLE
    shell_mode = True
    
elif platform.system() == "Darwin": # macOS
    # Untuk macOS, gunakan 'open' untuk membuka Terminal baru
    # Ini mungkin tidak selalu menampilkan output secara otomatis/menunggu
    command = [
        "open", 
        "-a", 
        "Terminal", 
        "python", 
        f"\"{os.path.join(current_dir, worker_filename)}\"", 
        "Process1"
    ]
    creation_flags = 0
    shell_mode = False

else: # Linux/Lainnya (Asumsi menggunakan gnome-terminal)
    # Sesuaikan 'gnome-terminal' dengan emulator terminal Anda (misalnya 'xterm', 'konsole')
    command = [
        "gnome-terminal", 
        "--", 
        "python3", # Gunakan python3 atau python
        f"\"{os.path.join(current_dir, worker_filename)}\"", 
        "Process1"
    ]
    creation_flags = 0
    shell_mode = False

# --- Eksekusi ---

print("Memulai proses kedua di terminal baru...")

def run_scrapping():
    try:
        # Jalankan scrapping.py sebagai proses terpisah
        # 'Popen' memulai proses dan TIDAK MENUNGGU
        # 'sys.executable' lebih baik daripada 'python'
        if platform.system() == "Windows":
            # Untuk Windows Popen butuh shell=True dan flag
            process = subprocess.Popen(
                " ".join(command), 
                creationflags=creation_flags, 
                shell=shell_mode
            )
        else:
            # Untuk Linux/macOS
            # NOTE: Jika Anda menggunakan cara Windows di atas, gunakan command[0] + ' ' + ' '.join(command[1:])
            process = subprocess.Popen(command, shell=shell_mode)

        print(f"Proses kedua (PID: {process.pid}) telah dimulai.")
        
        # Lanjutkan eksekusi skrip utama secara paralel
        print("\n--- Main Skrip Scrapping Berjalan Paralel ---")
        # for i in range(1, 4):
        #     print(f"[MAIN] Proses utama berjalan, hitungan ke {i}")
        #     time.sleep(1) 
        
        # print("\n[MAIN] Menunggu proses kedua selesai...")
        # process.wait() # Jika ingin menunggu proses kedua selesai

    except FileNotFoundError:
        print(f"ERROR: Tidak dapat menemukan atau menjalankan program terminal/python. Cek path atau perintah.")
    except Exception as e:
        print(f"Terjadi kesalahan: {e}")

    print("[MAIN] Skrip utama selesai.")