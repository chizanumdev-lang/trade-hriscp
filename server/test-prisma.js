import { prisma } from './src/db.js';
console.log(Object.keys(prisma).filter(k => k.toLowerCase().includes('probation')));
process.exit(0);
