-- Migration 0: reset legacy public schema (one-time clean slate)
--
-- The production target (project cssxmqwdeiibewucorjx) was previously
-- initialised with an INCOMPATIBLE older schema built on a different
-- permission model (a `user_role` enum + is_admin()/current_user_role(),
-- tracked as migrations 0001-0006). Its tables shared names with this
-- project's schema (profiles, tasks, departments, ...) but had different
-- columns, so layering this project's idempotent "create ... if not exists"
-- migrations on top would have skipped those tables and left a broken hybrid.
--
-- This migration gives every environment a guaranteed clean public schema
-- before the real schema is built. It then restores the standard Supabase
-- grants and default privileges, which are tied to the schema and are lost
-- when it is dropped. It deliberately does NOT touch the `auth` or `storage`
-- schemas, so existing auth users / logins are preserved.
--
-- Safe on a fresh database: public is empty there, so the drop has no effect.
-- Migrations apply once per environment, so this never re-drops a schema that
-- later migrations have already built.

drop schema if exists public cascade;
create schema public;

alter schema public owner to postgres;
comment on schema public is 'standard public schema';

-- Schema usage for the API roles + owner.
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres;

-- Default privileges: ensure every table / function / sequence created by the
-- later migrations is reachable by the API roles, matching a stock Supabase
-- project (objects are created by the `postgres` role during `db push`).
alter default privileges for role postgres in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
