#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";

function readArg(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const username = (readArg("username") ?? process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();
const password = readArg("password") ?? process.env.ADMIN_PASSWORD ?? "";
const salt = readArg("salt") ?? process.env.ADMIN_PASSWORD_SALT ?? randomBytes(16).toString("hex");

if (!username || !password) {
  console.error(`Usage:
  node scripts/create-admin-seed.mjs --username=admin --password='change-me'

Or with environment variables:
  ADMIN_USERNAME=admin ADMIN_PASSWORD='change-me' npm run seed:admin
`);
  process.exit(1);
}

const passwordHash = createHash("sha256").update(`${salt}:${password}`).digest("hex");

console.log(`-- Paste this into the Supabase SQL editor, or run it with psql/supabase db execute.
-- Username: ${username}
-- Generated at: ${new Date().toISOString()}

insert into public.admin_accounts (username, password_hash, password_salt, active)
values (${sqlString(username)}, ${sqlString(passwordHash)}, ${sqlString(salt)}, true)
on conflict (username) do update set
  password_hash = excluded.password_hash,
  password_salt = excluded.password_salt,
  active = true;
`);
