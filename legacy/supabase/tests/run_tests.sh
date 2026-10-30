#!/usr/bin/env bash
# Usage: PGHOST=... PGPORT=... PGUSER=postgres ./run_tests.sh
set -euo pipefail
cd "$(dirname "$0")/.."
psql -qc "drop database if exists townaija_test" -c "create database townaija_test" >/dev/null
P="psql -d townaija_test -v ON_ERROR_STOP=1 -q"
$P -f tests/00_supabase_stub.sql >/dev/null
$P -f 01_schema.sql 2>&1 | grep -v NOTICE || true
$P -f 02_storage.sql 2>&1 | grep -v NOTICE || true
$P -f tests/10_full_flow_test.sql
