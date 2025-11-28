export function startHeartbeat() {
  // Kirim heartbeat pertama kali langsung
  sendHeartbeat();

  // Kirim setiap 2 menit (120.000 ms)
  setInterval(() => {
    sendHeartbeat();
  }, 1000*60*4);
}

async function sendHeartbeat() {
  try {
    await fetch("http://localhost:5000/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",  // jika menggunakan session
      body: JSON.stringify({ ts: Date.now() })
    });
  } catch (err) {
    console.error("Heartbeat gagal:", err);
  }
}
