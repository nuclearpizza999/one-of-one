# One of One — handoff to Claude Code

Everything designed so far, arranged so Claude Code can build from it.

```
CLAUDE.md                 rules Claude Code loads every session
SPEC.md                   the full build spec (source of truth)
prototype/one-of-one.html working Make screen: EXIF → card → print PNG
screens/                  fourteen HTML mockups, light and dark; open in a browser
screens/assets/           the photos the mockups use
```

## Start

1. Make this folder a git repo and open it in VS Code.
2. Open Claude Code (Spark icon in the editor toolbar, or `Cmd+Shift+P` → "Claude Code").
3. First prompt:

> Read CLAUDE.md, SPEC.md and prototype/one-of-one.html. Then scaffold the project for build step 1 in SPEC.md (the card renderer as a package) and show me the plan before writing files.

Work the build order in SPEC.md one step at a time. Commit after each.
