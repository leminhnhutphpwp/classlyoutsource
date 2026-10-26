#!/usr/bin/env bash
# scripts/setup.sh — compatibility wrapper. The real implementation lives in dev.sh.
exec bash "$(cd "$(dirname "$0")" && pwd)/dev.sh" setup
