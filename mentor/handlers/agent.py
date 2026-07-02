"""AI Agent chat handler — uses DeepSeek API (OpenAI-compatible)."""
import json
import traceback
import re

from tornado import web

from .checkpoint import BaseMentorHandler


SYSTEM_PROMPT = """You are Mentor, an AI research assistant embedded in a computational notebook.
You help users analyze data, write code, debug, and understand results.
Be concise and helpful.

## Notebook — Blue Line Rule
Cells above the blue line (marked [read-only]) are locked — you CANNOT modify,
delete, or insert cells before them. You may read them for context.
Cells below the blue line (marked [editable]) are yours to modify freely.
Always add new cells in the editable region. Never modify read-only cells.

## Notebook interaction
You can modify the notebook by including an ACTIONS block at the end of your response.
Use this JSON format after a line containing exactly ---ACTIONS---:

---ACTIONS---
[{"action": "add_code_cell", "source": "print(1+1)"}]

Available actions:
- add_code_cell: append a new code cell at the end. Params: source (string)
- add_markdown_cell: append a new markdown cell at the end. Params: source (string)
- update_cell: replace the source of an existing cell. Params: cellId (string, required), source (string), cellType (optional "code"|"markdown")
- delete_cell: remove a cell. Params: cellId (string, required)
- insert_cell_above: insert a new cell above the given cellId. Params: cellId (string, required), source (string), cellType (optional "code"|"markdown")
- insert_cell_below: insert a new cell below the given cellId. Params: cellId (string, required), source (string), cellType (optional "code"|"markdown")
- execute_from_start: run all code cells from the beginning down to the given cellId. Params: cellId (string, required)
- execute_from_checkpoint: restore the last checkpoint, then run from there down to the given cellId. Params: cellId (string, required)
- execute_step: execute the single cell at cellId (the red-line's next cell). Params: cellId (string, required)

When writing new code, use add_code_cell. When modifying existing cells, use update_cell with the cell's id.
All write actions (update, delete, insert, execute_*) require a valid cellId from the context. Only target editable cells.

## Plugin Tools
If "Available Plugin Tools" are listed in the context, you can use them by writing normal Python code in a code cell.
- Write import statements and function calls as regular Python code (e.g. `from demo_math.tools import quadratic_solver`).
- Use add_code_cell to create a cell with the import and call code.
- Check each tool's parameters, units, and guidelines before writing the code.
- Explain the code and expected results to the user. Do NOT auto-execute — let the user review and run the code.

## Code Execution Policy
- NEVER auto-execute code after writing it. The three execution actions are only for when the user explicitly asks.
- When the user says "运行", "run", "执行", "execute" or similar, choose the right execution mode:
  - Use execute_step to run just the next cell (single step forward from the red-line).
  - Use execute_from_checkpoint to resume from the last checkpoint.
  - Use execute_from_start to re-run everything from the beginning.
- If the user doesn't specify a mode, default to execute_step for the cell the user likely means (e.g. the one just created).
- If the user only asks you to write code or explain something, do not include any execute action.

Keep your reply short and conversational. The actions block is for the machine to execute."""


def _parse_actions(text: str) -> tuple[str, list[dict]]:
    """Split reply from actions block. Returns (reply, actions)."""
    marker = "---ACTIONS---"
    if marker in text:
        parts = text.split(marker, 1)
        reply = parts[0].strip()
        try:
            # Extract JSON array from the actions block
            actions_str = parts[1].strip()
            # Try to find a JSON array
            match = re.search(r'\[[\s\S]*\]', actions_str)
            if match:
                actions = json.loads(match.group())
                return reply, actions
        except (json.JSONDecodeError, Exception):
            pass
        return reply, []
    return text.strip(), []


class AgentTestHandler(BaseMentorHandler):
    """POST /mentor/api/agent/test — test API connectivity."""

    @web.authenticated
    async def post(self):
        body = json.loads(self.request.body)
        api_key = body.get("apiKey", "")
        base_url = body.get("baseUrl", "https://api.deepseek.com/v1")
        model = body.get("model", "deepseek-v4-pro")

        if not api_key:
            self.write(json.dumps({"ok": False, "error": "API Key 未设置"}))
            return

        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=api_key, base_url=base_url)
            response = await client.chat.completions.create(
                model=model,
                temperature=0,
                max_tokens=16,
                messages=[{"role": "user", "content": "Hi"}],
            )
            reply = response.choices[0].message.content or ""
            self.write(json.dumps({"ok": True, "reply": reply}))
        except Exception:
            self.log.error("Agent test error: %s", traceback.format_exc())
            self.write(json.dumps({"ok": False, "error": traceback.format_exc()[:200]}))


class AgentChatHandler(BaseMentorHandler):
    """POST /mentor/api/agent/chat"""

    @web.authenticated
    async def post(self):
        body = json.loads(self.request.body)
        message = body.get("message", "")
        api_config = body.get("apiConfig", {})

        # Parse the rich context object from frontend
        context = body.get("context", {})
        cells = context.get("cells", [])
        blue_line_id = context.get("blueLineCellId")
        red_line_id = context.get("redLineCellId")
        checkpoints = context.get("checkpoints", [])

        provider = api_config.get("provider", "deepseek")
        model = api_config.get("model", "deepseek-v4-pro")
        base_url = api_config.get("baseUrl", "https://api.deepseek.com/v1")
        api_key = api_config.get("apiKey", "")
        temperature = float(api_config.get("temperature", 0.1))
        max_tokens = 8192

        if not api_key:
            self.write(json.dumps({
                "reply": "请在设置中配置 DeepSeek API Key。",
                "actions": [],
            }))
            return

        # Build notebook context (rich format)
        context_parts = ["## Current notebook:\n"]
        if cells:
            for i, cell in enumerate(cells):
                ctype = cell.get("cellType", "code")
                cid = cell.get("id", f"?")
                src = cell.get("source", "")
                read_only = cell.get("readOnly", False)
                tag = "[read-only]" if read_only else "[editable]"
                src_preview = src[:500] + ("..." if len(src) > 500 else "")
                context_parts.append(
                    f"Cell {i} [{cid}] {tag} ({ctype}):\n```\n{src_preview}\n```"
                )
                # Include text outputs if present
                outputs = cell.get("outputs", [])
                if outputs:
                    for o in outputs:
                        if o.get("outputType") == "stream" and o.get("text"):
                            text = o["text"][:500]
                            context_parts.append(f"  Output: {text}")
                        elif o.get("outputType") == "error":
                            ename = o.get("ename", "Error")
                            evalue = o.get("evalue", "")
                            context_parts.append(f"  Error: {ename}: {evalue[:300]}")
        else:
            context_parts.append("(empty notebook — no cells yet)")

        # Blue-line / Red-line
        if blue_line_id:
            context_parts.append(f"\nBlue-line (read-only boundary): cell [{blue_line_id}] — cells above are locked.")
        if red_line_id:
            context_parts.append(f"Red-line (execution marker): cell [{red_line_id}] — last executed cell.")

        # Checkpoints
        if checkpoints:
            cp_lines = ["\n## Active checkpoints:"]
            for cp in checkpoints:
                cp_lines.append(f"- [{cp.get('id','?')}] {cp.get('name','?')} (cell {cp.get('cellIndex','?')})")
            context_parts.extend(cp_lines)

        notebook_context = "\n".join(context_parts)

        self.log.info(
            "Agent chat: provider=%s model=%s message=%.100r cells=%d",
            provider, model, message, len(cells),
        )

        # Discover plugins from the kernel (if available)
        kernel_id = context.get("kernelId")
        tools_text = ""
        if kernel_id:
            try:
                from ..plugin.manager import PluginManager

                code = PluginManager.get_discovery_code()
                raw = await self._run_in_kernel(kernel_id, code, timeout=15)
                # Extract the marker-delimited JSON array
                begin = "---MENTOR_PLUGINS_BEGIN---"
                end = "---MENTOR_PLUGINS_END---"
                if begin in raw and end in raw:
                    inner = raw.split(begin, 1)[1].split(end, 1)[0].strip()
                    manifests = json.loads(inner)
                    tools_text = PluginManager.get_tools_context_text(manifests)
            except Exception:
                self.log.warning("Plugin discovery failed: %s", traceback.format_exc())

        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=api_key, base_url=base_url)

            system_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            if tools_text:
                system_messages.append({"role": "system", "content": tools_text})

            response = await client.chat.completions.create(
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                messages=[
                    *system_messages,
                    {"role": "user", "content": notebook_context},
                    {"role": "user", "content": message},
                ],
            )

            raw = response.choices[0].message.content or ""
            reply, actions = _parse_actions(raw)

            self.write(json.dumps({"reply": reply, "actions": actions}))

        except Exception:
            self.log.error("Agent chat error: %s", traceback.format_exc())
            self.write(json.dumps({
                "reply": f"抱歉，请求失败: {traceback.format_exc()[:300]}",
                "actions": [],
            }))
