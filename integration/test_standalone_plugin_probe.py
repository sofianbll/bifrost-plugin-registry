"""Hermetic regression of the shared probe's public activation recovery procedure."""
import unittest

from standalone_plugin_probe import probe_reactivation


class ActivationRecoveryTest(unittest.TestCase):
    def recover(self, version, rollback):
        # Only the external gateway, panel and process lifecycle are simulated.
        enabled, loaded, restarted = True, True, False
        events = []
        config = {'name': 'bifrost-registry', 'enabled': True, 'path': 'http://fixture/plugin.so'}

        def native(path, method='GET', body=None):
            nonlocal enabled, loaded
            if method == 'GET':
                if path == '/api/plugins':
                    events.append(('state', enabled, loaded))
                    return 200, {'plugins': [{**config, 'enabled': enabled,
                                             'status': {'status': 'active' if loaded else 'disabled'}}]}, {}
                self.assertEqual(path, '/api/plugins/loaded')
                return 200, {'plugins': ['bifrost-registry'] if loaded else []}, {}
            self.assertEqual((path, method), ('/api/plugins/bifrost-registry', 'PUT'))
            self.assertEqual(body, {**config, 'enabled': body['enabled']})
            events.append('enable' if body['enabled'] else 'disable')
            if not body['enabled']:
                enabled = loaded = False
                return 200, {}, {}
            if not restarted:
                enabled = not rollback
                return 500, {'error': {'message': 'previous configuration was kept: plugin already loaded'}}, {}
            enabled = loaded = True
            return 200, {}, {}

        def restart():
            nonlocal restarted, loaded
            events.append('restart')
            restarted = True
            loaded = enabled

        def check(name, condition, **_details):
            self.assertTrue(condition, name)

        hot_supported = probe_reactivation(
            version, config, native, lambda: not loaded,
            lambda: loaded, restart, check)
        self.assertFalse(hot_supported)
        return events

    def test_23_requires_fresh_enable_after_restart(self):
        events = self.recover('2.3.0', rollback=True)
        self.assertEqual(events, ['disable', 'enable', ('state', False, False),
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


if __name__ == '__main__':
    unittest.main()
