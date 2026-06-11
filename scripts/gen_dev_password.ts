/**
 * One-off: generate a scrypt hash for the dev console password.
 * Usage: npx tsx scripts/gen_dev_password.ts '<your password>'
 * Put the printed value in DEV_CONSOLE_PASSWORD_HASH (Vercel env + .env.local).
 */
import { hashPassword } from '../src/lib/dev/password';

const pw = process.argv[2];
if (!pw) {
  console.error("usage: npx tsx scripts/gen_dev_password.ts '<password>'");
  process.exit(1);
}
console.log(hashPassword(pw));
