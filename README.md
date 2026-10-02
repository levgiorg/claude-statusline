# claude-statusline

My Claude Code status line:

```
Opus 5.5 | Effort: xhigh | Ctx: 84.0k | Session ██░░░░░░░░ 24% 2h 29m | Weekly ████████░░ 83% 2d 7h | ⎇ main | (clean)
```

- **Effort**: current reasoning effort, follows `/effort` changes
- **Ctx**: tokens in the context window
- **Session / Weekly**: 5-hour and 7-day usage limits with time to reset (Pro/Max only, appears after the first reply)
- **Git**: branch and `+staged *unstaged ?untracked !conflicts`

## Install

Requires Node and git.

```bash
gh repo clone levgiorg/claude-statusline ~/claude-statusline
node ~/claude-statusline/install.js
```

This copies the script to `~/.claude/statusline-command.js` and sets `statusLine` in `~/.claude/settings.json` (the old file is kept as `settings.json.bak`). Restart Claude Code afterwards.

## Update

```bash
git -C ~/claude-statusline pull && node ~/claude-statusline/install.js
```
