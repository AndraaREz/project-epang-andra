# ✈️ Game Pesawat Terbang — Multiplayer Edition

> **Kelompok Triple W** — Proyek game arcade shooter pesawat dengan dukungan multiplayer lokal dan online.

![Version](https://img.shields.io/badge/version-2.0.0-gold)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🎮 Fitur

### Mode Permainan
- **🎯 Single Player** — Main sendiri lawan musuh dan boss
- **👥 Local Multiplayer** — 2-4 pemain di satu layar (satu keyboard/HP)
- **🌐 Online Multiplayer** — Main bersama teman via internet (max 4 pemain per room)

### Fitur Baru (Improvisasi)
- 🛡️ **4 Power-ups**: Shield, Rapid Fire, Bomb, Speed Boost
- 👾 **4 Tipe Musuh**: Basic, Fast, Tank (HP 3), Zigzag
- 👹 **Boss Battle** — Muncul setiap 500 poin
- 🎨 **3 Skin Pesawat** — Blue Jet, Red Falcon, Green Hawk
- ⚡ **Combo System** — Hancurkan musuh berturut-turut untuk bonus poin
- 💬 **Chat Room** — Komunikasi saat bermain online
- 🏆 **Leaderboard & Skor Tim**
- 📳 **Screen Shake** — Efek getar saat ledakan
- 📱 **Touch Controls** — Support mobile
- 🔊 **Sound Effects** — Menggunakan Web Audio API

---

## 🚀 Cara Deploy

### 1. Deploy Frontend ke Vercel (Gratis)

#### a. Buat Repository GitHub
1. Buat repository baru di [github.com](https://github.com)
2. Upload semua file project ini ke repository

#### b. Deploy ke Vercel
1. Buka [vercel.com](https://vercel.com) dan login dengan GitHub
2. Klik **"Add New Project"**
3. Pilih repository game ini
4. Klik **"Deploy"**
5. Selesai! Game single player sudah bisa dimainkan

> **Catatan**: Folder `public/` akan otomatis di-deploy sebagai static site oleh Vercel.

---

### 2. Deploy Backend Multiplayer (Online Mode)

Untuk mode online multiplayer, kamu perlu deploy backend server terpisah.

#### Opsi A: Deploy ke Render (Rekomendasi — Gratis)

1. Buka [render.com](https://render.com) dan login
2. Klik **"New +"** → **"Web Service"**
3. Connect ke repository GitHub yang sama
4. Isi konfigurasi:
   - **Name**: `airplane-game-server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. Klik **"Create Web Service"**
6. Tunggu deploy selesai, copy URL server (contoh: `https://airplane-game-server.onrender.com`)
7. Masukkan URL tersebut di menu Online Multiplayer → Server URL

#### Opsi B: Deploy ke Railway (Gratis)

1. Buka [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Tambahkan variabel `PORT = 3000`
4. Deploy dan copy public URL

#### Opsi C: Jalankan Lokal

```bash
# Install dependencies
npm install

# Jalankan server
npm start

# Buka browser ke http://localhost:3000
```

---

## 📁 Struktur Project

```
airplane-game/
├── public/
│   └── index.html          # Game client (frontend)
├── server.js               # Backend multiplayer (Node.js + Socket.io)
├── package.json            # Dependencies
├── vercel.json             # Config deploy Vercel
├── .gitignore              # Git ignore
└── README.md               # Dokumentasi ini
```

---

## 🕹️ Cara Bermain

### Kontrol Keyboard (Single & Online)
| Tombol | Aksi |
|--------|------|
| `← →` atau `A D` | Gerak kiri/kanan |
| `↑ ↓` atau `W S` | Gerak atas/bawah |
| `Space` / `F` | Tembak |
| `L` | Laser |
| `B` | Bomb (jika ada) |
| `Esc` | Kembali ke menu |

### Kontrol Local Multiplayer
| Pemain | Gerak | Tembak | Laser | Bomb |
|--------|-------|--------|-------|------|
| **P1 (Biru)** | WASD | Space | Q | E |
| **P2 (Merah)** | Arrow Keys | Enter | Shift | / |
| **P3 (Hijau)** | IJKL | O | P | U |
| **P4 (Kuning)** | TFGH | Y | R | V |

### Kontrol Touch (Mobile)
Gunakan tombol kontrol di bawah layar saat bermain di HP.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5 Canvas, Vanilla JavaScript, CSS3
- **Backend**: Node.js, Express, Socket.io
- **Deploy**: Vercel (Frontend), Render/Railway (Backend)
- **Audio**: Web Audio API

---

## 📝 Catatan Penting

1. **Vercel hanya untuk frontend static** — Mode online memerlukan backend server (Render/Railway) karena Vercel Functions tidak mendukung WebSocket persistent connection.

2. **Server gratis (Render/Railway)** akan sleep setelah tidak aktif. Saat pertama kali connect, mungkin perlu tunggu 30-60 detik untuk server "bangun".

3. **LocalStorage** digunakan untuk menyimpan skor tertinggi di mode single player.

4. **Max 4 pemain** per room untuk mode online.

---

## 👥 Kelompok Triple W

Proyek ini dibuat untuk tugas kelompok.

---

## 📄 Lisensi

MIT License — Bebas digunakan, dimodifikasi, dan didistribusikan.
