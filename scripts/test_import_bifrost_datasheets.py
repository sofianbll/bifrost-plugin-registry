"""Offline fixture for the known Bifrost datasheet conversion."""

import copy
import json
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).with_name('import-bifrost-datasheets.py')


class DatasheetImportTest(unittest.TestCase):
    def test_preserves_raw_rows_routing_and_repeat(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            original = {'format_version': 1, 'registry': {
                'schema_version': 1, 'default_naming': 'provider/model',
                'models': [{'id': 'one', 'alias': 'one', 'provider': 'Google',
                            'provider_key_ids': ['existing-key'], 'upstream_model': 'one',
                            'endpoints': ['chat/completions'], 'enabled': True, 'configured': True,
                            'verified': False}],
                'groups': [{'id': 'g', 'name': 'G', 'model_ids': ['one']}],
                'policies': [{'virtual_key_id': 'vk', 'name': 'VK', 'token_sha256': 'a' * 64,
                              'groups': ['g'], 'enabled': True}],
                'catalog': {'accesses': [{'id': 'Google/one', 'provider': 'Google', 'model': 'one',
                                         'configured': True, 'overrides': {'creator': {
                                             'value': 'User decision', 'source': 'manual',
                                             'kind': 'declared', 'updatedAt': '2026-01-01T00:00:00Z'}}}]}}}
            pricing = {
                'Google/one': {'provider': 'Google', 'base_model': 'one',
                               'input_cost_per_token_above_256k_tokens': 0.000002,
                               'off_peak_pricing': {'windows': [{'hours_utc': '00:00-01:00'}],
                                                    'input_cost_per_token': 0.000001}},
                'opencode-go/deepseek': {'provider': 'opencode-go', 'base_model': 'deepseek',
                                        'off_peak_cost_multiplier': 0.5},
            }
            parameters = {
                'alternate-key': {'provider': 'Google', 'base_model': 'one',
                                  'parameters': {'reasoning': ['low', 'high']}},
                'Codex/gpt': {'provider': 'Codex', 'base_model': 'gpt',
                              'parameters': {'temperature': [0, 1]}},
            }
            for name, value in [('snapshot.json', original), ('pricing.json', pricing),
                                ('parameters.json', parameters)]:
                (root / name).write_text(json.dumps(value), encoding='utf-8')

            def run(snapshot, output, price='pricing.json'):
                return subprocess.run([sys.executable, str(SCRIPT), '--snapshot', str(root / snapshot),
                                       '--pricing', str(root / price), '--parameters', str(root / 'parameters.json'),
                                       '--out', str(root / output)], capture_output=True, text=True, check=False)

            original_bytes = (root / 'snapshot.json').read_bytes()
            first = run('snapshot.json', 'converted.json')
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertIn('created=2 updated=1 unchanged=0', first.stdout)
            self.assertEqual((root / 'snapshot.json').read_bytes(), original_bytes)
            converted_bytes = (root / 'converted.json').read_bytes()
            self.assertEqual(stat.S_IMODE((root / 'converted.json').stat().st_mode), 0o600)
            converted = json.loads(converted_bytes)
            self.assertEqual(converted['registry']['models'], original['registry']['models'])
            self.assertEqual(converted['registry']['groups'], original['registry']['groups'])
            self.assertEqual(converted['registry']['policies'], original['registry']['policies'])
            accesses = {access['id']: access for access in converted['registry']['catalog']['accesses']}
            self.assertEqual(accesses['Google/one']['overrides']['creator'],
                             original['registry']['catalog']['accesses'][0]['overrides']['creator'])
            self.assertEqual(accesses['Google/one']['overrides']['legacy_datasheet']['value'],
                             {'pricing': pricing['Google/one'], 'parameters': parameters['alternate-key']})
            self.assertFalse(accesses['Codex/gpt']['configured'])
            self.assertFalse(accesses['opencode-go/deepseek']['configured'])
            self.assertEqual(set(accesses), {'Google/one', 'Codex/gpt', 'opencode-go/deepseek'})

            repeat = run('converted.json', 'repeat.json')
            self.assertEqual(repeat.returncode, 0, repeat.stderr)
            self.assertIn('created=0 updated=0 unchanged=3', repeat.stdout)
            self.assertEqual((root / 'repeat.json').read_bytes(), converted_bytes)

            (root / 'empty-parameters.json').write_text('{}', encoding='utf-8')
            kept = subprocess.run([sys.executable, str(SCRIPT), '--snapshot', str(root / 'converted.json'),
                                   '--pricing', str(root / 'pricing.json'),
                                   '--parameters', str(root / 'empty-parameters.json'),
                                   '--out', str(root / 'kept.json')], capture_output=True, text=True, check=False)
            self.assertEqual(kept.returncode, 0, kept.stderr)
            self.assertEqual((root / 'kept.json').read_bytes(), converted_bytes)
            refused_overwrite = run('snapshot.json', 'converted.json')
            self.assertNotEqual(refused_overwrite.returncode, 0)
            self.assertEqual((root / 'converted.json').read_bytes(), converted_bytes)

            bad = copy.deepcopy(pricing)
            bad['Wrong/one'] = bad.pop('Google/one')
            (root / 'bad-pricing.json').write_text(json.dumps(bad), encoding='utf-8')
            rejected = run('snapshot.json', 'rejected.json', 'bad-pricing.json')
            self.assertNotEqual(rejected.returncode, 0)
            self.assertFalse((root / 'rejected.json').exists())


if __name__ == '__main__':
    unittest.main()
