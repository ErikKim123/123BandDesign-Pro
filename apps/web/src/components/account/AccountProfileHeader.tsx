// 마이페이지 상단 — 내 캐릭터 + 표시 이름 + 소셜 코드 + 하트/추천 요약.
// 표시 이름은 다른 회원의 하트 목록·QR 프로필에 그대로 보이므로 회원이 직접 정한다
// (구글 계정 이메일이 그대로 노출되던 문제 해결). 캐릭터는 여성/남성 중 선택 + 다시 뽑기.
// 내 QR / QR 스캔은 소셜 탭에 있다 — 헤더는 신원 표시에 집중.
//
// 캐릭터(0061): 프리셋 고르기가 아니라 항목별 조립이다. 고른 항목만 avatar_traits 에
// 인덱스로 저장되고 나머지는 avatar_seed 에서 파생된다. '랜덤'은 미리보기만 바꾸고
// 저장을 눌러야 확정된다 — 예전 reroll 은 즉시 DB 에 써서 취소해도 되돌릴 수 없었다.
'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Heart, ImagePlus, Pencil, RefreshCw, Trash2, Users, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CharacterAvatar } from '@/components/account/CharacterAvatar';
import { downscaleSquare, AVATAR_BUCKET } from '@/lib/avatar-upload';
import {
  BACKGROUNDS,
  EYE_COLORS,
  HAIRS,
  SHIRT_COLORS,
  SKINS,
  TRAIT_LENGTH,
  newSeed,
  parseTraits,
  type AvatarTraits,
  type TraitKey,
} from '@/lib/avatar';
import type { Dictionary } from '@/i18n/dictionaries';

const NAME_MAX = 40; // profiles_name_len_check 와 동일

/** 편집기 탭 — 레퍼런스처럼 갈래를 나눈다. 한 화면에 12줄을 늘어놓으면 고르기 전에 지친다. */
function editorTabs(t: Dictionary['social']) {
  return [
    {
      id: 'face',
      label: t.tabFace,
      rows: [
        { key: 'faceShape', label: t.traitFaceShape, colors: null },
        { key: 'skin', label: t.traitSkin, colors: SKINS as readonly string[] },
      ],
    },
    {
      id: 'expression',
      label: t.tabExpression,
      rows: [
        { key: 'eyes', label: t.traitEyes, colors: null },
        { key: 'eyeColor', label: t.traitEyeColor, colors: EYE_COLORS as readonly string[] },
        { key: 'brow', label: t.traitBrow, colors: null },
        { key: 'nose', label: t.traitNose, colors: null },
        { key: 'mouth', label: t.traitMouth, colors: null },
      ],
    },
    {
      id: 'hair',
      label: t.tabHair,
      rows: [
        { key: 'hairStyle', label: t.traitHairStyle, colors: null },
        { key: 'hair', label: t.traitHair, colors: HAIRS as readonly string[] },
      ],
    },
    { id: 'glasses', label: t.tabGlasses, rows: [{ key: 'glasses', label: t.traitGlasses, colors: null }] },
    { id: 'beard', label: t.tabBeard, rows: [{ key: 'beard', label: t.traitBeard, colors: null }] },
    {
      id: 'bg',
      label: t.tabBg,
      rows: [
        { key: 'shirt', label: t.traitShirt, colors: SHIRT_COLORS as readonly string[] },
        { key: 'bg', label: t.traitBg, colors: BACKGROUNDS as readonly string[] },
      ],
    },
  ] satisfies { id: string; label: string; rows: { key: TraitKey; label: string; colors: readonly string[] | null }[] }[];
}

export function AccountProfileHeader({
  userId,
  name,
  email,
  seed,
  traits,
  code,
  heartsReceived,
  heartsGiven,
  referralCount,
  blocked,
  photoUrl,
  gender,
  t,
}: {
  userId: string;
  name: string | null;
  email: string;
  seed: string | null;
  traits: unknown;
  code: string | null;
  heartsReceived: number;
  heartsGiven: number;
  referralCount: number;
  blocked: boolean;
  /** profiles.avatar_url — 올려 둔 프로필 사진. */
  photoUrl?: string | null;
  /** profiles.gender — 선택 사항(0108). */
  gender?: string | null;
  t: Dictionary['social'];
}) {
  const router = useRouter();
  const [avatarSeed, setAvatarSeed] = useState(seed);
  const [avatarTraits, setAvatarTraits] = useState<AvatarTraits>(() => parseTraits(traits));
  // 사진은 캐릭터를 지우지 않는다 — 덮기만 한다. 사진을 빼면 고르던 캐릭터가 그대로 돌아온다.
  const [avatarPhoto, setAvatarPhoto] = useState<string | null>(photoUrl ?? null);
  const [draftPhoto, setDraftPhoto] = useState<string | null>(photoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(name ?? '');
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name ?? '');
  const [genderValue, setGenderValue] = useState(gender ?? '');
  const [draftGender, setDraftGender] = useState(gender ?? '');
  const [draftTraits, setDraftTraits] = useState<AvatarTraits>(() => parseTraits(traits));
  const [draftSeed, setDraftSeed] = useState(seed);
  const [tab, setTab] = useState('face');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 탈퇴 계정의 tombstone 이메일은 보여줄 값이 아니다.
  const showEmail = Boolean(email) && !email.includes('@deleted.invalid');

  function openEdit() {
    setDraftName(displayName);
    setDraftTraits(avatarTraits);
    setDraftSeed(avatarSeed);
    setDraftPhoto(avatarPhoto);
    setDraftGender(genderValue);
    setError(null);
    setEditing(true);
  }

  // 랜덤은 미리보기만 바꾼다 — 저장을 눌러야 확정된다(취소하면 원래 캐릭터가 그대로 남는다).
  // 고른 항목까지 전부 새로 굴리려는 것이므로 traits 를 비운다.
  function randomize() {
    setDraftSeed(newSeed());
    setDraftTraits({});
    // 사진이 덮고 있으면 새로 굴린 얼굴이 보이지 않는다 — 랜덤을 누른 뜻은 캐릭터를 보겠다는 것.
    setDraftPhoto(null);
  }

  /**
   * 프로필 사진 올리기.
   *
   * 올리는 즉시 Storage 에 저장하고 초안에만 반영한다 — '저장'을 눌러야 profiles.avatar_url 이
   * 바뀐다. 취소하면 파일은 남지만 아무도 참조하지 않는다(경로에 uid 가 들어가 남의 것을 덮지 못한다).
   *
   * 올리기 전에 한 번 줄인다. 폰 사진은 4MB 를 예사로 넘는데, 이 사진이 쓰이는 가장 큰 자리가
   * 136px 라 원본을 그대로 두면 하트 목록에서 회원 수만큼 원본을 내려받게 된다.
   */
  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError(t.photoOnlyImages);
      return;
    }
    setUploading(true);
    try {
      const blob = await downscaleSquare(file, 512);
      const path = `${userId}/${Date.now()}.webp`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { cacheControl: '31536000', upsert: true, contentType: 'image/webp' });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      setDraftPhoto(data.publicUrl);
    } catch {
      setError(t.photoUploadFailed);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function pickTrait(key: TraitKey, value: number) {
    // 이미 고른 값을 다시 누르면 '자동'(시드 파생)으로 되돌린다.
    setDraftTraits((prev) => {
      const next = { ...prev };
      if (next[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  async function save() {
    const next = draftName.trim().slice(0, NAME_MAX);
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await createClient()
        .from('profiles')
        .update({
          name: next || null,
          avatar_seed: draftSeed,
          avatar_traits: draftTraits,
          avatar_url: draftPhoto,
          gender: draftGender || null,
        })
        .eq('id', userId);
      if (err) {
        setError(t.saveFailed);
        return;
      }
      setDisplayName(next);
      setAvatarTraits(draftTraits);
      setAvatarSeed(draftSeed);
      setAvatarPhoto(draftPhoto);
      setGenderValue(draftGender);
      setEditing(false);
      router.refresh(); // 소셜 탭·하트 목록의 이름/캐릭터도 갱신
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-grey-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <CharacterAvatar
          seed={avatarSeed}
          traits={avatarTraits}
          photoUrl={avatarPhoto}
          size={88}
          label={displayName || t.noName}
          className="shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={`truncate text-lg font-semibold ${displayName ? '' : 'text-grey-400'}`}
            >
              {displayName || t.noName}
            </p>
            <button
              type="button"
              onClick={openEdit}
              title={t.editProfile}
              aria-label={t.editProfile}
              className="shrink-0 text-grey-400 transition-colors hover:text-primary"
            >
              <Pencil size={15} aria-hidden />
            </button>
          </div>
          {showEmail && <p className="truncate text-sm text-grey-500">{email}</p>}
          {code && (
            <p className="mt-1 font-mono text-xs tracking-[0.18em] text-grey-400">
              {t.myCode} · {code}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1 text-grey-600">
              <Heart size={14} className="text-primary" aria-hidden />
              {t.heartsReceived}
              <b className="tabular-nums text-ink">{heartsReceived.toLocaleString()}</b>
            </span>
            <span className="inline-flex items-center gap-1 text-grey-600">
              <Heart size={14} className="text-grey-400" aria-hidden />
              {t.heartsGiven}
              <b className="tabular-nums text-ink">{heartsGiven.toLocaleString()}</b>
            </span>
            <span className="inline-flex items-center gap-1 text-grey-600">
              <Users size={14} className="text-grey-400" aria-hidden />
              {t.referrals}
              <b className="tabular-nums text-ink">{referralCount.toLocaleString()}</b>
            </span>
          </div>
        </div>
      </div>

      {blocked && (
        <p className="mt-4 rounded-lg bg-cream px-4 py-3 text-sm text-primary-deep">
          {t.blockedNotice}
        </p>
      )}

      {editing && (
        <div className="mt-5 space-y-4 border-t border-grey-100 pt-5">
          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="space-y-1.5">
            <label className="label-caps" htmlFor="social-name">
              {t.nameLabel}
            </label>
            <input
              id="social-name"
              className="input"
              maxLength={NAME_MAX}
              placeholder={t.namePlaceholder}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <p className="text-xs text-grey-500">{t.nameHint}</p>
          </div>

          <div className="space-y-1.5">
            <label className="label-caps" htmlFor="social-gender">
              {t.genderLabel}
            </label>
            <select
              id="social-gender"
              className="input"
              value={draftGender}
              onChange={(e) => setDraftGender(e.target.value)}
            >
              <option value="">{t.genderNone}</option>
              <option value="female">{t.genderFemale}</option>
              <option value="male">{t.genderMale}</option>
              <option value="other">{t.genderOther}</option>
            </select>
          </div>

          <div className="space-y-4">
            {/* 미리보기 — 편집 중인 얼굴을 크게 보여준다. 칩만 눌러서는 뭐가 바뀌는지 안 보인다. */}
            <div className="relative overflow-hidden rounded-2xl border border-grey-200 bg-cream p-5">
              <div className="flex justify-center">
                <CharacterAvatar
                  seed={draftSeed}
                  traits={draftTraits}
                  photoUrl={draftPhoto}
                  size={136}
                  label=""
                />
              </div>
              {/* 랜덤 / 사진 올리기 — 사진이 있으면 '캐릭터로 되돌리기'로 바뀐다.
                  두 버튼을 다 두면 무엇이 지금 쓰이는지 알 수 없다. */}
              <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
                <button
                  type="button"
                  onClick={randomize}
                  disabled={busy || uploading}
                  className="inline-flex items-center gap-1 rounded-pill border border-grey-200 bg-white px-3 py-1.5 text-xs font-medium text-grey-600 transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  <RefreshCw size={13} aria-hidden /> {t.randomize}
                </button>
                {draftPhoto ? (
                  <button
                    type="button"
                    onClick={() => setDraftPhoto(null)}
                    disabled={busy || uploading}
                    className="inline-flex items-center gap-1 rounded-pill border border-grey-200 bg-white px-3 py-1.5 text-xs font-medium text-grey-600 transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
                  >
                    <Trash2 size={13} aria-hidden /> {t.photoRemove}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy || uploading}
                    className="inline-flex items-center gap-1 rounded-pill border border-grey-200 bg-white px-3 py-1.5 text-xs font-medium text-grey-600 transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    <ImagePlus size={13} aria-hidden /> {uploading ? t.photoUploading : t.photoUpload}
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onPickPhoto}
              />
              {draftPhoto && (
                <p className="mt-3 text-center text-xs text-grey-500">{t.photoInUse}</p>
              )}
            </div>

            {/* 탭 — 항목이 10개라 한 화면에 늘어놓으면 고르기 전에 지친다 */}
            <div role="tablist" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {editorTabs(t).map((g) => (
                <button
                  key={g.id}
                  role="tab"
                  type="button"
                  aria-selected={tab === g.id}
                  onClick={() => setTab(g.id)}
                  className={`shrink-0 rounded-pill px-4 py-1.5 text-sm transition-colors ${
                    tab === g.id
                      ? 'bg-ink text-white'
                      : 'border border-grey-200 text-grey-500 hover:border-grey-300'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {editorTabs(t)
              .filter((g) => g.id === tab)
              .map((g) => (
                <div key={g.id} className="space-y-3.5">
                  {g.rows.map((row) => (
                    <div key={row.key} className="space-y-1.5">
                      <span className="text-xs font-medium text-grey-500">{row.label}</span>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: TRAIT_LENGTH[row.key] }, (_, i) => {
                          const on = draftTraits[row.key] === i;
                          // 선택지는 전부 같은 카드 규격이다 — 색이든 모양이든 줄이 흐트러지지 않게.
                          const card = `flex items-center justify-center rounded-xl border-2 transition-colors ${
                            on
                              ? 'border-primary bg-cream'
                              : 'border-grey-200 bg-white hover:border-grey-300'
                          }`;
                          return row.colors ? (
                            <button
                              key={i}
                              type="button"
                              onClick={() => pickTrait(row.key, i)}
                              aria-pressed={on}
                              aria-label={`${row.label} ${i + 1}`}
                              className={`${card} h-12 w-12`}
                            >
                              <span
                                className="h-7 w-7 rounded-lg"
                                style={{ backgroundColor: row.colors[i] }}
                              />
                            </button>
                          ) : (
                            <button
                              key={i}
                              type="button"
                              onClick={() => pickTrait(row.key, i)}
                              aria-pressed={on}
                              aria-label={`${row.label} ${i + 1}`}
                              className={`${card} h-16 w-16 overflow-hidden p-1`}
                            >
                              <CharacterAvatar
                                seed={draftSeed}
                                traits={{ ...draftTraits, [row.key]: i }}
                                size={54}
                                label=""
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

            <p className="text-xs text-grey-400">{t.resetTrait}</p>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={save} disabled={busy} className="btn btn-primary btn-sm">
              <Check size={15} aria-hidden /> {busy ? t.saving : t.save}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              className="btn btn-secondary btn-sm"
            >
              <X size={15} aria-hidden /> {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
