const fs = require('fs');
const filePath = 'd:/mafynGate/backend/src/modules/user/user.controller.js';
let content = fs.readFileSync(filePath, 'utf8');

// The regex previously replaced the block but might have messed up the braces.
// Let's fix the specific pattern that was created.

const brokenPattern = `where: {
          AND: [
            { participants: { some: { userId: userId } } },
            { participants: { some: { userId: targetId } } },
            { participants: { every: { userId: { in: [userId, targetId] } } } }
          ]
      });`;

const fixedPattern = `where: {
          AND: [
            { participants: { some: { userId: userId } } },
            { participants: { some: { userId: targetId } } },
            { participants: { every: { userId: { in: [userId, targetId] } } } }
          ]
        }
      });`;

const newContent = content.split(brokenPattern).join(fixedPattern);

if (content === newContent) {
    console.log('Exact match failed, trying flexible replacement for missing brace.');
    const regex = /where:\s*{\s*AND:\s*\[[\s\S]*?\]\s*}\s*\);/g;
    // We want where: { AND: [...] } });
    const betterRegex = /where:\s*{\s*AND:\s*\[[\s\S]*?\]\s*}(?!\s*})/g; 
    // Actually let's just use a very safe replace
    content = content.replace(/where: {\s*AND: \[\s*\{ participants: \{ some: \{ userId: userId \} \} \},\s*\{ participants: \{ some: \{ userId: targetId \} \} \},\s*\{ participants: \{ every: \{ userId: \{ in: \[userId, targetId\] \} \} \} \}\s*\]\s*}\s*\);/g, 
                             `where: {
          AND: [
            { participants: { some: { userId: userId } } },
            { participants: { some: { userId: targetId } } },
            { participants: { every: { userId: { in: [userId, targetId] } } } }
          ]
        }
      });`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('SUCCESS: Fixed syntax error.');
} else {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('SUCCESS: Fixed syntax error with exact match.');
}
