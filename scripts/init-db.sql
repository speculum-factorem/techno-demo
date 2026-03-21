-- Initialize databases for all microservices
-- IF NOT EXISTS prevents errors on container restart
SELECT 'CREATE DATABASE authdb' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'authdb')\gexec
SELECT 'CREATE DATABASE fielddb' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fielddb')\gexec
SELECT 'CREATE DATABASE weatherdb' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'weatherdb')\gexec
SELECT 'CREATE DATABASE irrigationdb' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'irrigationdb')\gexec
SELECT 'CREATE DATABASE notificationdb' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'notificationdb')\gexec
SELECT 'CREATE DATABASE analyticsdb' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'analyticsdb')\gexec
