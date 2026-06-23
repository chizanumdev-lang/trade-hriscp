import { prisma } from './src/db.js';
async function test() {
  try {
    const res = await prisma.probationRequest.findMany();
    console.log(res);
  } catch(e) {
    console.error(e);
  }
}
test();
