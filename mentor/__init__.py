from ._version import __version__
from .server import MentorApp


def _jupyter_server_extension_points():
    """Declare the server extension entry point."""
    return [{"module": "mentor.server", "app": MentorApp}]
