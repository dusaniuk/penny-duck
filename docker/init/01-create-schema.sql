CREATE SCHEMA IF NOT EXISTS app;

-- Test database for e2e tests
-- \gexec is a psql meta-command that executes the query result as a statement
-- (PostgreSQL has no CREATE DATABASE IF NOT EXISTS)
SELECT 'CREATE DATABASE penny_duck_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'penny_duck_test')\gexec

\c penny_duck_test
CREATE SCHEMA IF NOT EXISTS app;
