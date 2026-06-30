"""REST handlers for checkpoint CRUD, freeze, and restore."""
import importlib
import json
import os
import time
import uuid
import asyncio

from jupyter_server.base.handlers import APIHandler
from jupyter_server.extension.handler import ExtensionHandlerMixin
from tornado import web

from ..checkpoint import serializer
from ..config import read_config


def _get_freeze_code(path: str) -> str:
    importlib.reload(serializer)
    return serializer.get_freeze_code(path)


def _get_restore_code(path: str) -> str:
    importlib.reload(serializer)
    return serializer.get_restore_code(path)


class BaseMentorHandler(ExtensionHandlerMixin, APIHandler):
    @property
    def storage_path(self):
        # Use workspace .mentor/checkpoints/ if a workspace is configured
        config = read_config(self.serverapp.config_dir)
        ws = config.get("lastWorkspace")
        if ws:
            return os.path.join(ws, ".mentor", "checkpoints")
        return self.settings.get(
            "mentor_storage_path",
            os.path.join(self.serverapp.config_dir, "mentor", "checkpoints"),
        )

    def _read_checkpoint_list(self) -> dict:
        meta_path = os.path.join(self.storage_path, "checkpoints.json")
        if not os.path.exists(meta_path):
            return {"head": None, "nodes": {}}
        with open(meta_path, "r") as f:
            return json.load(f)

    def _write_checkpoint_list(self, data: dict) -> None:
        os.makedirs(self.storage_path, exist_ok=True)
        meta_path = os.path.join(self.storage_path, "checkpoints.json")
        with open(meta_path, "w") as f:
            json.dump(data, f, indent=2)

    def _get_state_path(self, checkpoint_id: str) -> str:
        return os.path.join(self.storage_path, f"{checkpoint_id}.dill")

    async def _run_in_kernel(self, kernel_id: str, code: str, timeout: float = 30) -> str:
        """Execute code on a kernel and wait for the result."""
        km = self.serverapp.kernel_manager
        kernel = km.get_kernel(kernel_id)
        if kernel is None:
            raise ValueError(f"Kernel {kernel_id} not found")

        client = kernel.blocking_client()
        client.start_channels()
        try:
            result = await asyncio.to_thread(client.execute_interactive, code, timeout=timeout)
            return str(result)
        finally:
            client.stop_channels()


class CheckpointListHandler(BaseMentorHandler):
    """GET /mentor/api/checkpoints — list all checkpoints
       POST /mentor/api/checkpoints — create a new checkpoint (freeze)"""

    @web.authenticated
    async def get(self):
        data = self._read_checkpoint_list()
        self.write(json.dumps(data))

    @web.authenticated
    async def post(self):
        body = json.loads(self.request.body)
        kernel_id = body.get("kernelId")
        name = body.get("name", "Checkpoint")
        cell_index = body.get("cellIndex", 0)

        if not kernel_id:
            self.set_status(400)
            self.write(json.dumps({"error": "kernelId is required"}))
            return

        checkpoint_id = str(uuid.uuid4())[:8]
        meta = self._read_checkpoint_list()
        state_path = self._get_state_path(checkpoint_id)

        try:
            code = _get_freeze_code(path=state_path)
            reply = await self._run_in_kernel(kernel_id, code)
            self.log.info(f"Freeze reply: {reply}")
        except Exception as e:
            self.log.error(f"Freeze error: {e}")
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))
            return

        new_node = {
            "id": checkpoint_id,
            "name": name,
            "prev": meta.get("head"),
            "timestamp": int(time.time() * 1000),
            "cellIndex": cell_index,
            "kernelStateHash": f"{checkpoint_id}.dill",
            "kernelStatePath": state_path,
        }

        meta["nodes"] = meta.get("nodes", {})
        meta["nodes"][checkpoint_id] = new_node
        meta["head"] = checkpoint_id
        self._write_checkpoint_list(meta)

        self.set_status(201)
        self.write(json.dumps(new_node))


class CheckpointHandler(BaseMentorHandler):
    """GET/DELETE /mentor/api/checkpoint/{id}"""

    @web.authenticated
    async def get(self, checkpoint_id: str):
        meta = self._read_checkpoint_list()
        node = meta.get("nodes", {}).get(checkpoint_id)
        if node is None:
            self.set_status(404)
            self.write(json.dumps({"error": "checkpoint not found"}))
            return
        self.write(json.dumps(node))

    @web.authenticated
    async def delete(self, checkpoint_id: str):
        meta = self._read_checkpoint_list()
        nodes = meta.get("nodes", {})

        if checkpoint_id not in nodes:
            self.set_status(404)
            self.write(json.dumps({"error": "checkpoint not found"}))
            return

        node = nodes[checkpoint_id]
        prev = node.get("prev")
        head = meta.get("head")

        if head == checkpoint_id:
            meta["head"] = prev

        cursor = head
        while cursor is not None:
            n = nodes.get(cursor)
            if n is None:
                break
            if n.get("prev") == checkpoint_id:
                n["prev"] = prev
                break
            cursor = n.get("prev")

        nodes.pop(checkpoint_id)
        state_path = node.get("kernelStatePath") or self._get_state_path(checkpoint_id)
        if os.path.exists(state_path):
            os.remove(state_path)

        self._write_checkpoint_list(meta)
        self.write(json.dumps({"status": "ok"}))


class KernelFreezeHandler(BaseMentorHandler):
    """POST /mentor/api/kernel/{kernel_id}/freeze"""

    @web.authenticated
    async def post(self, kernel_id: str):
        checkpoint_id = str(uuid.uuid4())[:8]
        state_path = self._get_state_path(checkpoint_id)

        try:
            code = _get_freeze_code(path=state_path)
            await self._run_in_kernel(kernel_id, code)
            self.write(json.dumps({"checkpointId": checkpoint_id, "path": state_path}))
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))


class KernelRestoreHandler(BaseMentorHandler):
    """POST /mentor/api/kernel/{kernel_id}/restore/{checkpoint_id}"""

    @web.authenticated
    async def post(self, kernel_id: str, checkpoint_id: str):
        meta = self._read_checkpoint_list()
        node = meta.get("nodes", {}).get(checkpoint_id)
        if node is None:
            self.set_status(404)
            self.write(json.dumps({"error": "checkpoint not found"}))
            return

        state_path = node.get("kernelStatePath") or self._get_state_path(checkpoint_id)

        if not os.path.exists(state_path):
            self.set_status(404)
            self.write(json.dumps({"error": f"State file not found: {state_path}"}))
            return

        try:
            code = _get_restore_code(path=state_path)
            await self._run_in_kernel(kernel_id, code)
            self.write(json.dumps({"status": "ok"}))
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))
