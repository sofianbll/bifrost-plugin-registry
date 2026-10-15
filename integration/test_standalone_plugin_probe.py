"""Hermetic regression of the shared probe's public activation recovery procedure."""
import unittest

from standalone_plugin_probe import probe_reactivation


class ActivationRecoveryTest(unittest.TestCase):
    def recover(self, version, rollback, recovery_path='/art/bifrost-registry.so', fault=None):
        # Only the external gateway, panel and process lifecycle are simulated.
        enabled, loaded, restarted = True, True, False
        events = []
        config = {'name': 'bifrost-registry', 'enabled': True, 'path': 'http://fixture/plugin.so',
                  'placement': 'post_builtin', 'order': 0, 'config': {'registry_path': '/data/registry.json'}}
        saved_path = config['path']
        opened_path = '/tmp/initial-url.so'

        def native(path, method='GET', body=None):
            nonlocal enabled, loaded, saved_path
            if method == 'GET':
                if path == '/api/plugins':
                    events.append(('state', enabled, loaded))
                    row = {**config, 'path': saved_path, 'enabled': enabled,
                           'status': {'status': 'active' if loaded else 'disabled'}}
                    if fault == 'changed_settings' and saved_path.startswith('/'):
                        row['config'] = {'registry_path': '/wrong/registry.json'}
                    return 200, {'plugins': [row]}, {}
                self.assertEqual(path, '/api/plugins/loaded')
                return 200, {'plugins': ['bifrost-registry'] if loaded else []}, {}
            self.assertEqual((path, method), ('/api/plugins/bifrost-registry', 'PUT'))
            self.assertEqual(body, {**config, 'enabled': body['enabled'], 'path': body['path']})
            events.append('enable' if body['enabled'] else 'disable')
            if body['path'] != saved_path:
                events.append(('path', body['path'], body['enabled']))
            if not body['enabled']:
                enabled = loaded = False
                if fault != 'path_not_saved':
                    saved_path = body['path']
                return 200, {}, {}
            if not restarted:
                enabled = not rollback
                if fault == 'hot_auth':
                    return 401, {'error': {'message': 'unauthorized'}}, {}
                if fault == 'other_500':
                    return 500, {'error': {'message': 'authentication failed'}}, {}
                return 500, {'error': {'message': 'previous configuration was kept: plugin already loaded'}}, {}
            if fault == 'fresh_auth':
                return 401, {'error': {'message': 'unauthorized'}}, {}
            # Upstream verification opens disabled modules at startup. URL enable
            # downloads another temp filename; only the same local path is reusable.
            requested_path = '/tmp/new-url.so' if body['path'].startswith('http') else body['path']
            if requested_path != opened_path:
                return 500, {'error': {'message': 'plugin already loaded'}}, {}
            enabled = loaded = True
            saved_path = body['path']
            return 200, {}, {}

        def restart():
            nonlocal restarted, loaded, opened_path
            events.append('restart')
            restarted = True
            loaded = enabled
            opened_path = '/tmp/verified-url.so' if saved_path.startswith('http') else saved_path

        def check(name, condition, **_details):
            self.assertTrue(condition, name)

        hot_supported = probe_reactivation(
            version, config, native, lambda: not loaded,
            lambda: loaded, restart, check, recovery_path=recovery_path)
        self.assertFalse(hot_supported)
        return events

    def test_23_persists_same_bytes_local_path_disabled_before_restart(self):
        events = self.recover('2.3.0', rollback=True)
        self.assertEqual(events, ['disable', 'enable', ('state', False, False),
                                  'disable', ('path', '/art/bifrost-registry.so', False),
                                  ('state', False, False),
                                  'restart', ('state', False, False), 'enable',
                                  ('state', True, True)])

    def test_22_keeps_enabled_config_and_recovers_on_restart(self):
        for version in ('2.2.2', '2.2.3', '2.2.4', '2.2.5', '2.2.6'):
            with self.subTest(version=version):
                self.assertEqual(self.recover(version, rollback=False), [
                    'disable', 'enable', ('state', True, False),
                    'restart', ('state', True, True)])

    def test_wrong_persisted_enabled_value_is_rejected_for_each_target(self):
        for version, rollback, failure in (
            ('2.3.0', False, 'failed reactivation restores disabled config'),
            ('2.2.6', True, 'reactivation config remains enabled for restart'),
        ):
            with self.subTest(version=version):
                with self.assertRaisesRegex(AssertionError, failure):
                    self.recover(version, rollback)

    def test_23_refuses_missing_relative_or_url_recovery_path(self):
        for path in (None, '', 'relative/plugin.so', 'https://fixture/plugin.so'):
            with self.subTest(path=path):
                with self.assertRaisesRegex(AssertionError, 'stable absolute local plugin path'):
                    self.recover('2.3.0', True, recovery_path=path)

    def test_23_requires_disabled_local_path_and_unchanged_settings_readback(self):
        for fault in ('path_not_saved', 'changed_settings'):
            with self.subTest(fault=fault):
                with self.assertRaisesRegex(AssertionError, 'disabled local path and settings read back'):
                    self.recover('2.3.0', True, fault=fault)

    def test_authentication_or_unrelated_500_is_not_the_known_loader_limit(self):
        for fault in ('hot_auth', 'other_500', 'fresh_auth'):
            with self.subTest(fault=fault):
                failure = ('fresh local enable after restart accepted' if fault == 'fresh_auth'
                           else 'known URL reload limitation reported clearly')
                with self.assertRaisesRegex(AssertionError, failure):
                    self.recover('2.3.0', True, fault=fault)


if __name__ == '__main__':
    unittest.main()
