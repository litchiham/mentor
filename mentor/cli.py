"""Mentor CLI — one-click launcher for backend + frontend."""
import subprocess
import sys
import os
import time
import atexit
import signal
import webbrowser
import threading
import urllib.request
import urllib.error

PROCS: list[subprocess.Popen] = []


def cleanup():
    for p in PROCS:
        try:
            p.terminate()
            p.wait(timeout=5)
        except Exception:
            p.kill()


def _stream_output(pipe, prefix: str):
    """Read lines from a pipe and print with prefix."""
    try:
        for line in pipe:
            sys.stdout.write(f"{prefix}{line}")
    except Exception:
        pass


def main():
    atexit.register(cleanup)
    signal.signal(signal.SIGINT, lambda *_: sys.exit(0))
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))

    mentor_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    web_dir = os.path.join(mentor_dir, "web")

    # 1. Start jupyter_server headless
    print("[mentor] Starting jupyter_server (headless)...")
    jp = subprocess.Popen(
        [sys.executable, "-m", "jupyter_server",
         "--no-browser",
         "--port=8888",
         "--ip=127.0.0.1",
         "--ServerApp.open_browser=False",
         "--ServerApp.token=",
         "--IdentityProvider.hashed_password=",
         "--ServerApp.disable_check_xsrf=True",
         "--ServerApp.allow_origin=*",
         "--ServerApp.allow_origin_pat=.*"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
    )
    PROCS.append(jp)
    threading.Thread(target=_stream_output, args=(jp.stdout, "[jupyter] "), daemon=True).start()

    # Wait for jupyter_server to be ready
    print("[mentor] Waiting for jupyter_server to be ready...")
    for _ in range(60):
        time.sleep(0.5)
        if jp.poll() is not None:
            print(f"[mentor] jupyter_server exited early with code {jp.returncode}")
            sys.exit(1)
        try:
            req = urllib.request.urlopen("http://127.0.0.1:8888/api/status", timeout=2)
            if req.status == 200:
                print("[mentor] jupyter_server is ready.")
                break
        except Exception:
            pass
    else:
        print("[mentor] jupyter_server failed to start within 30s.")
        sys.exit(1)

    # 2. Start Vite dev server
    print("[mentor] Starting Vite dev server...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    vite = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=web_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
    )
    PROCS.append(vite)
    threading.Thread(target=_stream_output, args=(vite.stdout, "[vite] "), daemon=True).start()
    time.sleep(2)

    # 3. Open browser
    url = "http://localhost:5173"
    print(f"[mentor] Opening {url}")
    webbrowser.open(url)

    # 4. Keep alive
    try:
        while True:
            time.sleep(1)
            # Check if processes are still alive
            if jp.poll() is not None:
                print(f"[mentor] jupyter_server exited with code {jp.returncode}")
                break
            if vite.poll() is not None:
                print(f"[mentor] Vite exited with code {vite.returncode}")
                break
    except KeyboardInterrupt:
        pass

    print("\n[mentor] Shutting down...")
    cleanup()
    sys.exit(0)


if __name__ == "__main__":
    main()
