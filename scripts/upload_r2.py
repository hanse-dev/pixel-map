#!/usr/bin/env python3
"""Upload made tiles to Cloudflare R2 (S3 API). Credentials stay in ~/.config/pixel-map/r2.env.

  python3 scripts/upload_r2.py tiles            # uploads tiles/<city>/<version>/… once; existing keys are skipped

Paths carry the map version, so files never change after upload and are served with a long cache.
"""
import mimetypes, os, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import boto3
from botocore.config import Config

env = {}
for line in (Path.home() / '.config/pixel-map/r2.env').read_text().splitlines():
    if '=' in line:
        k, v = line.split('=', 1); env[k.strip()] = v.strip()
s3 = boto3.client('s3', endpoint_url=env['R2_ENDPOINT'], aws_access_key_id=env['R2_ACCESS_KEY_ID'],
                  aws_secret_access_key=env['R2_SECRET_ACCESS_KEY'], region_name='auto',
                  config=Config(retries={'max_attempts': 8, 'mode': 'standard'}, max_pool_connections=32))
bucket, root = env['R2_BUCKET'], Path(sys.argv[1])
files = [p for p in sorted(root.rglob('*')) if p.is_file() and p.name != '.DS_Store']
prefixes = {str(p.relative_to(root)).split('/')[0] + '/' + str(p.relative_to(root)).split('/')[1] + '/' for p in files}
have = set()
for prefix in prefixes:
    for page in s3.get_paginator('list_objects_v2').paginate(Bucket=bucket, Prefix=prefix):
        have |= {o['Key'] for o in page.get('Contents', [])}
todo = [p for p in files if str(p.relative_to(root)) not in have]
types = {'.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json'}


def put(p):
    key = str(p.relative_to(root))
    s3.upload_file(str(p), bucket, key, ExtraArgs={'ContentType': types.get(p.suffix) or mimetypes.guess_type(p.name)[0] or 'application/octet-stream',
                                                   'CacheControl': 'public, max-age=31536000, immutable'})
    return p.stat().st_size


with ThreadPoolExecutor(16) as pool:
    sent = sum(pool.map(put, todo))
print({'files': len(files), 'already_there': len(files) - len(todo), 'uploaded': len(todo), 'mb': round(sent / 1e6, 1)})
