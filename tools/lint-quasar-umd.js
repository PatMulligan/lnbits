#!/usr/bin/env node

/**
 * Lint Quasar UMD Compliance
 *
 * This script checks HTML templates for violations of Quasar UMD rules:
 * 1. No self-closing tags on Quasar components (q-*)
 *
 * Usage: node tools/lint-quasar-umd.js [path]
 *        node tools/lint-quasar-umd.js extensions/
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * Find self-closing Quasar component tags in content
 * @param {string} content - File content to check
 * @returns {Array} Array of {line, column, match, component} objects
 */
function findSelfClosingQuasarTags(content) {
  const violations = [];
  const lines = content.split('\n');

  // Regex to match self-closing q-* tags: <q-something ... />
  // This matches: <q-[word] [any attributes] />
  const selfClosingRegex = /<(q-[a-z-]+)([^>]*?)\/>/gi;

  lines.forEach((line, lineIndex) => {
    let match;
    selfClosingRegex.lastIndex = 0; // Reset regex

    while ((match = selfClosingRegex.exec(line)) !== null) {
      violations.push({
        line: lineIndex + 1,
        column: match.index + 1,
        match: match[0],
        component: match[1]
      });
    }
  });

  return violations;
}

/**
 * Check a single file for violations
 * @param {string} filePath - Path to file to check
 * @returns {Object} {violations, content} or null if file can't be read
 */
function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const violations = findSelfClosingQuasarTags(content);
    return {violations, content};
  } catch (error) {
    console.error(`${colors.red}Error reading file ${filePath}:${colors.reset}`, error.message);
    return null;
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
    console.error(`${colors.red}Error: Path '${searchPath}' does not exist${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.cyan}Checking Quasar UMD compliance in: ${searchPath}${colors.reset}\n`);

  const stat = fs.statSync(searchPath);
  const files = stat.isDirectory()
    ? findHtmlFiles(searchPath)
    : [searchPath];

  if (files.length === 0) {
    console.log(`${colors.yellow}No HTML files found${colors.reset}`);
    process.exit(0);
  }

  let totalViolations = 0;
  let filesWithViolations = 0;

  files.forEach(file => {
    const result = checkFile(file);
    if (!result) return;

    const {violations} = result;

    if (violations.length > 0) {
      filesWithViolations++;
      totalViolations += violations.length;

      console.log(`${colors.red}✗${colors.reset} ${file}`);

      violations.forEach(v => {
        console.log(`  ${colors.gray}${v.line}:${v.column}${colors.reset}  ` +
                   `${colors.red}error${colors.reset}  ` +
                   `Self-closing tag on Quasar component ${colors.yellow}<${v.component}>${colors.reset}`);
        console.log(`  ${colors.gray}${v.match}${colors.reset}`);
        console.log(`  ${colors.cyan}Fix: Change to <${v.component}...></${v.component}>${colors.reset}\n`);
      });
    }
  });

  // Summary
  console.log(`\n${colors.cyan}─────────────────────────────────────${colors.reset}`);
  console.log(`Checked ${files.length} file(s)`);

  if (totalViolations === 0) {
    console.log(`${colors.green}✓ No violations found!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}✗ Found ${totalViolations} violation(s) in ${filesWithViolations} file(s)${colors.reset}`);
    console.log(`\n${colors.yellow}Rule: Quasar components must NOT use self-closing tags when using UMD${colors.reset}`);
    console.log(`${colors.gray}See: https://quasar.dev/start/umd/#usage${colors.reset}`);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {findSelfClosingQuasarTags, checkFile};
