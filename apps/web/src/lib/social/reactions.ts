// 소셜 반응 5종 — DB(social_hearts.kind)의 허용값과 1:1 로 맞춘다(마이그레이션 0046).
// 순서가 곧 화면에 보이는 버튼 순서다.
import type { Dictionary } from '@/i18n/dictionaries';

export const REACTION_KINDS = ['heart', 'thumbs', 'dance', 'fire', 'clap'] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const REACTION_EMOJI: Record<ReactionKind, string> = {
  heart: '❤️',
  thumbs: '👍',
  dance: '💃',
  fire: '🔥',
  clap: '👏',
};

/** 알 수 없는 값(구버전 행·미래 확장)은 하트로 보여준다. */
export function reactionEmoji(kind: string | null | undefined): string {
  return REACTION_EMOJI[(kind ?? 'heart') as ReactionKind] ?? REACTION_EMOJI.heart;
}

export function reactionLabel(t: Dictionary['social'], kind: ReactionKind): string {
  return t.reactions[kind];
}
