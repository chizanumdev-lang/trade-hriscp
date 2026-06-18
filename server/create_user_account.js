import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const EMAIL = 'chizanum@tradevu.co';
  const PASSWORD = 'Welcome123!';

  // 1. Check if a User login account already exists
  const existingUser = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existingUser) {
    console.log('✅ User account already exists:');
    console.log(`   Email: ${existingUser.email}`);
    console.log(`   Role: ${existingUser.role}`);
    console.log('   → The password hash may be wrong. Resetting password...');
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const updated = await prisma.user.update({
      where: { email: EMAIL },
      data: { passwordHash }
    });
    console.log(`   ✅ Password reset for ${updated.email}`);
    return;
  }

  // 2. Find the existing Employee record
  const employee = await prisma.employee.findFirst({ where: { email: EMAIL } });
  if (!employee) {
    console.log(`❌ No employee found with email ${EMAIL}`);
    console.log('   You need to create the employee first, or check the email spelling.');
    return;
  }
  console.log(`✅ Found employee: ${employee.fullName} (id: ${employee.id})`);

  // 3. Hash password and create User
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash,
      role: 'SUPER_ADMIN',
      organizationId: employee.organizationId,
      employeeId: employee.id,
      isOrgOwner: true,
    }
  });

  console.log('🎉 User account created successfully!');
  console.log(`   Email: ${user.email}`);
  console.log(`   Role:  ${user.role}`);
  console.log(`   Login with password: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
