#!/bin/sh
set -eu

# Supervisor may make /data and options.json root-only. Give the application
# group traversal (not listing/write access), and keep its writable files private.
chown 0:1000 /data
chmod 710 /data
mkdir -p /data/flybudget
chown -R 1000:1000 /data/flybudget
chmod 700 /data/flybudget
# The root shell opens the Supervisor file before gosu drops privileges. Pass an
# inherited read-only descriptor instead of changing the file's owner or mode.
exec /usr/bin/tini -- gosu node:node node /app/ha-launch.cjs < /data/options.json
