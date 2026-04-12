#!/bin/sh

cleanup() {
    printf '\nCleaning Next.js development caches...\n'
    rm -rf .next/cache .next/trace
    npm cache verify >/dev/null 2>&1 || true
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

next dev
