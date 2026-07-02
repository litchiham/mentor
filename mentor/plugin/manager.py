"""Plugin manager — generates Python code for kernel injection.

All plugin operations (discovery, install, uninstall) run inside the
kernel via _run_in_kernel(). This module *generates* the code strings;
it does not manipulate the filesystem directly.
"""

import json
from typing import Optional


class PluginManager:
    """Generates Python code strings for kernel-side plugin operations."""

    DISCOVERY_CODE = r"""
import json, sys

_plugins = []
try:
    from importlib.metadata import entry_points
    try:
        _eps = entry_points(group='mentor.plugins')
    except TypeError:
        _eps = entry_points().get('mentor.plugins', [])

    for _ep in _eps:
        try:
            _pkg = _ep.value if hasattr(_ep, 'value') else _ep.name
            from importlib.resources import files
            _text = files(_pkg).joinpath('manifest.json').read_text(encoding='utf-8')
            _manifest = json.loads(_text)
            _manifest['_python_module'] = _pkg
            _plugins.append(_manifest)
        except Exception:
            pass
except Exception:
    pass

sys.stdout.write('---MENTOR_PLUGINS_BEGIN---\n')
sys.stdout.write(json.dumps(_plugins) + '\n')
sys.stdout.write('---MENTOR_PLUGINS_END---\n')
""".strip()

    @staticmethod
    def get_discovery_code() -> str:
        """Return Python code that prints a JSON array of plugin manifests."""
        return PluginManager.DISCOVERY_CODE

    # ---- install / uninstall ----

    @staticmethod
    def get_install_code(package_name: str) -> str:
        """Return Python code to pip-install a package in the kernel."""
        name = json.dumps(package_name)
        return (
            "import subprocess, sys, json\n"
            f"_result = subprocess.run([sys.executable, '-m', 'pip', 'install', {name}], capture_output=True, text=True)\n"
            "sys.stdout.write('---MENTOR_PLUGINS_BEGIN---\\n')\n"
            "sys.stdout.write(json.dumps({'ok': _result.returncode == 0, 'stdout': _result.stdout, 'stderr': _result.stderr}) + '\\n')\n"
            "sys.stdout.write('---MENTOR_PLUGINS_END---\\n')\n"
        )

    @staticmethod
    def get_uninstall_code(package_name: str) -> str:
        """Return Python code to pip-uninstall a package from the kernel."""
        name = json.dumps(package_name)
        return (
            "import subprocess, sys, json\n"
            f"_result = subprocess.run([sys.executable, '-m', 'pip', 'uninstall', '-y', {name}], capture_output=True, text=True)\n"
            "sys.stdout.write('---MENTOR_PLUGINS_BEGIN---\\n')\n"
            "sys.stdout.write(json.dumps({'ok': _result.returncode == 0, 'stdout': _result.stdout, 'stderr': _result.stderr}) + '\\n')\n"
            "sys.stdout.write('---MENTOR_PLUGINS_END---\\n')\n"
        )

    # ---- AI context generation ----

    @staticmethod
    def get_tools_context_text(manifests: list[dict]) -> str:
        """Generate a text block describing plugin tools/data for AI prompt injection.

        Takes the already-discovered manifest list (from kernel discovery).
        """
        if not manifests:
            return ""

        lines = ["## Available Plugin Tools\n"]
        lines.append(
            "Import and use these plugins by writing normal Python code in code cells. "
            "Do NOT call them via actions — write regular `from X import Y` / `X.Y()` Python code.\n"
        )

        for p in manifests:
            name = p.get("name", "?")
            desc = p.get("description", "")
            guide = p.get("guidelines", "")
            pymod = p.get("_python_module", p.get("python_module", ""))

            lines.append(f"### Plugin: {name}")
            lines.append(f"{desc}")
            if guide:
                lines.append(f"Guidelines: {guide}")
            if pymod:
                lines.append(f"Import: `from {pymod}.tools import ...` or `from {pymod}.data import ...`")
            lines.append("")

            for tool in p.get("tools", []):
                tname = tool.get("name", "?")
                tdesc = tool.get("description", "")
                tguide = tool.get("guidelines", "")
                func_ref = tool.get("function", "")
                lines.append(f"**Tool: {name}.{tname}**")
                lines.append(f"  Description: {tdesc}")
                if tguide:
                    lines.append(f"  Guidelines: {tguide}")
                if func_ref:
                    lines.append(f"  Usage: `from {func_ref.split(':')[0]} import {func_ref.split(':')[1]}`")
                params = tool.get("parameters", {})
                if params:
                    lines.append("  Parameters:")
                    for pname, pinfo in params.items():
                        unit = f" ({pinfo.get('unit')})" if pinfo.get('unit') else ""
                        lines.append(f"    - {pname}: {pinfo.get('type', '?')}{unit} — {pinfo.get('description', '')}")
                returns = tool.get("returns")
                if returns:
                    unit = f" ({returns.get('unit')})" if returns.get('unit') else ""
                    lines.append(f"  Returns: {returns.get('type', '?')}{unit} — {returns.get('description', '')}")
                lines.append("")

            for data in p.get("data", []):
                dname = data.get("name", "?")
                ddesc = data.get("description", "")
                loader = data.get("loader", "?")
                dguide = data.get("guidelines", "")
                lines.append(f"**Data: {name}.{dname}**")
                lines.append(f"  Description: {ddesc}")
                if dguide:
                    lines.append(f"  Guidelines: {dguide}")
                lines.append(f"  Loader: {loader}")
                dparams = data.get("parameters", {})
                if dparams:
                    lines.append("  Parameters:")
                    for pname, pinfo in dparams.items():
                        default_hint = ""
                        if not pinfo.get("required", True):
                            default_hint = " (optional)"
                        unit = f" ({pinfo.get('unit')})" if pinfo.get('unit') else ""
                        lines.append(f"    - {pname}: {pinfo.get('type', '?')}{unit}{default_hint} — {pinfo.get('description', '')}")
                returns = data.get("returns")
                if returns:
                    lines.append(f"  Returns: {returns.get('type', '?')} — {returns.get('description', '')}")
                lines.append("")

        return "\n".join(lines)
