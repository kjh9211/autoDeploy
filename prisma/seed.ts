// One-time admin account provisioning — not sample/fake data. Ops Console is
// single-admin (docs/PLANNING.md §7), so this is the only way an account
// gets created; there is no sign-up screen.
//
// Usage:
//   OPS_ADMIN_EMAIL=you@example.com OPS_ADMIN_PASSWORD='...' npx prisma db seed
//
// Prints a one-time TOTP provisioning URI — scan it into an authenticator
// app immediately, it is not stored anywhere and cannot be shown again
// (only the secret persists, hashed inputs aside, in the database).

import { prisma } from "../src/lib/db/prisma";
import { hashPassword } from "../src/lib/auth/password";
import { generateTotpSecret, totpProvisioningUri } from "../src/lib/auth/totp";

async function main() {
  const email = process.env.OPS_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.OPS_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "OPS_ADMIN_EMAIL and OPS_ADMIN_PASSWORD env vars are required, e.g.\n" +
        "  OPS_ADMIN_EMAIL=you@example.com OPS_ADMIN_PASSWORD='...' npx prisma db seed",
    );
  }
  if (password.length < 12) {
    throw new Error("OPS_ADMIN_PASSWORD must be at least 12 characters.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin account already exists for ${email} — leaving it as is.`);
    return;
  }

  const totpSecret = generateTotpSecret();
  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: { email, passwordHash, totpSecret },
  });

  console.log(`Created admin account: ${email}`);
  console.log("\nScan this into your authenticator app now (shown once):");
  console.log(totpProvisioningUri(email, totpSecret));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
