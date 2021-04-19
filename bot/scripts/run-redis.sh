#!/bin/sh

# Start a development Redis instance for development, NEVER use this in production. (without modifications at least)

# Force stop and remove existing Docker containers called redis-airhorn
docker rm --force redis-airhorn
# Prune unused volumes
# WARNING: This may cause problems with other containers if you have volumes that are not used by any other
#   containers but you need them.
docker volume prune --force
# Start the development Redis instance
docker run --name redis-airhorn -p 6379:6379 -d redis --requirepass password
