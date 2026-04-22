const fs = require('fs');
const path = require('path');

const filePath = 'd:/mafynGate/backend/src/modules/user/user.controller.js';
let content = fs.readFileSync(filePath, 'utf8');

const brokenBlock = `participants: {
            some: { userId: userId },
            every: { userId: { in: [userId, targetId] } },
            ...(userId !== targetId && {
              AND: [
                { some: { userId: userId } },
                { some: { userId: targetId } }
              ]
            })
          }`;

const fixedBlock = `AND: [
            { participants: { some: { userId: userId } } },
            { participants: { some: { userId: targetId } } },
            { participants: { every: { userId: { in: [userId, targetId] } } } }
          ]`;

// Replacing both occurrences (deleteFullConversation and togglePinConversation)
const newContent = content.split(brokenBlock).join(fixedBlock);

if (content === newContent) {
    console.error('MATCH FAILED: Could not find the broken block. Checking for whitespace issues...');
    // Try a more flexible regex if exact match fails
    const regex = /participants:\s*{\s*some:\s*{\s*userId:\s*userId\s*},\s*every:\s*{\s*userId:\s*{\s*in:\s*\[userId,\s*targetId\]\s*}\s*},\s*\.\.\.\(userId\s*!==\s*targetId\s*&&\s*{\s*AND:\s*\[\s*{\s*some:\s*{\s*userId:\s*userId\s*}\s*},\s*{\s*some:\s*{\s*userId:\s*targetId\s*}\s*}\s*\]\s*}\)\s*}\s*}/g;
    const regexContent = content.replace(regex, fixedBlock);
    if (content === regexContent) {
        console.error('REGEX FAILED: No match found.');
        process.exit(1);
    } else {
        fs.writeFileSync(filePath, regexContent, 'utf8');
        console.log('SUCCESS: Fixed using regex.');
    }
} else {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('SUCCESS: Fixed using exact match.');
}
