#!/usr/bin/env bash
# Сброс томов Kafka + Zookeeper при InconsistentClusterIdException / unhealthy Kafka.
# Данные Postgres не трогаются.
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
echo "Stopping stack..."
"${COMPOSE[@]}" down
echo "Removing Kafka and Zookeeper volumes (project prefix may vary)..."
while IFS= read -r v; do
  [ -z "$v" ] && continue
  echo "  docker volume rm $v"
  docker volume rm "$v"
done < <(docker volume ls -q | grep -E 'kafka_data$|zookeeper_data$' || true)
echo "Starting stack..."
"${COMPOSE[@]}" up -d
echo "Done. Wait ~2–3 min for Kafka healthcheck."
