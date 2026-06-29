"""File-based checkpoint storage with linked list serialization."""
import json
import os
from typing import Optional, Dict, Any


class CheckpointStore:
    """Manages persistent checkpoint metadata and dill state files."""

    def __init__(self, storage_path: str):
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)

    @property
    def _meta_path(self) -> str:
        return os.path.join(self.storage_path, "checkpoints.json")

    def read_list(self) -> dict:
        if not os.path.exists(self._meta_path):
            return {"head": None, "nodes": {}}
        with open(self._meta_path, "r") as f:
            return json.load(f)

    def write_list(self, data: dict) -> None:
        with open(self._meta_path, "w") as f:
            json.dump(data, f, indent=2)

    def get_state_path(self, checkpoint_id: str) -> str:
        return os.path.join(self.storage_path, f"{checkpoint_id}.dill")

    def delete_state(self, checkpoint_id: str) -> None:
        state_path = self.get_state_path(checkpoint_id)
        if os.path.exists(state_path):
            os.remove(state_path)

    def truncate_after(self, checkpoint_id: str) -> list:
        """Remove all nodes after checkpoint_id in the linked list.
        Returns list of removed checkpoint IDs."""
        data = self.read_list()
        head = data.get("head")
        nodes = data.get("nodes", {})

        if head is None or checkpoint_id not in nodes:
            return []

        removed = []
        cursor = head
        while cursor is not None:
            node = nodes.get(cursor)
            if node is None:
                break
            if cursor == checkpoint_id:
                break
            removed.append(cursor)
            cursor = node.get("prev")

        for rid in removed:
            nodes.pop(rid, None)
            self.delete_state(rid)

        data["head"] = checkpoint_id
        self.write_list(data)
        return removed
