Set-StrictMode -Version Latest

npx concurrently --names "bundler,server" `
    "npx webpack --watch --mode=production" `
    "npx browser-sync start --server '.' --files '.'"
