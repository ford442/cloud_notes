#!/bin/bash
# Start the MOD song indexer from the cloud_notes directory.
# This runs the indexer in the contabo_storage_manager project.

cd "$(dirname "$0")/../contabo_storage_manager" || exit 1
exec venv/bin/python scripts/index_mods.py "$@"
