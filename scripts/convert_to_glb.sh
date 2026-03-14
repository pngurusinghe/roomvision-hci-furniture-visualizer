#!/bin/bash

# Convert all .gltf files in assets/ to .glb using gltf-pipeline

echo "Converting .gltf files to standalone .glb format..."

# Ensure gltf-pipeline is available via npx
if ! command -v npx &> /dev/null; then
    echo "Error: npx is not installed. Please install Node.js."
    exit 1
fi

count=0
find assets -name "*.gltf" -type f | while read gltf_file; do
    # Extract filename without extension and directory
    dir=$(dirname "$gltf_file")
    base=$(basename "$gltf_file" .gltf)
    glb_file="$dir/$base.glb"
    
    echo "Compiling $gltf_file -> $glb_file"
    npx --yes gltf-pipeline -i "$gltf_file" -b -o "$glb_file"
    count=$((count + 1))
done

echo "Done converting $count files to GLB."
