"""dill-based kernel state freeze/restore code templates."""

FREEZE_CODE = """
import dill, json, os

_user_vars = {{}}
_skip = {{'In', 'Out', 'exit', 'quit', 'get_ipython'}}
for k, v in list(globals().items()):
    if k.startswith('_') or k in _skip:
        continue
    try:
        dill.dumps(v)
        _user_vars[k] = v
    except Exception:
        pass

os.makedirs(os.path.dirname({path!r}), exist_ok=True)
with open({path!r}, 'wb') as _f:
    dill.dump(_user_vars, _f)
print(json.dumps({{"status": "ok", "count": len(_user_vars)}}))
"""

RESTORE_CODE = """
import dill, json

with open({path!r}, 'rb') as _f:
    _saved_vars = dill.load(_f)

_keys_to_del = []
for k in list(globals().keys()):
    if not k.startswith('_') and k not in ('In', 'Out', 'exit', 'quit', 'get_ipython'):
        _keys_to_del.append(k)

for k in _keys_to_del:
    try:
        del globals()[k]
    except Exception:
        pass

globals().update(_saved_vars)
print(json.dumps({{"status": "ok", "count": len(_saved_vars)}}))
"""


def get_freeze_code(path: str) -> str:
    return FREEZE_CODE.format(path=path)


def get_restore_code(path: str) -> str:
    return RESTORE_CODE.format(path=path)
