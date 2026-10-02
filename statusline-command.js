#!/usr/bin/env node
'use strict';

const cp = require('child_process');

// Colors matching ccstatusline's original scheme
const C_MODEL   = '\x1b[38;5;30m';   // dark teal
const C_EFFORT  = '\x1b[38;5;133m';  // magenta
const C_CTX     = '\x1b[38;5;59m';   // gray
const C_SESSION = '\x1b[38;5;70m';   // green
const C_GIT1    = '\x1b[38;5;96m';   // purple  (⎇ branch)
const C_GIT2    = '\x1b[38;5;178m';  // orange  ((status))
const C_DIM     = '\x1b[90m';
const C_ORANGE  = '\x1b[38;5;214m';
const C_RED     = '\x1b[31m';
const RST       = '\x1b[39m';
const SEP       = ' | ';

function bar(pct, clr, width) {
  width = width || 10;
  const filled = Math.min(width, Math.round(pct / 100 * width));
  return clr + '█'.repeat(filled) + C_DIM + '░'.repeat(width - filled);
}

function urgencyColor(pct, defaultColor) {
  if (pct >= 75) return C_RED;
  if (pct >= 50) return C_ORANGE;
  return defaultColor;
}

function countdown(epochSecs) {
  if (!epochSecs) return null;
  const ms = epochSecs * 1000 - Date.now();
  if (ms <= 0) return null;
  const totalMins = Math.floor(ms / 60000);
  const totalHours = Math.floor(totalMins / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const mins = totalMins % 60;
  if (days > 0) return days + 'd' + (hours > 0 ? ' ' + hours + 'h' : '');
  if (hours > 0) return hours + 'h' + (mins > 0 ? ' ' + mins + 'm' : '');
  return mins + 'm';
}

function formatTokens(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

function usageBar(label, window) {
  if (!window || window.used_percentage == null) return null;
  const pct = Math.round(window.used_percentage);
  const clr = urgencyColor(pct, C_SESSION);
  const cd = countdown(window.resets_at);
  return clr + label + ' ' + bar(pct, clr) + ' ' + clr + pct + '%' + (cd ? clr + ' ' + cd : '') + RST;
}

function getGitBranch() {
  try {
    const b = cp.execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore','pipe','ignore'], timeout: 1000, encoding: 'utf8' }).trim();
    return b && b !== 'HEAD' ? b : null;
  } catch (e) { return null; }
}

function getGitStatus() {
  try {
    const out = cp.execSync('git status --porcelain', { stdio: ['ignore','pipe','ignore'], timeout: 1000, encoding: 'utf8' });
    const lines = out.trim().split('\n').filter(Boolean);
    if (!lines.length) return null;
    let staged = 0, unstaged = 0, untracked = 0, conflicts = 0;
    for (const ln of lines) {
      const x = ln[0], y = ln[1];
      if (x === '?' && y === '?') { untracked++; continue; }
      if (x !== ' ' && x !== '?') staged++;
      if (y !== ' ' && y !== '?') unstaged++;
      if (x === 'U' || y === 'U') conflicts++;
    }
    const p = [];
    if (staged > 0)    p.push('+' + staged);
    if (unstaged > 0)  p.push('*' + unstaged);
    if (untracked > 0) p.push('?' + untracked);
    if (conflicts > 0) p.push('!' + conflicts);
    return p.length ? p.join(' ') : null;
  } catch (e) { return null; }
}

function render(raw) {
  let ctxData = null;
  try { ctxData = JSON.parse(raw); } catch (e) {}

  const parts = [];

  // Model name
  const model = ctxData && ctxData.model;
  const modelName = model && (model.display_name || model.id);
  if (modelName) {
    parts.push(C_MODEL + modelName.replace(/\s*\(.*\)$/, '') + RST);
  }

  // Reasoning effort (absent when the model doesn't support it)
  const effort = ctxData && ctxData.effort && ctxData.effort.level;
  if (effort) {
    parts.push(C_EFFORT + 'Effort: ' + effort + RST);
  }

  // Context window
  const cw = ctxData && ctxData.context_window;
  if (cw) {
    let usedTokens = null;
    if (cw.current_usage && typeof cw.current_usage === 'object') {
      const u = cw.current_usage;
      usedTokens = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
    } else if (cw.used_percentage != null && cw.context_window_size != null) {
      usedTokens = Math.round(cw.used_percentage / 100 * cw.context_window_size);
    }
    if (usedTokens !== null) {
      parts.push(C_CTX + 'Ctx: ' + formatTokens(usedTokens) + RST);
    } else if (cw.used_percentage != null) {
      parts.push(C_CTX + 'Ctx: ' + Math.round(cw.used_percentage) + '%' + RST);
    }
  }

  // Session and weekly usage, sent by Claude Code after the first API response
  const limits = (ctxData && ctxData.rate_limits) || {};
  const sessionBar = usageBar('Session', limits.five_hour);
  if (sessionBar) parts.push(sessionBar);
  const weeklyBar = usageBar('Weekly', limits.seven_day);
  if (weeklyBar) parts.push(weeklyBar);

  // Git (two parts matching ccstatusline format)
  const branch = getGitBranch();
  if (branch) {
    parts.push(C_GIT1 + '⎇ ' + branch + RST);
    const status = getGitStatus();
    parts.push(C_GIT2 + '(' + (status || 'clean') + ')' + RST);
  } else {
    parts.push(C_GIT1 + '⎇ no git' + RST);
    parts.push(C_GIT2 + '(no git)' + RST);
  }

  process.stdout.write('\x1b[0m' + parts.join(SEP));
}

// Read stdin (Claude Code sends session JSON), 300ms timeout fallback
let raw = '';
let fired = false;
function go() { if (fired) return; fired = true; render(raw); }

const timer = setTimeout(go, 300);
process.stdin.setEncoding('utf8');
process.stdin.on('data', function(c) { raw += c; });
process.stdin.on('end',  function()  { clearTimeout(timer); go(); });
process.stdin.on('error',function()  { clearTimeout(timer); go(); });
