const prisma = require('./src/config/db');

async function main() {
  try {
    console.log('Testing App Prisma Client...');
    const users = await prisma.user.findMany({ take: 1 });
    if (users.length === 0) {
      console.log('No users found in DB.');
      process.exit(0);
    }
    
    const userId = users[0].id;
    console.log(`Testing Todo query for user: ${userId}`);
    const count = await prisma.todo.count({
      where: { user_id: userId }
    });
    console.log('Todo count for user:', count);
    
    console.log('Testing Activities query...');
    const activities = await prisma.activity.findMany({
      where: { user_id: userId },
      take: 1
    });
    console.log('Activities found:', activities.length);
    
    process.exit(0);
  } catch (err) {
    console.error('App DB Test Failed:', err);
    process.exit(1);
  }
}

main();
