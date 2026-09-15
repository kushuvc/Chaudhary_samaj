import type { ProfileType } from '../screens/SignupProfileTypeScreen';

/**
 * Who the signup questions are about.
 *
 * Most members register for a relative, not themselves, so screens that say
 * "your eating habits" read wrongly for a father filling in his daughter's
 * profile. This turns the choice made on the first screen into the words the
 * later screens use.
 */
export interface ProfileSubject {
  /** "yourself", "your daughter" — for "Tell us about …". */
  full: string;
  /** "your", "her", "his", "their" — for "… eating habits". */
  possessive: string;
  /** "you", "she", "he", "they". */
  pronoun: string;
  /** "are", "is" — agrees with `pronoun`. */
  verb: string;
  /** True when the member is registering for themselves. */
  isSelf: boolean;
}

const SELF: ProfileSubject = {
  full: 'yourself',
  possessive: 'your',
  pronoun: 'you',
  verb: 'are',
  isSelf: false,
};

function relative(noun: string, possessive: string, pronoun: string): ProfileSubject {
  // "they" takes a plural verb even for one person — "what are they into", not
  // "what is they into".
  const verb = pronoun === 'they' ? 'are' : 'is';
  return { full: `your ${noun}`, possessive, pronoun, verb, isSelf: false };
}

const SUBJECTS: Record<ProfileType, ProfileSubject> = {
  myself: { ...SELF, isSelf: true },
  daughter: relative('daughter', 'her', 'she'),
  sister: relative('sister', 'her', 'she'),
  son: relative('son', 'his', 'he'),
  brother: relative('brother', 'his', 'he'),
  // Gender is not implied by these, so they stay neutral.
  friend: relative('friend', 'their', 'they'),
  relative: relative('relative', 'their', 'they'),
};

export function subjectFor(profileType?: ProfileType | null): ProfileSubject {
  if (!profileType) return { ...SELF, isSelf: true };
  return SUBJECTS[profileType] ?? { ...SELF, isSelf: true };
}

/** Capitalises the first letter, for use at the start of a title. */
export function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
