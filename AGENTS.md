<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

## Git 工作流

- **默认规则**：任务执行前 `git pull`；工作到达可验证节点（实现完成、修复完成、阶段产出）后**一律自动 `git commit` + `git push`**，无需等待用户确认，也不必等到 finish-work——push 同时触发 GitHub Pages 部署供真机验收
- **特例**：仅当用户主动要求暂缓/跳过 pull、commit 或 push 时才不执行，该要求仅对当次生效
- 本节规则优先于任何"任务中途不提交"的默认约定
