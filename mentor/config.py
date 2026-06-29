"""User-level Mentor config stored in Jupyter config directory."""
import json
import os


def get_config_path(config_dir: str) -> str:
    return os.path.join(config_dir, "mentor", "config.json")


def read_config(config_dir: str) -> dict:
    path = get_config_path(config_dir)
    if not os.path.exists(path):
        return {}
    with open(path, "r") as f:
        return json.load(f)


def write_config(config_dir: str, data: dict) -> None:
    path = get_config_path(config_dir)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
