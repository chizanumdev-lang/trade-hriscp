import { prisma } from './src/db.js';

async function run() {
  try {
    const p1 = prisma.offboarding.findMany();
    const p2 = prisma.probationRequest.findMany();
    const p3 = prisma.profileUpdateRequest.findMany();
    
    await Promise.all([p1, p2, p3]);
    console.log("All success");
  } catch(e) {
    console.log("ERROR", e);
  }
}
run();
