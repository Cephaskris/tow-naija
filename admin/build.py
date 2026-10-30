"""Builds the deployable operations dashboard: admin/dist/index.html."""
import os, pathlib

here = pathlib.Path(__file__).parent
body = (here / "index.html").read_text(encoding="utf-8")
url = os.environ.get("CONVEX_URL", "https://charming-donkey-521.convex.cloud").strip().rstrip("/")
body = body.replace("__CONVEX_URL__", url)
page = (
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    '<meta name="robots" content="noindex, nofollow">\n</head>\n<body>\n' + body + "\n</body>\n</html>\n"
)
out = here / "dist"
out.mkdir(exist_ok=True)
(out / "index.html").write_text(page, encoding="utf-8")
print("Built", out / "index.html", f"(connected: {url})" if url else "(no keys: connect screen / demo)")
