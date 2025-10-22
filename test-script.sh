#!/bin/bash

echo "Starting test script..."
echo "Step 1: Testing basic flow"

echo "Step 2: Running migration"
if podman exec -i atlas2-postgres psql -U atlas2 -d atlas2_dev < database/migrations/001_initial_schema.sql; then
    echo "Migration completed"
else
    echo "Migration failed"
fi

echo "Step 3: After migration"
echo "Step 4: Script completed"

echo "All done!"