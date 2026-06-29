"""Workspace open/save/state and directory browse handlers."""
import json
import os
import uuid

from jupyter_server.base.handlers import APIHandler
from jupyter_server.extension.handler import ExtensionHandlerMixin
from tornado import web

from ..config import read_config, write_config


class BaseWorkspaceHandler(ExtensionHandlerMixin, APIHandler):
    @property
    def config_dir(self):
        return self.serverapp.config_dir


class WorkspaceOpenHandler(BaseWorkspaceHandler):
    """POST /mentor/api/workspace/open
    Body: {"path": "/absolute/path/to/workspace"}
    Creates .mentor/ structure, loads notebook + state + chat + checkpoints."""

    @web.authenticated
    async def post(self):
        body = json.loads(self.request.body)
        workspace_path = body.get("path", "")

        if not workspace_path or not os.path.isdir(workspace_path):
            self.set_status(400)
            self.write(json.dumps({"error": "Invalid workspace path"}))
            return

        mentor_dir = os.path.join(workspace_path, ".mentor")
        checkpoints_dir = os.path.join(mentor_dir, "checkpoints")
        os.makedirs(checkpoints_dir, exist_ok=True)

        # Find .ipynb in workspace root
        notebook = None
        for fname in os.listdir(workspace_path):
            if fname.endswith(".ipynb") and os.path.isfile(os.path.join(workspace_path, fname)):
                try:
                    import nbformat
                    nb = nbformat.read(os.path.join(workspace_path, fname), as_version=4)
                    notebook = nb
                except Exception:
                    pass
                break  # take first .ipynb found

        # Load workspace state
        workspace_state = None
        ws_path = os.path.join(mentor_dir, "workspace.json")
        if os.path.exists(ws_path):
            try:
                with open(ws_path, "r") as f:
                    workspace_state = json.load(f)
            except Exception:
                pass

        # Load chat history
        chat = []
        chat_path = os.path.join(mentor_dir, "chat.json")
        if os.path.exists(chat_path):
            try:
                with open(chat_path, "r") as f:
                    chat = json.load(f)
            except Exception:
                pass

        # Load checkpoint metadata
        cp_meta_path = os.path.join(checkpoints_dir, "checkpoints.json")
        checkpoints = {"head": None, "nodes": {}}
        if os.path.exists(cp_meta_path):
            try:
                with open(cp_meta_path, "r") as f:
                    checkpoints = json.load(f)
            except Exception:
                pass

        # Save lastWorkspace to config
        config = read_config(self.config_dir)
        config["lastWorkspace"] = workspace_path
        write_config(self.config_dir, config)

        self.write(json.dumps({
            "workspace": workspace_path,
            "notebook": notebook,
            "workspaceState": workspace_state,
            "chat": chat,
            "checkpoints": checkpoints,
        }))


class WorkspaceSaveHandler(BaseWorkspaceHandler):
    """POST /mentor/api/workspace/save
    Body: {"path": "/workspace/path", "notebook": nbformat,
           "workspaceState": {...}, "chat": [...]}"""

    @web.authenticated
    async def post(self):
        body = json.loads(self.request.body)
        workspace_path = body.get("path", "")

        if not workspace_path or not os.path.isdir(workspace_path):
            self.set_status(400)
            self.write(json.dumps({"error": "Invalid workspace path"}))
            return

        mentor_dir = os.path.join(workspace_path, ".mentor")
        os.makedirs(mentor_dir, exist_ok=True)

        # Save notebook
        nb_data = body.get("notebook")
        if nb_data:
            # Find existing .ipynb or create new one
            ipynb_path = None
            for fname in os.listdir(workspace_path):
                if fname.endswith(".ipynb"):
                    ipynb_path = os.path.join(workspace_path, fname)
                    break
            if not ipynb_path:
                ipynb_path = os.path.join(workspace_path, "notebook.ipynb")

            try:
                import nbformat
                nb = nbformat.from_dict(nb_data)
                nbformat.write(nb, ipynb_path)
            except Exception as e:
                self.log.error(f"Failed to save notebook: {e}")
                self.set_status(500)
                self.write(json.dumps({"error": str(e)}))
                return

        # Save workspace state
        ws_state = body.get("workspaceState")
        if ws_state:
            ws_path = os.path.join(mentor_dir, "workspace.json")
            with open(ws_path, "w") as f:
                json.dump(ws_state, f, indent=2)

        # Save chat history
        chat = body.get("chat")
        if chat is not None:
            chat_path = os.path.join(mentor_dir, "chat.json")
            with open(chat_path, "w") as f:
                json.dump(chat, f, indent=2)

        self.write(json.dumps({"status": "ok"}))


class DirectoryCreateHandler(BaseWorkspaceHandler):
    """POST /mentor/api/dir/mkdir
    Body: {"parentPath": "/path/to/parent", "name": "new-folder"}"""

    @web.authenticated
    async def post(self):
        body = json.loads(self.request.body)
        parent_path = body.get("parentPath", "")
        name = body.get("name", "").strip()

        if not parent_path or not name:
            self.set_status(400)
            self.write(json.dumps({"error": "Missing parentPath or name"}))
            return

        if not os.path.isdir(parent_path):
            self.set_status(400)
            self.write(json.dumps({"error": "Parent directory does not exist"}))
            return

        if "/" in name or "\\" in name:
            self.set_status(400)
            self.write(json.dumps({"error": "Invalid folder name"}))
            return

        new_path = os.path.join(parent_path, name)
        try:
            os.makedirs(new_path, exist_ok=True)
            self.write(json.dumps({"name": name, "path": new_path}))
        except OSError as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))


class WorkspaceStateHandler(BaseWorkspaceHandler):
    """GET /mentor/api/workspace/state"""

    @web.authenticated
    async def get(self):
        config = read_config(self.config_dir)
        last_workspace = config.get("lastWorkspace")
        exists = False
        if last_workspace:
            exists = os.path.isdir(last_workspace)
        self.write(json.dumps({
            "lastWorkspace": last_workspace,
            "exists": exists,
        }))


class DirectoryBrowseHandler(BaseWorkspaceHandler):
    """GET /mentor/api/dir/browse?path=/some/path
    Returns list of directories and .ipynb files in the given path."""

    @web.authenticated
    async def get(self):
        path = self.get_argument("path", default=None)

        if path is None:
            # Return drive roots on Windows, / on Unix
            if os.name == "nt":
                import string
                roots = []
                for letter in string.ascii_uppercase:
                    root = f"{letter}:\\"
                    if os.path.exists(root):
                        roots.append({"name": root, "path": root})
                self.write(json.dumps({
                    "path": "",
                    "parent": None,
                    "directories": roots,
                    "files": [],
                }))
            else:
                self.write(json.dumps({
                    "path": "/",
                    "parent": None,
                    "directories": [],
                    "files": [],
                }))
            return

        # Security: reject paths with null bytes or that don't exist
        if "\x00" in path or not os.path.isdir(path):
            self.set_status(400)
            self.write(json.dumps({"error": "Invalid path"}))
            return

        path = os.path.abspath(path)
        parent = os.path.dirname(path)
        if parent == path:
            parent = None

        directories = []
        files = []

        try:
            for entry in sorted(os.listdir(path)):
                full = os.path.join(path, entry)
                if entry.startswith("."):
                    continue  # skip hidden files/dirs
                if os.path.isdir(full):
                    directories.append({"name": entry, "path": full})
                elif entry.endswith(".ipynb") and os.path.isfile(full):
                    files.append({"name": entry, "path": full})
        except PermissionError:
            pass

        self.write(json.dumps({
            "path": path,
            "parent": parent,
            "directories": directories,
            "files": files,
        }))
