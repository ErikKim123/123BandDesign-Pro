// Design Ref: 마이페이지 — 업적/뱃지 탭. 획득한 뱃지 + 도전 중인 업적.
// 공통 헤더(캐릭터/QR)와 탭 네비는 account/layout.tsx 가 그린다 — 여기선 본문만.
import { Award, Lock } from 'lucide-react';
import { pickI18n, type Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { requireCustomer } from '@/lib/auth/guard';
import { storageThumb } from '@/lib/image';
import { BadgeZoom } from '@/components/account/BadgeZoom';

export const dynamic = 'force-dynamic';

interface AchievementRow {
  id: string;
  code: string;
  name_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  badge_image_url: string | null;
  point_reward: number;
  /** 업적 묶음(0101). 없으면 '기타'. */
  track: string | null;
  conditions: { type: string }[] | null;
  /** 행사 전용 업적이면 그 행사(패스 상품) id(0103). null = 공통. */
  product_id: string | null;
}

/** 트랙을 두 갈래로 — 온라인에서 쌓는 것과 행사장에서 쌓는 것. 받은 뱃지를 이 단위로 묶어 보여 준다.
 *  (도전 목록은 지금처럼 트랙 하나하나로 나눈다 — 무엇을 하면 되는지가 더 중요해서.) */
const ONLINE_TRACKS = ['onboarding', 'purchaser', 'critic', 'den', 'hustler', 'explorer', 'diehard'];
const ONSITE_TRACKS = ['logistics', 'party', 'grind', 'arena'];

/** 운영진이 직접 지급하는 업적(SNS 태그·제보 등) — 조건을 채워도 자동으로 나오지 않는다. */
const isManual = (a: AchievementRow) =>
  Array.isArray(a.conditions) && a.conditions.some((c) => c?.type === 'manual');

interface EarnedRow {
  achievement_id: string;
  earned_at: string;
}

function fmtTpl(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export default async function BadgesPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);
  const b = dict.badges;

  const user = await requireCustomer(locale, 'account/badges');
  const supabase = createClient();

  // 페이지 진입 시 한 번 재평가 — 트리거를 타지 않은 경로로 조건을 만족했을 때의 누락을 메운다.
  await supabase.rpc('claim_achievements');

  const [{ data: catalogRaw }, { data: earnedRaw }] = await Promise.all([
    supabase
      .from('achievements')
      .select('id, code, name_i18n, description_i18n, badge_image_url, point_reward, track, conditions, product_id')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    // RLS(user_achievements_select_own)로 본인 획득분만 조회된다
    supabase.from('user_achievements').select('achievement_id, earned_at'),
  ]);

  const catalog = (catalogRaw ?? []) as AchievementRow[];
  const earned = (earnedRaw ?? []) as EarnedRow[];
  const earnedAt = new Map(earned.map((e) => [e.achievement_id, e.earned_at]));

  // 행사 전용 뱃지 — 행사 이름과, 내가 패스를 가진 행사를 알아야 한다.
  const eventIds = Array.from(new Set(catalog.map((a) => a.product_id).filter((v): v is string => !!v)));
  const [{ data: eventsRaw }, { data: myOrdersRaw }] = await Promise.all([
    eventIds.length
      ? supabase.from('products').select('id, name_i18n').in('id', eventIds)
      : Promise.resolve({ data: [] as { id: string; name_i18n: Record<string, string> }[] }),
    eventIds.length
      ? supabase
          .from('orders')
          .select('order_items(product_id)')
          .eq('buyer_id', user.id)
          .in('status', ['paid', 'shipped', 'done'])
      : Promise.resolve({ data: [] as { order_items: { product_id: string }[] }[] }),
  ]);
  const eventName = new Map(
    ((eventsRaw ?? []) as { id: string; name_i18n: Record<string, string> }[]).map((e) => [
      e.id,
      pickI18n(e.name_i18n, locale),
    ]),
  );
  const myEvents = new Set(
    ((myOrdersRaw ?? []) as { order_items: { product_id: string }[] | null }[]).flatMap((o) =>
      (o.order_items ?? []).map((i) => i.product_id),
    ),
  );

  const mine = catalog.filter((a) => earnedAt.has(a.id));
  // 받은 뱃지 묶음 — 행사 전용은 행사별로, 나머지는 온라인/현장으로. 빈 묶음은 그리지 않는다.
  const earnedGroups: { key: string; label: string; items: AchievementRow[] }[] = [];
  const pushEarned = (key: string, label: string, items: AchievementRow[]) => {
    if (items.length > 0) earnedGroups.push({ key, label, items });
  };
  pushEarned(
    'online',
    b.groupOnline,
    mine.filter((a) => !a.product_id && ONLINE_TRACKS.includes(a.track ?? '')),
  );
  pushEarned(
    'onsite',
    b.groupOnsite,
    mine.filter((a) => !a.product_id && ONSITE_TRACKS.includes(a.track ?? '')),
  );
  pushEarned(
    'other',
    b.groupOther,
    mine.filter(
      (a) =>
        !a.product_id &&
        !ONLINE_TRACKS.includes(a.track ?? '') &&
        !ONSITE_TRACKS.includes(a.track ?? ''),
    ),
  );
  // 도전 목록: 공통 업적 전부 + 패스를 가진 행사의 전용 업적만(가지 않을 행사의 뱃지는 보여 줘도 딸 수 없다).
  const locked = catalog.filter(
    (a) => !earnedAt.has(a.id) && (!a.product_id || myEvents.has(a.product_id)),
  );

  // 도전 중인 업적은 트랙(시작하기·구매·현장…)별로 묶는다 — 스무 개 넘게 한 줄로 늘어서면
  // 무엇부터 노려야 할지 안 보인다. 묶음 순서는 노출 순서(sort_order)에서 처음 나온 순서다.
  const trackLabels = b.tracks as Record<string, string>;
  // 행사 전용 업적은 트랙 대신 행사별로 묶어 맨 위에 둔다 — 지금 가는 행사에서 딸 수 있는 것부터.
  const groups: { key: string; label: string; items: AchievementRow[] }[] = [];
  for (const a of locked) {
    const key = a.product_id
      ? `event:${a.product_id}`
      : a.track && trackLabels[a.track]
        ? a.track
        : 'other';
    const label = a.product_id
      ? fmtTpl(b.eventGroup, { event: eventName.get(a.product_id) ?? '' })
      : (trackLabels[key] ?? '');
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(a);
    else groups.push({ key, label, items: [a] });
  }
  groups.sort((x, y) => Number(y.key.startsWith('event:')) - Number(x.key.startsWith('event:')));

  // 행사 전용 뱃지 — 행사별로 따로 묶는다(받은 순서대로).
  for (const id of Array.from(new Set(mine.map((a) => a.product_id).filter((v): v is string => !!v)))) {
    pushEarned(
      `event:${id}`,
      fmtTpl(b.eventGroup, { event: eventName.get(id) ?? '' }),
      mine.filter((a) => a.product_id === id),
    );
  }

  const dateFmt = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <div>
      {/* 획득한 뱃지 */}
      <section>
        <h2 className="section-title">{b.earnedTitle}</h2>
        {mine.length === 0 ? (
          <p className="mt-4 rounded-lg border border-grey-200 p-6 text-center text-sm text-grey-500">
            {b.emptyEarned}
          </p>
        ) : (
          // 묶음(온라인 · 현장 · 행사)별로 나눠 4칸씩. 한 줄에 여러 개가 보여야 '모으는 맛'이 산다.
          <div className="mt-4 space-y-8">
            {earnedGroups.map((g) => (
              <div key={g.key}>
                <p className={g.key.startsWith('event:') ? 'label-caps mb-2 !text-primary' : 'label-caps mb-2'}>
                  {g.label} · {fmtTpl(b.countLabel, { n: g.items.length })}
                </p>
                {/* 폰에서도 4칸 — 한 줄에 뱃지가 두 개면 스크롤이 너무 길어진다. 칸이 좁아지는 만큼
                    여백·글자를 줄이고, 이름은 두 줄까지 허용한다. */}
                <ul className="grid grid-cols-4 gap-1.5 sm:gap-3">
            {g.items.map((a) => (
              <li
                key={a.id}
                className="flex flex-col items-center rounded-xl bg-white p-1.5 text-center sm:p-4"
              >
                {/* 뱃지 이미지는 배경이 투명한 정사각 PNG 기준 — 잘리지 않게 contain.
                    누르면 원본 크기로 확대된다(BadgeZoom). */}
                <BadgeZoom
                  imageUrl={a.badge_image_url}
                  name={pickI18n(a.name_i18n, locale) || a.code}
                  description={pickI18n(a.description_i18n, locale)}
                  earnedText={`${b.earnedAt} ${dateFmt.format(new Date(earnedAt.get(a.id) as string))}`}
                  closeLabel={b.close}
                >
                  <div className="flex aspect-square w-full max-w-[9rem] items-center justify-center">
                    {a.badge_image_url ? (
                      // 어드민이 등록한 외부 URL — next/image 최적화 대상 도메인이 아니라 img 사용
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={storageThumb(a.badge_image_url, 640)}
                        alt={pickI18n(a.name_i18n, locale) || a.code}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Award size={112} className="text-primary" aria-hidden />
                    )}
                  </div>
                </BadgeZoom>
                <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-tight [word-break:keep-all] sm:mt-2 sm:text-base sm:leading-normal">
                  {pickI18n(a.name_i18n, locale) || a.code}
                </p>
                {a.product_id && eventName.get(a.product_id) && (
                  <p className="mt-1 line-clamp-1 rounded-pill bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary sm:px-2 sm:text-[11px]">
                    {fmtTpl(b.eventOnly, { event: eventName.get(a.product_id) as string })}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] leading-tight text-grey-500 sm:mt-1 sm:text-sm sm:leading-normal">
                  {b.earnedAt} {dateFmt.format(new Date(earnedAt.get(a.id) as string))}
                </p>
              </li>
            ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 도전 중인 업적 */}
      <section className="mt-10">
        <h2 className="section-title">{b.lockedTitle}</h2>
        {locked.length === 0 ? (
          <p className="mt-4 rounded-lg border border-grey-200 p-6 text-center text-sm text-grey-500">
            {b.emptyLocked}
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {groups.map((g) => (
              <div key={g.key}>
                <p className={g.key.startsWith('event:') ? 'label-caps mb-2 !text-primary' : 'label-caps mb-2'}>
                  {g.label}
                </p>
                <ul className="space-y-3">
                  {g.items.map((a) => (
                    <li key={a.id} className="flex items-center gap-4 rounded-lg border border-grey-200 p-4">
                      {/* 잠긴 뱃지야말로 확대가 필요하다 — 64px 흑백으로는 무엇을 노리는지 알 수 없다 */}
                      <div className="h-16 w-16 shrink-0">
                        <BadgeZoom
                          imageUrl={a.badge_image_url}
                          name={pickI18n(a.name_i18n, locale) || a.code}
                          description={pickI18n(a.description_i18n, locale)}
                          closeLabel={b.close}
                        >
                          <div className="flex h-16 w-16 items-center justify-center">
                            {a.badge_image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={storageThumb(a.badge_image_url, 160)}
                                alt=""
                                className="h-full w-full object-contain opacity-40 grayscale"
                              />
                            ) : (
                              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-grey-200 bg-grey-50">
                                <Lock size={20} className="text-grey-400" aria-hidden />
                              </span>
                            )}
                          </div>
                        </BadgeZoom>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{pickI18n(a.name_i18n, locale) || a.code}</p>
                        <p className="text-sm text-grey-600">{pickI18n(a.description_i18n, locale)}</p>
                        {a.point_reward > 0 && (
                          <p className="mt-0.5 text-xs font-medium text-primary">
                            {fmtTpl(b.rewardPoint, { n: a.point_reward.toLocaleString() })}
                          </p>
                        )}
                      </div>
                      {/* 운영진 지급 업적은 '미획득' 대신 받는 방법을 알린다 — 기다려도 저절로 오지 않는다. */}
                      <span className="shrink-0 rounded-pill bg-grey-100 px-3 py-1 text-xs text-grey-500">
                        {isManual(a) ? b.manual : b.locked}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
