import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { serverStats, type ServerStats, useIsAdmin } from '@/lib/admin';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

const SITE = 'https://adroapp.com';
const REPO = 'a720022002-cell/gymi';
const FUNCTIONS = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/ai`;
/** Supabase free plan limits, to compare against. */
const DB_LIMIT = 500 * 1024 * 1024;
const STORAGE_LIMIT = 1024 * 1024 * 1024;
const MAU_LIMIT = 50000;

type Check = { ok: boolean | null; ms?: number; text?: string };
type Live = { site: Check; ai: Check; deploy: Check & { at?: string; msg?: string } };

const size = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(0, Math.round(b / 1024))} KB`);

/** Time one request; any answer from the server counts as up. */
async function ping(url: string, init?: RequestInit): Promise<Check> {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { cache: 'no-store', ...init });
    return { ok: r.status < 500, ms: Date.now() - t0, text: String(r.status) };
  } catch {
    return { ok: false, ms: Date.now() - t0 };
  }
}

/** Last update to the live site: GitHub shows whether Vercel published it. */
async function lastDeploy(): Promise<Live['deploy']> {
  try {
    const [st, cm] = await Promise.all([
      fetch(`https://api.github.com/repos/${REPO}/commits/main/status`).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://api.github.com/repos/${REPO}/commits/main`).then((r) => (r.ok ? r.json() : null)),
    ]);
    if (!st) return { ok: null };
    const state = String(st.state ?? '');
    return { ok: state === 'success' ? true : state === 'pending' ? null : false, text: state, at: cm?.commit?.committer?.date, msg: String(cm?.commit?.message ?? '').split('\n')[0] };
  } catch {
    return { ok: null };
  }
}

/** Is everything running: the site, the AI, the last update, and how full the database and storage are. */
export default function AdminServer() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const admin = useIsAdmin();
  const [s, setS] = useState<ServerStats | null | undefined>(undefined);
  const [live, setLive] = useState<Live | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    const [stats, site, ai, deploy] = await Promise.all([serverStats(), ping(SITE, { method: 'HEAD' }), ping(FUNCTIONS, { method: 'OPTIONS' }), lastDeploy()]);
    return { stats, live: { site, ai, deploy } };
  }, []);
  useEffect(() => {
    if (!admin) return;
    let alive = true;
    run().then((r) => {
      if (!alive) return;
      setS(r.stats);
      setLive(r.live);
    });
    return () => {
      alive = false;
    };
  }, [admin, run]);

  if (!admin)
    return (
      <Screen title={t('Server')} back>
        <Text color="sec">{t('Only the Adro team can open this page.')}</Text>
      </Screen>
    );
  if (s === undefined || !live)
    return (
      <Screen title={t('Server')} back>
        <Thinking message={t('Checking the servers')} />
      </Screen>
    );

  const dot = (ok: boolean | null) => (ok === true ? c.up : ok === false ? c.down : c.sec);
  const status: [string, string, Check, string][] = [
    ['globe', 'Website', live.site, live.site.ok ? t('Up · {n} ms', { n: live.site.ms ?? 0 }) : t('Not answering')],
    ['sparkle', 'AI and server functions', live.ai, live.ai.ok ? t('Up · {n} ms', { n: live.ai.ms ?? 0 }) : t('Not answering')],
    [
      'upload',
      'Last update',
      live.deploy,
      live.deploy.ok === true ? t('Published') : live.deploy.text === 'pending' ? t('Publishing now') : live.deploy.ok === false ? t('Failed to publish') : t('Couldn’t check'),
    ],
  ];
  const storage = (s?.storage ?? []).reduce((a, x) => a + Number(x.bytes), 0);
  const bars: [string, number, number, string][] = s
    ? [
        ['Database', Number(s.db_bytes), DB_LIMIT, `${size(Number(s.db_bytes))} / 500 MB`],
        ['File storage', storage, STORAGE_LIMIT, `${size(storage)} / 1 GB`],
        ['Monthly active users', Number(s.active_30d), MAU_LIMIT, `${fmt(Number(s.active_30d))} / 50,000`],
      ]
    : [];

  return (
    <Screen title={t('Server')} back>
      <Card>
        {status.map(([i, n, ch, txt], k) => (
          <Row key={n} gap={10} style={{ marginTop: k ? 14 : 0 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot(ch.ok) }} />
            <Icon name={i as never} size={18} color={c.sec} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t(n)}</Text>
              {n === 'Last update' && live.deploy.msg ? (
                <Text variant="xs" color="sec" numberOfLines={1}>
                  {`${live.deploy.msg}${live.deploy.at ? ` · ${new Date(live.deploy.at).toLocaleString()}` : ''}`}
                </Text>
              ) : null}
            </View>
            <Text variant="small" weight={700} style={{ color: dot(ch.ok) }}>
              {txt}
            </Text>
          </Row>
        ))}
      </Card>
      {!s ? (
        <Card>
          <Text color="sec">{t('Couldn’t load the database numbers.')}</Text>
        </Card>
      ) : (
        <>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Usage (free plan limits)')}
          </Text>
          <Card>
            {bars.map(([n, v, max, txt], i) => {
              const pct = Math.min(100, (v / max) * 100);
              return (
                <View key={n} style={{ marginTop: i ? 14 : 0 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text variant="small" weight={700}>
                      {t(n)}
                    </Text>
                    <Text variant="small" num color="sec">
                      {txt}
                    </Text>
                  </Row>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: c.inset, marginTop: 6, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.max(2, pct)}%`, height: '100%', borderRadius: 4, backgroundColor: pct > 85 ? c.down : pct > 60 ? '#F59E0B' : c.up }} />
                  </View>
                </View>
              );
            })}
          </Card>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {(
              [
                ['Users', s.users],
                ['New in 7 days', s.new_7d],
                ['Active today', s.active_today],
                ['AI requests today', s.ai_today],
                ['AI failures today', s.ai_errors_today],
              ] as const
            ).map(([l, v]) => (
              <Card key={l} style={{ minWidth: '30%', flexGrow: 1 }}>
                <Text num size={20} style={l === 'AI failures today' && Number(v) > 0 ? { color: c.down } : undefined}>
                  {fmt(Number(v))}
                </Text>
                <Text variant="xs" weight={700} color="sec">
                  {t(l)}
                </Text>
              </Card>
            ))}
          </Row>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Storage by folder')}
          </Text>
          <Card>
            {s.storage.length ? (
              s.storage.map((x, i) => (
                <Row key={x.bucket} style={{ marginTop: i ? 10 : 0, justifyContent: 'space-between' }}>
                  <Text variant="small" weight={700}>
                    {x.bucket}
                  </Text>
                  <Text variant="small" color="sec">
                    {t('{n} files · {s}', { n: fmt(Number(x.files)), s: size(Number(x.bytes)) })}
                  </Text>
                </Row>
              ))
            ) : (
              <Text color="sec">{t('No files yet.')}</Text>
            )}
          </Card>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Biggest tables')}
          </Text>
          <Card>
            {s.tables.map((x, i) => (
              <Row key={x.name} style={{ marginTop: i ? 10 : 0, justifyContent: 'space-between' }}>
                <Text variant="small" weight={700}>
                  {x.name}
                </Text>
                <Text variant="small" color="sec">
                  {t('{n} rows · {s}', { n: fmt(Number(x.rows)), s: size(Number(x.bytes)) })}
                </Text>
              </Row>
            ))}
          </Card>
          <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
            {t('Database version {v}', { v: s.version })}
          </Text>
        </>
      )}
      <Button
        kind="soft"
        icon="swap"
        title={t('Check again')}
        loading={busy}
        style={{ marginTop: 12 }}
        onPress={async () => {
          setBusy(true);
          const r = await run();
          setS(r.stats);
          setLive(r.live);
          setBusy(false);
        }}
      />
    </Screen>
  );
}
