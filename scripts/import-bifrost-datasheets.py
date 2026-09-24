#!/usr/bin/env python3
"""Convert known Bifrost pricing/parameter maps into a new Registry snapshot.

Usage: import-bifrost-datasheets.py --snapshot registry-snapshot.json
       --pricing pricing.json --parameters model-parameters.json --out new-snapshot.json

This only adds catalogue metadata. Review the output through the Registry import
preview before applying it; the source snapshot and datasheets are never written.
"""

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import tempfile


MAX_INPUT = 32 << 20
MAX_CONFIG = 4 << 20


def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('duplicate JSON key')
        result[key] = value
    return result


def read_json(path):
    with path.open('rb') as stream:
        data = stream.read(MAX_INPUT + 1)
    if len(data) > MAX_INPUT:
        raise ValueError(f'{path.name} exceeds 32 MiB')
    return json.loads(data, object_pairs_hook=unique_pairs,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f'invalid number: {value}')))


def identity(key, row):
    if (not isinstance(key, str) or not key or key != key.strip() or len(key.encode()) > 512
            or any(ord(char) < 32 or ord(char) == 127 for char in key) or not isinstance(row, dict)):
        raise ValueError('datasheet needs a map of named objects')
    provider, model = row.get('provider'), row.get('base_model')
    for value in (provider, model):
        if (not isinstance(value, str) or not value or value != value.strip()
                or len(value.encode()) > 512 or any(ord(char) < 32 or ord(char) == 127 for char in value)):
            raise ValueError('datasheet row lacks a valid provider/base_model')
    if '/' in provider:
        raise ValueError('datasheet row has an ambiguous provider')
    access_id = provider + '/' + model
    if len(access_id.encode()) > 512:
        raise ValueError('datasheet access identity is too long')
    if '/' in key and key != access_id:
        raise ValueError('datasheet key conflicts with provider/base_model')
    return access_id, provider, model


def rows_by_access(sheet, label):
    if not isinstance(sheet, dict):
        raise ValueError(f'{label} must be a JSON object')
    found = {}
    for key, row in sheet.items():
        access_id, provider, model = identity(key, row)
        if access_id in found:
            raise ValueError(f'ambiguous {label} rows')
        found[access_id] = (provider, model, row)
    return found


def convert(snapshot, pricing, parameters):
    if (not isinstance(snapshot, dict) or set(snapshot) != {'format_version', 'registry'}
            or type(snapshot['format_version']) is not int or snapshot['format_version'] != 1
            or not isinstance(snapshot['registry'], dict)
            or type(snapshot['registry'].get('schema_version')) is not int
            or snapshot['registry']['schema_version'] != 1):
        raise ValueError('expected a versioned Registry V1 snapshot')
    registry = snapshot['registry']
    if not all(isinstance(registry.get(name), list) for name in ('models', 'groups', 'policies')):
        raise ValueError('snapshot is missing Registry collections')
    prices = rows_by_access(pricing, 'pricing')
    params = rows_by_access(parameters, 'parameters')
    if not prices and not params:
        return snapshot, 0, 0, 0
    catalog = registry.setdefault('catalog', {})
    if not isinstance(catalog, dict):
        raise ValueError('catalog must be an object')
    accesses = catalog.setdefault('accesses', [])
    if not isinstance(accesses, list):
        raise ValueError('catalog accesses must be an array')
    existing = {}
    for access in accesses:
        if not isinstance(access, dict) or not isinstance(access.get('id'), str) or access['id'] in existing:
            raise ValueError('ambiguous existing catalog access')
        existing[access['id']] = access
    created = updated = unchanged = 0
    timestamp = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
    for access_id in sorted(prices.keys() | params.keys()):
        provider, model, _ = prices.get(access_id) or params[access_id]
        access = existing.get(access_id)
        new_access = access is None
        if access is None:
            access = {'id': access_id, 'provider': provider, 'model': model, 'configured': False}
            accesses.append(access)
            existing[access_id] = access
            created += 1
        elif access.get('provider') != provider or access.get('model') != model:
            raise ValueError('existing catalog access conflicts with datasheet identity')
        overrides = access.setdefault('overrides', {})
        if not isinstance(overrides, dict):
            raise ValueError('invalid catalog overrides')
        previous = overrides.get('legacy_datasheet')
        if previous is not None and (not isinstance(previous, dict)
                                     or not isinstance(previous.get('value'), dict)):
            raise ValueError('invalid legacy_datasheet override')
        raw = dict(previous['value']) if previous else {}
        if access_id in prices:
            raw['pricing'] = prices[access_id][2]
        if access_id in params:
            raw['parameters'] = params[access_id][2]
        if previous and previous.get('value') == raw:
            unchanged += 1
            continue
        overrides['legacy_datasheet'] = {'value': raw, 'source': 'manual',
                                         'updatedAt': timestamp, 'kind': 'declared'}
        if not new_access:
            updated += 1
    accesses.sort(key=lambda access: access['id'])
    raw_registry = json.dumps(registry, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
    if len(raw_registry) > MAX_CONFIG:
        raise ValueError('converted Registry config exceeds 4 MiB; narrow the datasheet input')
    return snapshot, created, updated, unchanged


def write_new(path, value):
    data = (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n').encode()
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.registry-import-', delete=False) as stream:
        temporary = Path(stream.name)
        try:
            os.fchmod(stream.fileno(), 0o600)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise
    try:
        os.link(temporary, path)  # O_EXCL semantics: never replace an existing output.
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--pricing', type=Path, required=True)
    parser.add_argument('--parameters', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.out.exists():
            raise ValueError('output already exists; choose a new path')
        result = convert(read_json(args.snapshot), read_json(args.pricing), read_json(args.parameters))
        write_new(args.out, result[0])
    except (OSError, ValueError) as error:
        parser.exit(1, f'import failed: {error}\n')
    print(f'created={result[1]} updated={result[2]} unchanged={result[3]} output={args.out}')


if __name__ == '__main__':
    main()
