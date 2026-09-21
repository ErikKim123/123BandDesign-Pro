// 라이브 방송의 유튜브 영상 지정.
// 어떤 형태로 붙여넣어도 ID 11자만 저장한다(파서는 @123band/shared 의 youtubeVideoId — 단위 테스트로 고정).
// 파싱되면 바로 아래에 미리보기를 띄운다 — 엉뚱한 영상을 라이브로 거는 사고를 눈으로 막는 장치다.
'use client';
import { useEffect, useState } from 'react';
import { youtubeVideoId } from '@123band/shared';
import { tr } from '@/i18n/tr';
import { cn } from '@/lib/utils';

export function YoutubeField({
  value,
  onChange,
}: {
  /** 저장되는 값 — 영상 ID 11자 또는 null */
  value: string | null;
  onChange: (videoId: string | null) => void;
}) {
  // 입력칸은 사람이 붙여넣은 원문을 그대로 들고, 저장값(ID)은 따로 계산한다.
  const [raw, setRaw] = useState(value ?? '');
  const [touched, setTouched] = useState(false);

  // 바깥에서 값이 바뀌면(다른 행을 열었을 때) 입력칸도 따라간다.
  useEffect(() => {
    setRaw(value ?? '');
    setTouched(false);
  }, [value]);

  const parsed = youtubeVideoId(raw);
  const invalid = touched && raw.trim().length > 0 && !parsed;

  function apply(next: string) {
    setRaw(next);
    setTouched(true);
    onChange(youtubeVideoId(next));
  }

  return (
    <div className="space-y-1.5">
      <label className="label-caps">{tr('유튜브 주소 또는 영상 ID')}</label>
      <input
        className={cn('input', invalid && 'input-error')}
        value={raw}
        placeholder="https://www.youtube.com/watch?v=… / https://youtu.be/… / 영상 ID 11자"
        onChange={(e) => apply(e.target.value)}
        onBlur={() => setTouched(true)}
      />
      {invalid ? (
        <p className="text-[11px] text-danger">
          {tr('유튜브 주소를 알아보지 못했습니다. 주소창의 주소를 그대로 붙여넣거나 영상 ID 11자를 입력하세요.')}
        </p>
      ) : parsed ? (
        <p className="text-[11px] text-grey-500">
          {tr('영상 ID')}: <span className="font-mono text-black">{parsed}</span>
        </p>
      ) : (
        <p className="text-[11px] text-grey-400">
          {tr('유튜브 스튜디오의 라이브 관리 주소도 그대로 붙여넣을 수 있습니다.')}
        </p>
      )}

      {parsed && (
        <div className="space-y-1 pt-1">
          <div className="aspect-video w-full max-w-md overflow-hidden rounded-sm border border-grey-200 bg-grey-100">
            <iframe
              key={parsed}
              src={`https://www.youtube-nocookie.com/embed/${parsed}`}
              title={tr('미리보기')}
              className="h-full w-full"
              allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
          <p className="text-[11px] text-grey-500">
            {tr('이 영상이 맞는지 확인하세요. 방송 시작을 누르면 시청자에게 이 영상이 나갑니다.')}
          </p>
        </div>
      )}
    </div>
  );
}
