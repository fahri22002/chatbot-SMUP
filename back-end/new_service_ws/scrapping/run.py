# run.py
import subprocess
import sys
import os
import platform
import time

# Tentukan perintah untuk membuka terminal baru dan menjalankan skrip
current_dir = os.path.dirname(os.path.abspath(__file__))
worker_filename = 'scrapping.py'

if platform.system() == "Windows":
    # Untuk Windows, gunakan 'start' dan flag CREATE_NEW_CONSOLE
    command = [
        "start", 
        "cmd", 
        "/c",  
        f"python \"{os.path.join(current_dir, worker_filename)}\""
    ]
    # CREATE_NEW_CONSOLE memastikan jendela baru
    creation_flags = subprocess.CREATE_NEW_CONSOLE
    shell_mode = True
    
elif platform.system() == "Darwin": # macOS
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

else: # Linux/Lainnya
    command = [
        "gnome-terminal", 
        "--", 
        "python3", 
        f"\"{os.path.join(current_dir, worker_filename)}\"", 
        "Process1"
    ]
    creation_flags = 0
    shell_mode = False

# --- Definisi Fungsi ---

def run_scrapping():
    print("Memulai proses kedua di terminal baru...")
    try:
        # Jalankan scrapping.py sebagai proses terpisah
        if platform.system() == "Windows":
            process = subprocess.Popen(
                " ".join(command), 
                creationflags=creation_flags, 
                shell=shell_mode
            )
        else:
            process = subprocess.Popen(command, shell=shell_mode)

        print(f"Proses kedua (PID: {process.pid}) telah dimulai.")
        print("\n--- Main Skrip Scrapping Berjalan Paralel ---")
        
        # Script utama selesai tugasnya (tugasnya hanya membuka jendela baru)

    except FileNotFoundError:
        print(f"ERROR: Tidak dapat menemukan atau menjalankan program terminal/python.")
    except Exception as e:
        print(f"Terjadi kesalahan: {e}")

    print("[MAIN] Skrip utama selesai.")

# --- EKSEKUSI (Tombol Start) ---
if __name__ == "__main__":
    run_scrapping()