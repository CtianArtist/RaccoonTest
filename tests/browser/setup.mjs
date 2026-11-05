import { clerkSetup } from '@clerk/testing/playwright';

export default async function setup() {
  if (process.env.E2E_ALLOW_DEVELOPMENT_WRITES !== '1')
    throw new Error('Set E2E_ALLOW_DEVELOPMENT_WRITES=1 only for the development database and Clerk tenant.');
  if (!process.env.CLERK_SECRET_KEY?.startsWith('sk_test_'))
    throw new Error('Browser regression tests require the managed Clerk DEVELOPMENT tenant.');
  if (!process.env.DATABASE_URL) throw new Error('Development DATABASE_URL is required for isolated fixtures.');
  await clerkSetup({ dotenv: false });
}
