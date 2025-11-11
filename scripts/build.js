#!/usr/bin/env node

// Build script to work around Render path resolution issues
const { execSync } = require('child_process');
const path = require('path');

process.chdir(path.resolve(__dirname, '../'));

console.log('Building React app...');
console.log('Current directory:', process.cwd());
console.log('Src directory exists:', require('fs').existsSync(path.join(process.cwd(), 'src')));

try {
  execSync('npx react-scripts build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      SKIP_PREFLIGHT_CHECK: 'true',
      GENERATE_SOURCEMAP: 'false',
    },
  });
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}

