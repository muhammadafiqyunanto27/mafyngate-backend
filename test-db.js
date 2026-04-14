const { PrismaClient } = require('./src/config/db');
const prisma = new (require('@prisma/client').PrismaClient)();

async function main() {
  try {
    console.log('Testing DB connection...');
    await prisma.$connect();
    console.log('Connected successfully.');
    
    console.log('Testing Todo query...');
    const count = await prisma.todo.count();
    console.log('Todo count:', count);
    
    process.exit(0);
  } catch (err) {
    console.error('DB Test Failed:', err.message);
    process.exit(1);
  }
}

main();
