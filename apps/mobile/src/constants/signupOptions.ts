/** Option lists shared across the signup flow. */

export const MOTHER_TONGUES = [
  'Hindi', 'Gujarati', 'Marathi', 'Punjabi', 'Rajasthani', 'Haryanvi', 'Bengali',
  'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Odia', 'Assamese', 'Urdu', 'English', 'Other',
];

export const RELIGIONS = [
  'Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Parsi', 'Jewish', 'Other',
];

export const CASTES = [
  'Chaudhary', 'Patel', 'Brahmin', 'Kshatriya', 'Vaishya', 'Jat', 'Gurjar',
  'Scheduled Caste', 'Scheduled Tribe', 'Other',
];

export const SUBCASTES: Record<string, string[]> = {
  Chaudhary: ['Anjana', 'Desai', 'Jat', 'Kadva', 'Leva', 'Other'],
  Patel: ['Kadva', 'Leva', 'Anjana', 'Matia', 'Other'],
  Brahmin: ['Audichya', 'Nagar', 'Shrimali', 'Modh', 'Other'],
  Jat: ['Deshwal', 'Malik', 'Dahiya', 'Other'],
};

export const DOSH_OPTIONS = [
  { id: 'no', label: 'No' },
  { id: 'yes', label: 'Yes' },
  { id: 'dont_know', label: "Don't know" },
];

export const COUNTRIES = ['India', 'USA', 'UK', 'Canada', 'Australia', 'UAE', 'Other'];

export const STATES: Record<string, string[]> = {
  India: [
    'Gujarat', 'Rajasthan', 'Maharashtra', 'Delhi', 'Haryana', 'Punjab',
    'Madhya Pradesh', 'Uttar Pradesh', 'Karnataka', 'Tamil Nadu', 'Other',
  ],
  USA: ['California', 'Texas', 'New Jersey', 'New York', 'Illinois', 'Other'],
  UK: ['England', 'Scotland', 'Wales', 'Northern Ireland', 'Other'],
  Canada: ['Ontario', 'British Columbia', 'Alberta', 'Quebec', 'Other'],
  Australia: ['New South Wales', 'Victoria', 'Queensland', 'Other'],
  UAE: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Other'],
};

export const CITIES: Record<string, string[]> = {
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar', 'Bhuj', 'Mehsana', 'Patan', 'Other'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Other'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Other'],
  Delhi: ['New Delhi', 'Dwarka', 'Rohini', 'Other'],
  Haryana: ['Gurugram', 'Faridabad', 'Hisar', 'Other'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Other'],
};

export const HEIGHTS = (() => {
  const list: { id: string; label: string }[] = [];
  for (let inches = 48; inches <= 84; inches += 1) {
    const ft = Math.floor(inches / 12);
    const inch = inches % 12;
    const cm = Math.round(inches * 2.54);
    list.push({ id: `${inches}`, label: `${ft} ft ${inch} in (${cm} cm)` });
  }
  return list;
})();

export const MARITAL_STATUSES = [
  { id: 'never_married', label: 'Never married' },
  { id: 'widowed', label: 'Widow / Widower' },
  { id: 'awaiting_divorce', label: 'Awaiting divorce' },
  { id: 'divorced', label: 'Divorced' },
];

export const PHYSICAL_STATUSES = [
  { id: 'normal', label: 'Normal' },
  { id: 'physically_challenged', label: 'Physically challenged' },
];

export const EDUCATION_LEVELS = [
  'B.A - Bachelor of Arts',
  'B.Com - Bachelor of Commerce',
  'B.Sc - Bachelor of Science',
  'B.E / B.Tech - Engineering',
  'B.Plan - Bachelor of Planning',
  'BBA - Business Administration',
  'BCA - Computer Applications',
  'MBBS',
  'M.A - Master of Arts',
  'M.Com - Master of Commerce',
  'M.Sc - Master of Science',
  'M.E / M.Tech',
  'MBA',
  'MCA',
  'CA / CS / ICWA',
  'Ph.D',
  'Diploma',
  'Higher Secondary',
  'Other',
];

export const EMPLOYMENT_TYPES = [
  'Private',
  'Government / PSU',
  'Business / Self Employed',
  'Defence',
  'Civil Services',
  'Not Working',
];

export const OCCUPATIONS = [
  'Software Professional', 'Doctor', 'Engineer', 'Teacher / Professor', 'Accountant',
  'Banking Professional', 'Business Owner', 'Farmer', 'Government Employee', 'Lawyer',
  'Architect', 'Designer', 'Sales / Marketing', 'Civil Services', 'Defence Services',
  'Student', 'Not Working', 'Other',
];

// The mother's list leads with Housewife, the most common answer there. The
// member's own and the father's lists stay as they are.
export const MOTHER_OCCUPATIONS = ['Housewife', ...OCCUPATIONS];

export const INCOME_CURRENCIES = [
  { id: 'INR', label: '₹ INR - Indian Rupee' },
  { id: 'USD', label: '$ USD - US Dollar' },
  { id: 'GBP', label: '£ GBP - Pound Sterling' },
  { id: 'CAD', label: '$ CAD - Canadian Dollar' },
  { id: 'AUD', label: '$ AUD - Australian Dollar' },
  { id: 'AED', label: 'AED - UAE Dirham' },
];

export const INCOME_RANGES_INR = [
  'Below 1 Lakh', '1 - 3 Lakh', '3 - 5 Lakh', '5 - 7 Lakh', '7 - 10 Lakh',
  '10 - 15 Lakh', '15 - 20 Lakh', '20 - 30 Lakh', '30 - 50 Lakh', '50 Lakh & above',
];

export const INCOME_RANGES_FOREIGN = [
  'Below 25,000', '25,000 - 50,000', '50,000 - 75,000', '75,000 - 100,000',
  '100,000 - 150,000', '150,000 - 200,000', '200,000 & above',
];

export const FAMILY_STATUSES = [
  { id: 'middle_class', label: 'Middle class' },
  { id: 'upper_middle_class', label: 'Upper middle class' },
  { id: 'rich_affluent', label: 'Rich / Affluent (Elite)' },
];

export const FAMILY_TYPES = [
  { id: 'joint', label: 'Joint family' },
  { id: 'nuclear', label: 'Nuclear family' },
];

export const FAMILY_WEALTH = [
  { id: 'middle', label: 'Middle' },
  { id: 'upper_middle', label: 'Upper middle' },
  { id: 'affluent', label: 'Affluent' },
];

export const EATING_HABITS = [
  { id: 'vegetarian', label: 'Vegetarian', icon: 'leaf-outline' as const },
  { id: 'non_vegetarian', label: 'Non-Vegetarian', icon: 'restaurant-outline' as const },
  { id: 'eggetarian', label: 'Eggetarian', icon: 'egg-outline' as const },
];

export const BIRTH_TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of ['00', '30']) {
      const suffix = hour < 12 ? 'AM' : 'PM';
      const display = hour % 12 === 0 ? 12 : hour % 12;
      slots.push(`${String(display).padStart(2, '0')}:${minute} ${suffix}`);
    }
  }
  return slots;
})();

export const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu',
  'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hastha / Atham',
  'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Moola', 'Purva Ashadha',
  'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada',
  'Uttara Bhadrapada', 'Revati',
];

export const RAASIS = [
  'Mesha (Aries)', 'Vrishabha (Taurus)', 'Mithuna (Gemini)', 'Karka (Cancer)',
  'Simha (Leo)', 'Kanya (Virgo)', 'Tula (Libra)', 'Vrischika (Scorpio)',
  'Dhanu (Sagittarius)', 'Makara (Capricorn)', 'Kumbha (Aquarius)', 'Meena (Pisces)',
];

export const HOBBIES = [
  'Art / Handicraft', 'Cooking', 'Dancing', 'Gardening / Landscaping', 'Nature',
  'Painting', 'Pets', 'Photography', 'Playing Musical Instruments', 'Puzzles',
  'Reading', 'Travelling', 'Volunteering', 'Writing', 'Movies', 'Yoga / Meditation',
];

export const MUSIC_GENRES = [
  'Film Songs', 'Indian / Classical Music', 'Western Music', 'Folk Music',
  'Devotional', 'Ghazals', 'Instrumental', 'Pop', 'Rock',
];

export const SPORTS = [
  'Adventure Sports', 'Aerobics', 'Badminton', 'Baseball', 'Basketball',
  'Billiards / Snooker / Pool', 'Bowling', 'Card Games', 'Carrom', 'Chess',
  'Cricket', 'Cycling', 'Football', 'Gym / Fitness', 'Hockey', 'Kabaddi',
  'Running', 'Swimming', 'Table Tennis', 'Tennis', 'Volleyball', 'Yoga',
];

export const CUISINES = [
  'Arabic', 'Bengali', 'Chinese', 'Continental', 'Fast Food', 'Gujarati',
  "I'm A Foodie", 'Italian', 'Konkan', 'Mexican', 'Moghlai', 'Not A Foodie',
  'Punjabi', 'Rajasthani', 'South Indian', 'Spanish', 'Sushi', 'Thai',
];

/*
 * Labels are translation keys, not text.
 *
 * Who the profile is for is the first choice a member makes, so it follows
 * the language they picked. The reference lists further down this file —
 * castes, education, occupations — stay in English on purpose.
 */
export const PROFILE_TYPES = [
  { id: 'myself', label: 'suRelMyself', icon: 'person-outline' as const },
  { id: 'son', label: 'suRelSon', icon: 'man-outline' as const },
  { id: 'daughter', label: 'suRelDaughter', icon: 'woman-outline' as const },
  { id: 'brother', label: 'suRelBrother', icon: 'people-outline' as const },
  { id: 'sister', label: 'suRelSister', icon: 'people-outline' as const },
  { id: 'friend', label: 'suRelFriend', icon: 'happy-outline' as const },
  { id: 'relative', label: 'suRelRelative', icon: 'people-circle-outline' as const },
];
