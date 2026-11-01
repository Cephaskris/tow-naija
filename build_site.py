"""Builds the public website into dist/:
  dist/index.html        landing page (from landing/index.html)
  dist/admin/index.html  admin dashboard (from admin/index.html)
Environment variables (all optional):
  SUPABASE_URL, SUPABASE_ANON_KEY  connect the admin dashboard
  APK_URL        "Download for Android" link (e.g. your GitHub Releases page)
  COMMISSION     commission % shown to operators (default 10)
  SUPPORT_PHONE, SUPPORT_EMAIL     shown in the footer"""
import os, pathlib, shutil, subprocess, sys

root = pathlib.Path(__file__).parent
dist = root / "dist"
(dist / "admin").mkdir(parents=True, exist_ok=True)
if (root / "landing" / "assets").exists():
    shutil.copytree(root / "landing" / "assets", dist / "assets", dirs_exist_ok=True)

env = lambda k, d="": os.environ.get(k, d).strip()

page = (root / "landing" / "index.html").read_text(encoding="utf-8")
apk_default = "https://charming-donkey-521.convex.cloud/api/storage/kg2c9paxxx7tn7v4txmvyd7jxn8hdzm4"
page = page.replace('href="[YOUR APK LINK]"', f'href="{env("APK_URL", apk_default)}"')
page = page.replace("[COMMISSION]", env("COMMISSION", "10"))
for key, token in (("SUPPORT_PHONE", "[SUPPORT PHONE]"), ("SUPPORT_EMAIL", "[SUPPORT EMAIL]")):
    value = env(key)
    page = page.replace(f'<span style="color: #afafaf">{token}</span>', f'<span style="color: #afafaf">{value}</span>' if value else "")
(dist / "index.html").write_text(page, encoding="utf-8")
(root / "index.html").write_text(page, encoding="utf-8")

subprocess.run([sys.executable, str(root / "admin" / "build.py")], check=True)
admin_html = (root / "admin" / "dist" / "index.html").read_text(encoding="utf-8")
(dist / "admin" / "index.html").write_text(admin_html, encoding="utf-8")

print("Built dist/ and root (landing at /, admin at /admin/, assets at /assets/)")


