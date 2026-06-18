import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const EMAIL = 'chizanum@tradevu.co';

  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.log(`❌ No user found with email ${EMAIL}`);
    return;
  }

  console.log(`Current role: ${user.role}`);

  const updated = await prisma.user.update({
    where: { email: EMAIL },
    data: { role: 'EMPLOYEE', isOrgOwner: false }
  });

  console.log(`✅ Role updated: ${updated.role}`);
  console.log('   You should now see the Employee Self Service view after logging in again.');
}

main()
  .catch((e) => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
