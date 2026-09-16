import type { AppLanguage } from '../context/LanguageContext';
import type { ProfileType } from '../screens/SignupProfileTypeScreen';

/**
 * Who the signup questions are about.
 *
 * Most members register for a relative, not themselves, so screens that say
 * "your eating habits" read wrongly for a father filling in his daughter's
 * profile. This turns the choice made on the first screen into the words the
 * later screens use — in whichever language the member picked, since dropping
 * an English "her" into a Gujarati sentence would read worse than not
 * personalising it at all.
 */
export interface ProfileSubject {
  /** "yourself", "your daughter" — for "Tell us about …". */
  full: string;
  /** "your", "her", "his", "their" — for "… eating habits". */
  possessive: string;
  /** "you", "she", "he", "they". */
  pronoun: string;
  /** "are", "is" — agrees with `pronoun`. Empty where a language needs none. */
  verb: string;
  /** True when the member is registering for themselves. */
  isSelf: boolean;
}

type Table = Record<ProfileType, ProfileSubject>;

function build(
  entries: Record<ProfileType, [full: string, possessive: string, pronoun: string, verb: string]>
): Table {
  const out = {} as Table;
  for (const [type, [full, possessive, pronoun, verb]] of Object.entries(entries) as Array<
    [ProfileType, [string, string, string, string]]
  >) {
    out[type] = { full, possessive, pronoun, verb, isSelf: type === 'myself' };
  }
  return out;
}

const EN = build({
  myself: ['yourself', 'your', 'you', 'are'],
  daughter: ['your daughter', 'her', 'she', 'is'],
  sister: ['your sister', 'her', 'she', 'is'],
  son: ['your son', 'his', 'he', 'is'],
  brother: ['your brother', 'his', 'he', 'is'],
  // Neither implies a gender, so these stay neutral — and "they" takes a
  // plural verb even for one person.
  friend: ['your friend', 'their', 'they', 'are'],
  relative: ['your relative', 'their', 'they', 'are'],
});

const HI = build({
  myself: ['अपने बारे में', 'आपकी', 'आप', ''],
  daughter: ['अपनी बेटी के बारे में', 'उनकी', 'वे', ''],
  sister: ['अपनी बहन के बारे में', 'उनकी', 'वे', ''],
  son: ['अपने बेटे के बारे में', 'उनकी', 'वे', ''],
  brother: ['अपने भाई के बारे में', 'उनकी', 'वे', ''],
  friend: ['अपने मित्र के बारे में', 'उनकी', 'वे', ''],
  relative: ['अपने रिश्तेदार के बारे में', 'उनकी', 'वे', ''],
});

const GU = build({
  myself: ['તમારા વિશે', 'તમારી', 'તમે', ''],
  daughter: ['તમારી દીકરી વિશે', 'તેમની', 'તેઓ', ''],
  sister: ['તમારી બહેન વિશે', 'તેમની', 'તેઓ', ''],
  son: ['તમારા દીકરા વિશે', 'તેમની', 'તેઓ', ''],
  brother: ['તમારા ભાઈ વિશે', 'તેમની', 'તેઓ', ''],
  friend: ['તમારા મિત્ર વિશે', 'તેમની', 'તેઓ', ''],
  relative: ['તમારા સંબંધી વિશે', 'તેમની', 'તેઓ', ''],
});

const TABLES: Record<AppLanguage, Table> = {
  'en-IN': EN,
  'hi-IN': HI,
  'gu-IN': GU,
};

export function subjectFor(
  profileType?: ProfileType | null,
  language: AppLanguage | null = 'en-IN'
): ProfileSubject {
  const table = TABLES[language ?? 'en-IN'] ?? EN;
  return table[profileType ?? 'myself'] ?? table.myself;
}

/** Capitalises the first letter, for use at the start of a title. */
export function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
