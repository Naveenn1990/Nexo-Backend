#!/usr/bin/env node

/**
 * Fix script for whatwg-url module issue
 * Run this on the server after uploading node_modules
 * Usage: node fix-whatwg-url.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking whatwg-url package structure...\n');

const whatwgUrlPath = path.join(__dirname, 'node_modules', 'mongodb-connection-string-url', 'node_modules', 'whatwg-url');
const libUrlPath = path.join(whatwgUrlPath, 'lib', 'URL.js');
const webidlWrapperPath = path.join(whatwgUrlPath, 'webidl2js-wrapper.js');

let issuesFound = false;

// Check if whatwg-url directory exists
if (!fs.existsSync(whatwgUrlPath)) {
  console.error('❌ whatwg-url package not found at:', whatwgUrlPath);
  console.error('   Please ensure node_modules is properly uploaded.');
  process.exit(1);
}

console.log('✅ whatwg-url package found');

// Check if lib directory exists
const libPath = path.join(whatwgUrlPath, 'lib');
if (!fs.existsSync(libPath)) {
  console.error('❌ lib directory missing in whatwg-url');
  issuesFound = true;
} else {
  console.log('✅ lib directory exists');
}

// Check if URL.js exists
if (!fs.existsSync(libUrlPath)) {
  console.error('❌ lib/URL.js file missing!');
  issuesFound = true;
  
  // Try to create a symlink or check if it's in dist/
  const distUrlPath = path.join(whatwgUrlPath, 'dist', 'URL.js');
  if (fs.existsSync(distUrlPath)) {
    console.log('   Found URL.js in dist/ directory');
    console.log('   Creating lib directory and copying files...');
    
    try {
      // Create lib directory if it doesn't exist
      if (!fs.existsSync(libPath)) {
        fs.mkdirSync(libPath, { recursive: true });
      }
      
      // Copy files from dist to lib
      const distPath = path.join(whatwgUrlPath, 'dist');
      const files = fs.readdirSync(distPath);
      
      files.forEach(file => {
        const srcFile = path.join(distPath, file);
        const destFile = path.join(libPath, file);
        if (fs.statSync(srcFile).isFile()) {
          fs.copyFileSync(srcFile, destFile);
          console.log(`   Copied ${file} to lib/`);
        }
      });
      
      console.log('✅ Fixed: Created lib directory with required files');
      issuesFound = false;
    } catch (error) {
      console.error('   Error fixing:', error.message);
    }
  } else {
    console.error('   URL.js not found in dist/ either');
    console.error('   Package appears to be corrupted. Please reinstall.');
  }
} else {
  console.log('✅ lib/URL.js exists');
}

// Check webidl2js-wrapper.js
if (!fs.existsSync(webidlWrapperPath)) {
  console.error('❌ webidl2js-wrapper.js missing!');
  issuesFound = true;
  
  // Create the wrapper file
  try {
    const wrapperContent = `"use strict";

const URL = require("./lib/URL");
const URLSearchParams = require("./lib/URLSearchParams");

exports.URL = URL;
exports.URLSearchParams = URLSearchParams;
`;
    fs.writeFileSync(webidlWrapperPath, wrapperContent);
    console.log('✅ Fixed: Created webidl2js-wrapper.js');
  } catch (error) {
    console.error('   Error creating wrapper:', error.message);
  }
} else {
  console.log('✅ webidl2js-wrapper.js exists');
  
  // Verify it's pointing to the correct path
  const wrapperContent = fs.readFileSync(webidlWrapperPath, 'utf8');
  if (wrapperContent.includes('./lib/URL')) {
    console.log('✅ webidl2js-wrapper.js has correct path');
  } else if (wrapperContent.includes('./dist/URL')) {
    console.log('⚠️  webidl2js-wrapper.js points to dist/ instead of lib/');
    console.log('   Fixing...');
    try {
      const fixedContent = wrapperContent.replace('./dist/', './lib/');
      fs.writeFileSync(webidlWrapperPath, fixedContent);
      console.log('✅ Fixed: Updated webidl2js-wrapper.js to use lib/');
    } catch (error) {
      console.error('   Error fixing wrapper:', error.message);
    }
  }
}

// Final check
if (fs.existsSync(libUrlPath) && fs.existsSync(webidlWrapperPath)) {
  console.log('\n✅ All checks passed! whatwg-url package is properly structured.');
  console.log('   You can now restart your server.');
} else {
  console.log('\n❌ Issues found. Please run: npm install whatwg-url@^11.0.0');
  console.log('   Or reinstall all packages: rm -rf node_modules && npm install');
}

