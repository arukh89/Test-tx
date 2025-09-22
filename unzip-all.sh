#!/bin/bash

# Cari semua file .zip di folder saat ini
for file in *.zip; do
    # Cek apakah ada file .zip
    if [ -e "$file" ]; then
        echo "📦 Menangani: $file"

        # Ekstrak ke folder sementara
        temp_dir="${file%.zip}_unzipped"
        unzip -q "$file" -d "$temp_dir"

        # Pindahkan semua isi ke root
        mv "$temp_dir"/* .
        rmdir "$temp_dir"

        # Hapus file zip
        rm "$file"
        echo "✅ $file sudah diekstrak & dihapus."
    fi
done
