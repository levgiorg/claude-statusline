#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT_NAME = 'statusline-command.js';
const claudeDir = path.join(os.homedir(), '.claude');
const settingsPath = path.join(claudeDir, 'settings.json');
const localSettingsPath = path.join(claudeDir, 'settings.local.json');

function readJson(file) {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(file + ' is not valid JSON, fix it and rerun: ' + e.message);
  }
}

function install() {
  fs.mkdirSync(claudeDir, { recursive: true });

  const target = path.join(claudeDir, SCRIPT_NAME);
  fs.copyFileSync(path.join(__dirname, SCRIPT_NAME), target);

  // Forward slashes work for node on Windows and survive both cmd and Git Bash
  const command = 'node "' + target.split(path.sep).join('/') + '"';
  const settings = readJson(settingsPath);
  if (fs.existsSync(settingsPath)) fs.copyFileSync(settingsPath, settingsPath + '.bak');
  const updated = Object.assign({}, settings, { statusLine: { type: 'command', command: command } });
  fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2) + '\n');

  console.log('Installed ' + target);
  console.log('statusLine set in ' + settingsPath);

  if (readJson(localSettingsPath).statusLine) {
    console.warn('Warning: ' + localSettingsPath + ' has its own statusLine, which overrides settings.json. Remove it to use this one.');
  }
}

try {
  install();
} catch (e) {
  console.error('Install failed: ' + e.message);
  process.exit(1);
}
