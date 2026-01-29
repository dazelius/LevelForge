/**
 * LEVELFORGE Auto Converter
 * Watches for JSON file changes and converts to FBX automatically
 * 
 * Usage: npm install && npm start
 */

const chokidar = require('chokidar');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const WATCH_DIR = __dirname;
const BAT_FILE = path.join(__dirname, 'convert_to_fbx.bat');

// Debounce tracking
const lastProcessed = new Map();
const DEBOUNCE_MS = 2000;

console.log('');
console.log('========================================');
console.log('  LEVELFORGE Auto Converter');
console.log('========================================');
console.log('');
console.log(`Watch folder: ${WATCH_DIR}`);
console.log('Watch target: All .json files');
console.log('');
console.log('Auto FBX conversion on JSON save.');
console.log('Press Ctrl+C to stop');
console.log('');

// Check if bat file exists
if (!fs.existsSync(BAT_FILE)) {
    console.error('[ERROR] convert_to_fbx.bat not found!');
    process.exit(1);
}

// Initialize watcher
const watcher = chokidar.watch('*.json', {
    cwd: WATCH_DIR,
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
    }
});

console.log('[Ready] Watching for JSON file changes...');
console.log('');

// Handle file changes
watcher.on('change', (filename) => {
    const fullPath = path.join(WATCH_DIR, filename);
    const now = Date.now();
    const timestamp = new Date().toTimeString().slice(0, 8);
    
    // Debounce check
    const lastTime = lastProcessed.get(filename) || 0;
    if (now - lastTime < DEBOUNCE_MS) {
        return;
    }
    lastProcessed.set(filename, now);
    
    console.log('');
    console.log(`[${timestamp}] Change detected: ${filename}`);
    console.log(`[${timestamp}] Starting FBX conversion...`);
    
    // Run bat file
    const process_bat = spawn('cmd.exe', ['/c', BAT_FILE, fullPath], {
        cwd: WATCH_DIR,
        stdio: 'inherit'
    });
    
    process_bat.on('close', (code) => {
        if (code === 0) {
            console.log(`[${timestamp}] Done: ${filename} -> FBX`);
        } else {
            console.log(`[${timestamp}] Conversion failed (exit code: ${code})`);
        }
        console.log('');
        console.log('Waiting...');
    });
});

watcher.on('add', (filename) => {
    const fullPath = path.join(WATCH_DIR, filename);
    const now = Date.now();
    const timestamp = new Date().toTimeString().slice(0, 8);
    
    // Debounce check
    const lastTime = lastProcessed.get(filename) || 0;
    if (now - lastTime < DEBOUNCE_MS) {
        return;
    }
    lastProcessed.set(filename, now);
    
    console.log('');
    console.log(`[${timestamp}] New file: ${filename}`);
    console.log(`[${timestamp}] Starting FBX conversion...`);
    
    // Run bat file
    const process_bat = spawn('cmd.exe', ['/c', BAT_FILE, fullPath], {
        cwd: WATCH_DIR,
        stdio: 'inherit'
    });
    
    process_bat.on('close', (code) => {
        if (code === 0) {
            console.log(`[${timestamp}] Done: ${filename} -> FBX`);
        } else {
            console.log(`[${timestamp}] Conversion failed (exit code: ${code})`);
        }
        console.log('');
        console.log('Waiting...');
    });
});

watcher.on('error', (error) => {
    console.error('[ERROR]', error);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('');
    console.log('Watcher stopped');
    watcher.close();
    process.exit(0);
});
