#!/usr/bin/env node

/**
 * Fix Quasar UMD Violations
 *
 * This script automatically fixes violations of Quasar UMD rules:
 * 1. Converts self-closing tags on Quasar components (q-*) to proper closing tags
 *
 * Usage: node tools/fix-quasar-umd.js [path]
 *        node tools/fix-quasar-umd.js extensions/
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m'
};

/**
 * Fix self-closing Quasar component tags in content
 * @param {string} content - File content to fix
 * @returns {Object} {fixed: string, changeCount: number}
 */
function fixSelfClosingQuasarTags(content) {
  let changeCount = 0;

  // Regex to match self-closing q-* tags: <q-something ... />
  // This matches: <q-[word] [any attributes] />
  const selfClosingRegex = /<(q-[a-z-]+)([^>]*?)\/>/gi;

  const fixed = content.replace(selfClosingRegex, (match, component, attributes) => {
    changeCount++;
    return `<${component}${attributes}></${component}>`;
  });

  return {fixed, changeCount};
}

/**
 * Fix a single file
 * @param {string} filePath - Path to file to fix
 * @returns {number} Number of changes made
 */
function fixFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const {fixed, changeCount} = fixSelfClosingQuasarTags(content);

    if (changeCount > 0) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      console.log(`${colors.green}✓${colors.reset} ${filePath} - Fixed ${changeCount} violation(s)`);
    }

    return changeCount;
  } catch (error) {
    console.error(`Error fixing file ${filePath}:`, error.message);
    return 0;
  }
}

/**
 * Recursively find all HTML files in a directory
 * @param {string} dir - Directory to search
 * @param {Array} fileList - Accumulator for file paths
 * @returns {Array} List of HTML file paths
 */
function findHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (!file.startsWith('.') && file !== 'node_modules' && file !== '__pycache__') {
        findHtmlFiles(filePath, fileList);
      }
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const searchPath = args[0] || 'extensions/';

  if (!fs.existsSync(searchPath)) {
    console.error(`Error: Path '${searchPath}' does not exist`);
    process.exit(1);
  }

  console.log(`${colors.cyan}Fixing Quasar UMD violations in: ${searchPath}${colors.reset}\n`);

  const stat = fs.statSync(searchPath);
  const files = stat.isDirectory()
    ? findHtmlFiles(searchPath)
    : [searchPath];

  if (files.length === 0) {
    console.log(`${colors.yellow}No HTML files found${colors.reset}`);
    process.exit(0);
  }

  let totalChanges = 0;
  let filesFixed = 0;

  files.forEach(file => {
    const changes = fixFile(file);
    if (changes > 0) {
      filesFixed++;
      totalChanges += changes;
    }
  });

  // Summary
  console.log(`\n${colors.cyan}─────────────────────────────────────${colors.reset}`);
  console.log(`Checked ${files.length} file(s)`);

  if (totalChanges === 0) {
    console.log(`${colors.green}✓ No violations found - nothing to fix!${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Fixed ${totalChanges} violation(s) in ${filesFixed} file(s)${colors.reset}`);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {fixSelfClosingQuasarTags, fixFile};
