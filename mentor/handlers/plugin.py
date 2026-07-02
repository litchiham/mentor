"""REST handlers for plugin management — all kernel-aware.

All plugin discovery, install, and uninstall runs inside the kernel
via _run_in_kernel().
"""

import json
import traceback

from jupyter_server.base.handlers import APIHandler
from jupyter_server.extension.handler import ExtensionHandlerMixin
from tornado import web

from ..plugin.manager import PluginManager
from .checkpoint import BaseMentorHandler


class PluginListHandler(BaseMentorHandler):
    """GET /mentor/api/plugins?kernelId=... — discover plugins via importlib.metadata."""

    @web.authenticated
    async def get(self):
        kernel_id = self.get_argument("kernelId", default=None)
        if not kernel_id:
            self.write(json.dumps([]))
            return

        try:
            code = PluginManager.get_discovery_code()
            raw = await self._run_in_kernel(kernel_id, code, timeout=15)
            manifests = _extract_json(raw)
            self.write(json.dumps(manifests))
        except Exception:
            self.log.error("Plugin list error: %s", traceback.format_exc())
            self.set_status(500)
            self.write(json.dumps({"error": "Failed to list plugins"}))


class PluginInstallHandler(BaseMentorHandler):
    """POST /mentor/api/plugins/install — pip install a package into the kernel.

    Body: {"kernelId": "...", "packageName": "demo-math"}
    """

    @web.authenticated
    async def post(self):
        body = json.loads(self.request.body)
        kernel_id = body.get("kernelId")
        package_name = body.get("packageName", "").strip()

        if not kernel_id:
            self.set_status(400)
            self.write(json.dumps({"error": "kernelId is required"}))
            return
        if not package_name:
            self.set_status(400)
            self.write(json.dumps({"error": "packageName is required"}))
            return

        try:
            code = PluginManager.get_install_code(package_name)
            raw = await self._run_in_kernel(kernel_id, code, timeout=120)
            result = _extract_json(raw)
            if isinstance(result, dict) and result.get("ok"):
                self.set_status(201)
                self.write(json.dumps({"status": "ok", "packageName": package_name}))
            else:
                err = result.get("stderr", "pip install failed") if isinstance(result, dict) else str(result)
                self.set_status(500)
                self.write(json.dumps({"error": str(err)[:500]}))
        except Exception:
            self.log.error("Plugin install error: %s", traceback.format_exc())
            self.set_status(500)
            self.write(json.dumps({"error": "Failed to install plugin"}))


class PluginUninstallHandler(BaseMentorHandler):
    """POST /mentor/api/plugins/uninstall/{name} — pip uninstall from the kernel.

    Body: {"kernelId": "..."}
    """

    @web.authenticated
    async def post(self, name: str):
        body = json.loads(self.request.body)
        kernel_id = body.get("kernelId")

        if not kernel_id:
            self.set_status(400)
            self.write(json.dumps({"error": "kernelId is required"}))
            return

        try:
            code = PluginManager.get_uninstall_code(name)
            raw = await self._run_in_kernel(kernel_id, code, timeout=60)
            result = _extract_json(raw)
            if isinstance(result, dict) and result.get("ok"):
                self.write(json.dumps({"status": "ok"}))
            else:
                err = result.get("stderr", "pip uninstall failed") if isinstance(result, dict) else str(result)
                self.set_status(500)
                self.write(json.dumps({"error": str(err)[:500]}))
        except Exception:
            self.log.error("Plugin uninstall error: %s", traceback.format_exc())
            self.set_status(500)
            self.write(json.dumps({"error": "Failed to uninstall plugin"}))


def _extract_json(raw: str):
    """Extract JSON from kernel output using marker-delimited blocks."""
    s = raw.strip()
    begin = "---MENTOR_PLUGINS_BEGIN---"
    end = "---MENTOR_PLUGINS_END---"
    if begin in s and end in s:
        try:
            inner = s.split(begin, 1)[1].split(end, 1)[0].strip()
            return json.loads(inner)
        except (json.JSONDecodeError, Exception):
            pass
    return s
