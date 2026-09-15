"""
Orchestrates the full weekly rebuild:
  0. decrypt_sources.py -> data/raw.xlsx + reference/master.xlsx (transient, gitignored;
     decrypted from the committed data/raw.xlsx.enc.json / reference/master.xlsx.enc.json
     using the DASHBOARD_PASSWORD secret -- see decrypt_sources.py for why)
  1. extract.py   -> build/agg_v2.json
  2. finalize.py  -> build/dashboard_data_v2.json
  3. encrypt that JSON with the SAME password (AES-GCM, key via PBKDF2-SHA256 -- matches
     the Web Crypto API on the viewer's side, see the bootstrap script in template.html)
  4. splice template.html + app.js + the encrypted blob into docs/index.html
     (GitHub Pages publishes this via the deploy.yml Actions workflow)

Run with:
  DASHBOARD_PASSWORD=... python scripts/build.py
(In GitHub Actions this env var comes from the DASHBOARD_PASSWORD repository secret.)
"""
import base64
import json
import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
BUILD_DIR = os.path.join(REPO_ROOT, 'build')
DOCS_DIR = os.path.join(REPO_ROOT, 'docs')

# ---------------------------------------------------------------------------
# The SAME password is used to (a) decrypt the source Excel files committed
# to the repo as .enc.json and (b) lock the published dashboard itself.
# It is never hardcoded here -- it must come from the DASHBOARD_PASSWORD
# environment variable (a GitHub Actions secret when running in CI, or an
# exported shell variable when running locally). To change the password:
# update the repo secret AND re-encrypt both source files with
# tools/encrypt_source.html using the new password -- see README.md.
# ---------------------------------------------------------------------------
PASSWORD = os.environ.get('DASHBOARD_PASSWORD')
if not PASSWORD:
    raise SystemExit(
        'DASHBOARD_PASSWORD environment variable is not set.\n'
        'Locally: export DASHBOARD_PASSWORD=... before running this script.\n'
        'In GitHub Actions: add it as a repository secret -- see README.md.'
    )

PBKDF2_ITERATIONS = 250000


def run_step(script_name):
    path = os.path.join(SCRIPT_DIR, script_name)
    print(f'--- running {script_name} ---')
    result = subprocess.run([sys.executable, path], cwd=SCRIPT_DIR)
    if result.returncode != 0:
        raise SystemExit(f'{script_name} failed (exit {result.returncode})')


def encrypt_json(data_bytes, password):
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    salt = os.urandom(16)
    iv = os.urandom(12)
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=PBKDF2_ITERATIONS)
    key = kdf.derive(password.encode('utf-8'))
    ciphertext = AESGCM(key).encrypt(iv, data_bytes, None)
    return {
        'salt': base64.b64encode(salt).decode('ascii'),
        'iv': base64.b64encode(iv).decode('ascii'),
        'data': base64.b64encode(ciphertext).decode('ascii'),
        'iter': PBKDF2_ITERATIONS,
    }


def main():
    os.makedirs(BUILD_DIR, exist_ok=True)
    os.makedirs(DOCS_DIR, exist_ok=True)

    run_step('decrypt_sources.py')
    run_step('extract.py')
    run_step('finalize.py')

    data_path = os.path.join(BUILD_DIR, 'dashboard_data_v2.json')
    with open(data_path, 'rb') as f:
        data_bytes = f.read()

    enc = encrypt_json(data_bytes, PASSWORD)
    enc_json = json.dumps(enc)
    # escape any literal "</script" so it can't prematurely close the tag
    enc_json_safe = enc_json.replace('</script', '<\\/script')

    with open(os.path.join(SCRIPT_DIR, 'template.html'), encoding='utf-8') as f:
        template = f.read()
    with open(os.path.join(SCRIPT_DIR, 'app.js'), encoding='utf-8') as f:
        app_js = f.read()

    out = template.replace('__ENC_JSON__', enc_json_safe).replace('__APP_JS__', app_js)

    out_path = os.path.join(DOCS_DIR, 'index.html')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(out)

    print(f'built {out_path} ({os.path.getsize(out_path)} bytes)')
    print('password (unchanged unless you edited PASSWORD above or set DASHBOARD_PASSWORD):', PASSWORD)


if __name__ == '__main__':
    main()
