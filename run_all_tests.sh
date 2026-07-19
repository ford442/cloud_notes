#!/bin/bash
npm run dev > dev.log 2>&1 &
DEV_PID=$!
sleep 5
for script in verification/*.py; do
    echo "Running $script"
    python3 "$script" > "results_$(basename "$script" .py).log" 2>&1
done
kill $DEV_PID
