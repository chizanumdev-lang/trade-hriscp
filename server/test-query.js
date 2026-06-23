const { PrismaClient } = require('@prisma/client');
console.log(Object.keys(new PrismaClient()).filter(k => k.toLowerCase().includes('probation')));
