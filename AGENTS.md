<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git Multi-Device Policy

- **Personal Device (Primary Source of Truth)**: `Zulkhairees-MacBook-Air.local` (This machine).
- **Work Device (Secondary)**: Any machine with a different hostname.

## Rules for Secondary (Work) Devices:
1. **PAUSE Git Pushes**: The AI must NOT run `git push` automatically on a work machine. Always stop and ask for explicit user confirmation.
2. **Commit Receipts**: Every commit made from a work machine must include the tag `[Work-Machine]` in the commit message so the personal laptop can identify the source.
3. **Sync Priority**: If there is a conflict, always favor the state of the personal laptop.
