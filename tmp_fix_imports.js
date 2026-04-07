const fs = require('fs');
const path = require('path');

const directoryPath = 'c:\\coding_program_files\\FISH_MARKET\\server\\src';

function replaceInCode(content) {
    let newContent = content;
    const replacements = {
        '../../core/db': '../../config/db',
        '../../core/redis': '../../config/redis',
        '../../core/sentry': '../../config/sentry',
        '../../core/logger': '../../utils/logger',
        '../../core/audioValidator': '../../utils/audioValidator',
        '../../core/types': '../../models/types',
        '../../core/errors': '../../middleware/errors',
        '../../core/auth': '../../middleware/auth',
        '../../core/validation': '../../middleware/validation',
        '../core/auth': '../middleware/auth',
        '../core/errors': '../middleware/errors',
        '../core/redis': '../config/redis',
        '../core/logger': '../utils/logger',
        './core/db': './config/db',
        './core/redis': './config/redis',
        './core/sentry': './config/sentry',
        './core/logger': './utils/logger',
        './core/errors': './middleware/errors',
        './core/auth': './middleware/auth',
    };

    for (const [key, value] of Object.entries(replacements)) {
        newContent = newContent.split(key).join(value);
    }
    return newContent;
}

function processDirectory(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const updated = replaceInCode(content);
            if (content !== updated) {
                fs.writeFileSync(fullPath, updated, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    });
}

processDirectory(directoryPath);
console.log('Done replacing imports');
