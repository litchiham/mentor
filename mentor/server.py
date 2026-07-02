"""Mentor Jupyter Server extension."""
import json
import os

from jupyter_server.extension.application import ExtensionApp
from jupyter_server.base.handlers import APIHandler
from traitlets import Unicode, default
from tornado import web

from ._version import __version__
from .handlers.checkpoint import (
    CheckpointListHandler,
    CheckpointHandler,
    KernelFreezeHandler,
    KernelRestoreHandler,
)
from .handlers.agent import AgentChatHandler, AgentTestHandler
from .handlers.workspace import (
    WorkspaceOpenHandler,
    WorkspaceSaveHandler,
    WorkspaceStateHandler,
    DirectoryBrowseHandler,
    DirectoryCreateHandler,
)
from .handlers.plugin import (
    PluginListHandler,
    PluginInstallHandler,
    PluginUninstallHandler,
)


class KernelSpecsHandler(APIHandler):
    """GET /mentor/api/kernelspecs — list available kernel specs."""

    @web.authenticated
    async def get(self):
        km = self.settings.get("kernel_spec_manager")
        if km is None:
            self.write(json.dumps([]))
            return
        specs = km.get_all_specs()
        result = []
        for name, spec in specs.items():
            result.append({
                "name": name,
                "displayName": spec.get("spec", {}).get("display_name", name),
                "language": spec.get("spec", {}).get("language", ""),
            })
        self.write(json.dumps(result))


class MentorApp(ExtensionApp):
    name = "mentor"
    app_name = "mentor"
    extension_url = "/mentor"
    load_other_extensions = []

    @default("static_url_prefix")
    def _default_static_url_prefix(self):
        return "/mentor/static/"

    @default("static_paths")
    def _default_static_paths(self):
        return []

    def initialize_handlers(self):
        base = self.serverapp.web_app.settings["base_url"]
        self.handlers.extend(
            [
                (f"{base}mentor/api/checkpoints", CheckpointListHandler),
                (f"{base}mentor/api/checkpoint/([^/]+)", CheckpointHandler),
                (f"{base}mentor/api/kernel/([^/]+)/freeze", KernelFreezeHandler),
                (
                    f"{base}mentor/api/kernel/([^/]+)/restore/([^/]+)",
                    KernelRestoreHandler,
                ),
                (f"{base}mentor/api/agent/chat", AgentChatHandler),
                (f"{base}mentor/api/agent/test", AgentTestHandler),
                (f"{base}mentor/api/kernelspecs", KernelSpecsHandler),
                (f"{base}mentor/api/workspace/open", WorkspaceOpenHandler),
                (f"{base}mentor/api/workspace/save", WorkspaceSaveHandler),
                (f"{base}mentor/api/workspace/state", WorkspaceStateHandler),
                (f"{base}mentor/api/dir/browse", DirectoryBrowseHandler),
                (f"{base}mentor/api/dir/mkdir", DirectoryCreateHandler),
                (f"{base}mentor/api/plugins", PluginListHandler),
                (f"{base}mentor/api/plugins/install", PluginInstallHandler),
                (f"{base}mentor/api/plugins/uninstall/([^/]+)", PluginUninstallHandler),
            ]
        )

    def initialize_settings(self):
        self.settings.update(
            {
                "mentor_storage_path": os.path.join(
                    self.config_dir, "mentor", "checkpoints"
                ),
            }
        )
