#!/bin/bash
# Cleanup script untuk merapikan repo

echo "Mulai cleanup..."

# Hapus cache, log, dan dependency lokal
rm -rf node_modules
rm -rf .cache
rm -rf .upm
rm -rf *.log

# Hapus file sementara yang tidak perlu
rm -f *~
rm -f *.tmp

# Jalankan npm install ulang
npm install

echo "Cleanup selesai!"

# Simpan perubahan ke GitHub
git add .
git commit -m "Cleanup otomatis"
git push