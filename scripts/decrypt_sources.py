"""
Runs FIRST in the build pipeline (called from build.py).

The repo must be public for free GitHub Pages hosting, which means anyone
could download files sitting in it directly -- completely bypassing the
dashboard's own password screen. To prevent that, the two source Excel
files are never committed in the clear. Instead the repo holds encrypted
blobs:

    data/raw.xlsx.enc           (encrypted data/raw.xlsx)
    reference/master.xlsx.enc   (encrypted reference/master.xlsx)

...produced locally with tools/encrypt_source.html (same AES-GCM +
PBKDF2-SHA256 scheme as the dashboard's own password gate -- see
template.html), stored as a compact binary container:
    4 bytes  magic "ENC1"
    16 bytes salt
    12 bytes iv
    4 bytes  PBKDF2 iteration count (big-endian uint32)
    ...      AES-GCM ciphertext (includes the 16-byte auth tag)

This script decrypts them back to plain .xlsx files (gitignored,
build-only) using the DASHBOARD_PASSWORD secret, so the plaintext only
ever exists transiently inside the CI runner / your own machine while
building -- never in the repo itself.
"""
import os
import struct

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)

MAGIC = b'ENC1'

SOURCES = [
    (
        os.path.join(REPO_ROOT, 'data', 'raw.xlsx.enc'),
        os.path.join(REPO_ROOT, 'data', 'raw.xlsx'),
    ),
    (
        os.path.join(REPO_ROOT, 'reference', 'master.xlsx.enc'),
        os.path.join(REPO_ROOT, 'reference', 'master.xlsx'),
    ),
]


def decrypt_file(enc_path, out_path, password):
    with open(enc_path, 'rb') as f:
        blob = f.read()

    if blob[:4] != MAGIC:
        raise SystemExit(f'{enc_path} does not look like a file produced by tools/encrypt_source.html')

    salt = blob[4:20]
    iv = blob[20:32]
    iterations = struct.unpack('>I', blob[32:36])[0]
    ct = blob[36:]

    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iterations)
    key = kdf.derive(password.encode('utf-8'))

    try:
        plaintext = AESGCM(key).decrypt(iv, ct, None)
    except Exception:
        raise SystemExit(
            f'failed to decrypt {os.path.basename(enc_path)} -- '
            'the DASHBOARD_PASSWORD secret does not match the password used '
            'when this file was encrypted with tools/encrypt_source.html.'
        )

    with open(out_path, 'wb') as f:
        f.write(plaintext)
    print(f'decrypted {os.path.basename(enc_path)} -> {os.path.basename(out_path)} ({len(plaintext):,} bytes)')


def main():
    password = os.environ.get('DASHBOARD_PASSWORD')
    if not password:
        raise SystemExit(
            'DASHBOARD_PASSWORD environment variable is not set.\n'
            'Locally: export DASHBOARD_PASSWORD=... before running scripts/build.py\n'
            'In GitHub Actions: add it as a repository secret (Settings > Secrets and '
            'variables > Actions) -- see README.md.'
        )

    for enc_path, out_path in SOURCES:
        if not os.path.exists(enc_path):
            raise SystemExit(
                f'missing encrypted source file: {enc_path}\n'
                'Create it with tools/encrypt_source.html and upload it to the repo -- see README.md.'
            )
        decrypt_file(enc_path, out_path, password)


if __name__ == '__main__':
    main()
