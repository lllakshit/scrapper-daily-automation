#!/bin/bash
# Vercel Blob Storage Configuration Script
# This script configures your Vercel project with proper Blob storage settings

set -e

echo "🔧 Vercel Blob Storage Configuration"
echo "===================================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Install it first:"
    echo "   npm install -g vercel"
    exit 1
fi

echo "📝 Step 1: Linking to your Vercel project..."
vercel link --yes

echo ""
echo "📝 Step 2: Setting environment variables..."
echo ""

# Prompt for token
read -p "Enter your BLOB_READ_WRITE_TOKEN (or press Enter to skip): " BLOB_TOKEN
if [ ! -z "$BLOB_TOKEN" ]; then
    vercel env add BLOB_READ_WRITE_TOKEN --yes <<< "$BLOB_TOKEN"
    echo "✅ BLOB_READ_WRITE_TOKEN set for production"
fi

echo ""
read -p "Enter your BLOB_STORE_ID (or press Enter to skip): " BLOB_STORE_ID
if [ ! -z "$BLOB_STORE_ID" ]; then
    vercel env add BLOB_STORE_ID --yes <<< "$BLOB_STORE_ID"
    echo "✅ BLOB_STORE_ID set for production"
fi

echo ""
echo "📝 Step 3: Deploying your app..."
vercel deploy --prod

echo ""
echo "✅ Configuration complete!"
echo "🚀 Your app is now deployed with Blob storage configured."
echo ""
echo "Test the resume upload feature in your app."
