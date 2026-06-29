"""AI Agent chat handler — uses DeepSeek API (OpenAI-compatible)."""
import json
import traceback
import re

from jupyter_server.base.handlers import APIHandler
from jupyter_server.extension.handler import ExtensionHandlerMixin
from tornado import web


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
[{"action": "add_code_cell", "source": "print(1+1)"},
 {"action": "run_last_cell"}]

Available actions:
- add_code_cell: add a new code cell. Params: source (string), afterId (optional string - cell ID to insert after)
- add_markdown_cell: add a markdown cell. Params: source (string)
- update_last_cell: replace the source of the last cell. Params: source (string)
- run_last_cell: execute the most recently added/created cell

When the user asks you to write code or create a notebook cell, ALWAYS include the code in an add_code_cell action.
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


class AgentTestHandler(ExtensionHandlerMixin, APIHandler):
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


class AgentChatHandler(ExtensionHandlerMixin, APIHandler):
    """POST /mentor/api/agent/chat"""

    @web.authenticated
    async def post(self):
        body = json.loads(self.request.body)
        message = body.get("message", "")
        cells = body.get("cells", [])
        api_config = body.get("apiConfig", {})

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

        # Build notebook context
        context_parts = ["## Current notebook cells:\n"]
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
        else:
            context_parts.append("(empty notebook — no cells yet)")
        notebook_context = "\n".join(context_parts)

        self.log.info(
            "Agent chat: provider=%s model=%s message=%.100r cells=%d",
            provider, model, message, len(cells),
        )

        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=api_key, base_url=base_url)

            response = await client.chat.completions.create(
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
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
