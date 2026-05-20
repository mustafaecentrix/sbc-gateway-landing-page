#!/bin/bash

# SBC Gateway Landing Page Deployment Script
TARGET_DIR="/opt/landingsbc"

cd "$TARGET_DIR" || exit 1

# Mengatasi error "dubious ownership" jika dijalankan sebagai user yang berbeda (misal: root)
git config --global --add safe.directory "$TARGET_DIR"

# Memeriksa apakah git sudah diinisialisasi
if [ ! -d .git ]; then
    echo "Menginisialisasi git repository..."
    git init
    git branch -M main
fi

echo "============================================================"
echo "GitHub memerlukan Personal Access Token (PAT) untuk login terminal."
echo "Cara mendapatkan Token:"
echo "1. Buka github.com dan login dengan akun Gmail Anda."
echo "2. Klik foto profil di pojok kanan atas -> Settings."
echo "3. Scroll ke bawah kiri -> Developer settings -> Personal access tokens -> Tokens (classic)."
echo "4. Klik 'Generate new token (classic)'."
echo "5. Isi Note (misal: sbc-deploy), centang kotak 'repo', lalu scroll ke bawah dan klik 'Generate token'."
echo "6. Copy teks token yang muncul (biasanya berawalan ghp_...)"
echo "============================================================"
read -p "Paste GitHub Personal Access Token Anda di sini: " GITHUB_TOKEN

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Token tidak boleh kosong. Dibatalkan."
    exit 1
fi

# URL dengan token autentikasi
REPO_URL="https://${GITHUB_TOKEN}@github.com/mustafaecentrix/sbc-gateway-landing-page.git"

# Menambah atau memperbarui remote
if ! git remote | grep -q "origin"; then
    echo "Menambahkan remote origin..."
    git remote add origin "$REPO_URL"
else
    git remote set-url origin "$REPO_URL"
fi

# Menambahkan semua file
git add .

# Menentukan commit message
read -p "Masukkan commit message (Tekan enter untuk default: 'Update landing page assets'): " COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="Update landing page assets"
fi

# Melakukan commit
git commit -m "$COMMIT_MSG"

# Mendorong perubahan ke GitHub
echo "Sedang upload ke GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo "✅ Berhasil upload ke GitHub!"
else
    echo "❌ Gagal upload ke GitHub. Pastikan Token valid dan repositori belum diprivate tanpa akses."
fi
