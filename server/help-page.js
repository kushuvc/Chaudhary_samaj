/*
 * Public help page at /help: the in-app guide (app_guide_sections, so admin
 * edits show here too) plus common questions, in English, Hindi and Gujarati.
 * The support auto-reply links here so a member can often solve the problem
 * before anyone answers. Button names match the app's own labels.
 */

export const HELP_LANGS = ['en', 'hi', 'gu']

export const FAQ = [
  {
    q: {
      en: 'How do I create a profile?',
      hi: 'प्रोफ़ाइल कैसे बनाएँ?',
      gu: 'પ્રોફાઇલ કેવી રીતે બનાવવી?',
    },
    a: {
      en: 'Open the app, choose your language and tap "Create your profile". Choose who the profile is for (yourself, son, daughter…), then fill in name, email, password and mobile number. We email a 6-digit code: type it in (check Spam if it is not in your inbox). Then answer the questions step by step (personal, religion, location, education, family), add 1–2 photos, and you are done. Optional steps can be skipped and filled in later from the Profile tab.',
      hi: 'ऐप खोलें, भाषा चुनें और "अपनी प्रोफ़ाइल बनाएँ" दबाएँ। चुनें कि प्रोफ़ाइल किसके लिए है (स्वयं, बेटा, बेटी…), फिर नाम, ईमेल, पासवर्ड और मोबाइल नंबर भरें। हम 6 अंकों का कोड ईमेल करते हैं: उसे डालें (इनबॉक्स में न हो तो स्पैम देखें)। फिर एक-एक करके सवालों के जवाब दें (व्यक्तिगत, धर्म, स्थान, शिक्षा, परिवार), 1–2 फ़ोटो जोड़ें, बस हो गया। वैकल्पिक चरण छोड़ सकते हैं और बाद में प्रोफ़ाइल टैब से भर सकते हैं।',
      gu: 'એપ ખોલો, ભાષા પસંદ કરો અને "તમારી પ્રોફાઇલ બનાવો" દબાવો. પસંદ કરો કે પ્રોફાઇલ કોના માટે છે (પોતે, દીકરો, દીકરી…), પછી નામ, ઈમેલ, પાસવર્ડ અને મોબાઇલ નંબર ભરો. અમે 6 અંકનો કોડ ઈમેલ કરીએ છીએ: તે નાખો (ઇનબૉક્સમાં ન હોય તો સ્પામ જુઓ). પછી એક પછી એક પ્રશ્નોના જવાબ આપો (વ્યક્તિગત, ધર્મ, સ્થાન, શિક્ષણ, પરિવાર), 1–2 ફોટા ઉમેરો, બસ થઈ ગયું. વૈકલ્પિક પગલાં છોડી શકો છો અને પછી પ્રોફાઇલ ટૅબમાંથી ભરી શકો છો.',
    },
  },
  {
    q: {
      en: 'I paid, but my plan is not active / profiles are still locked',
      hi: 'मैंने भुगतान किया, लेकिन प्लान चालू नहीं हुआ / प्रोफ़ाइल अब भी बंद हैं',
      gu: 'મેં ચુકવણી કરી, પણ પ્લાન ચાલુ થયો નથી / પ્રોફાઇલ હજુ બંધ છે',
    },
    a: {
      en: 'Open the Plans tab and tap "Already paid? Restore purchase". Make sure the phone uses the same Google account you paid with. If it is still locked after a few minutes, reply to our email with the Google Play order number (it starts with GPA., in the receipt Google emailed you).',
      hi: 'योजनाएँ टैब खोलें और "पहले ही भुगतान किया? ख़रीद पुनर्स्थापित करें" दबाएँ। ध्यान रखें कि फ़ोन में वही Google खाता हो जिससे भुगतान किया था। कुछ मिनट बाद भी बंद हो, तो हमारे ईमेल का जवाब Google Play ऑर्डर नंबर के साथ दें (GPA. से शुरू होता है, Google की रसीद वाले ईमेल में मिलेगा)।',
      gu: 'યોજનાઓ ટૅબ ખોલો અને "પહેલેથી ચૂકવ્યું? ખરીદી પુનઃસ્થાપિત કરો" દબાવો. ધ્યાન રાખો કે ફોનમાં એ જ Google એકાઉન્ટ હોય જેનાથી ચુકવણી કરી હતી. થોડી મિનિટ પછી પણ બંધ હોય, તો અમારા ઈમેલનો જવાબ Google Play ઓર્ડર નંબર સાથે આપો (GPA.થી શરૂ થાય છે, Googleની રસીદવાળા ઈમેલમાં મળશે).',
    },
  },
  {
    q: {
      en: 'How do I cancel my subscription?',
      hi: 'सब्सक्रिप्शन कैसे रद्द करें?',
      gu: 'સબ્સ્ક્રિપ્શન કેવી રીતે રદ કરવું?',
    },
    a: {
      en: 'Open the Play Store app, tap your photo at the top, then Payments and subscriptions → Subscriptions. Choose Chaudhary Samaj and tap Cancel. You keep full access until the period you paid for ends.',
      hi: 'Play Store ऐप खोलें, ऊपर अपनी फ़ोटो दबाएँ, फिर Payments and subscriptions → Subscriptions। Chaudhary Samaj चुनें और Cancel दबाएँ। जिस अवधि का भुगतान किया है, उसके ख़त्म होने तक पूरी सुविधा मिलती रहेगी।',
      gu: 'Play Store એપ ખોલો, ઉપર તમારો ફોટો દબાવો, પછી Payments and subscriptions → Subscriptions. Chaudhary Samaj પસંદ કરો અને Cancel દબાવો. જે સમયગાળાની ચુકવણી કરી છે તે પૂરો થાય ત્યાં સુધી બધી સુવિધા મળતી રહેશે.',
    },
  },
  {
    q: {
      en: 'I did not get the email code',
      hi: 'मुझे ईमेल पर कोड नहीं मिला',
      gu: 'મને ઈમેલ પર કોડ મળ્યો નથી',
    },
    a: {
      en: 'Check the Spam, Junk and Promotions folders; the code can land there. Make sure the email address is typed correctly, wait a minute, then request a new code. Each code works for 5 minutes.',
      hi: 'स्पैम, जंक और Promotions फ़ोल्डर देखें; कोड वहाँ जा सकता है। ईमेल पता सही लिखा है यह जाँचें, एक मिनट रुकें, फिर नया कोड माँगें। हर कोड 5 मिनट तक चलता है।',
      gu: 'સ્પામ, જંક અને Promotions ફોલ્ડર જુઓ; કોડ ત્યાં જઈ શકે છે. ઈમેલ સરનામું સાચું લખ્યું છે તે તપાસો, એક મિનિટ રાહ જુઓ, પછી નવો કોડ માંગો. દરેક કોડ 5 મિનિટ ચાલે છે.',
    },
  },
  {
    q: {
      en: 'I forgot my password',
      hi: 'मैं पासवर्ड भूल गया/गई',
      gu: 'હું પાસવર્ડ ભૂલી ગયો/ગઈ',
    },
    a: {
      en: 'On the login screen tap "Forgot password?", enter your email and the code we send you, then choose a new password. You can also tap "Email me a code instead" to log in without a password.',
      hi: 'लॉगिन स्क्रीन पर "पासवर्ड भूल गए?" दबाएँ, अपना ईमेल और हमारा भेजा कोड डालें, फिर नया पासवर्ड चुनें। बिना पासवर्ड के लॉगिन के लिए "इसके बजाय मुझे कोड ईमेल करें" भी दबा सकते हैं।',
      gu: 'લૉગિન સ્ક્રીન પર "પાસવર્ડ ભૂલી ગયા?" દબાવો, તમારો ઈમેલ અને અમે મોકલેલો કોડ નાખો, પછી નવો પાસવર્ડ પસંદ કરો. પાસવર્ડ વગર લૉગિન માટે "તેના બદલે મને કોડ ઈમેલ કરો" પણ દબાવી શકો છો.',
    },
  },
  {
    q: {
      en: 'How do I see someone’s phone number?',
      hi: 'किसी का फ़ोन नंबर कैसे देखें?',
      gu: 'કોઈનો ફોન નંબર કેવી રીતે જોવો?',
    },
    a: {
      en: 'Your plan must include phone numbers, and both of you must have accepted each other’s interest. This keeps every member safe.',
      hi: 'आपके प्लान में फ़ोन नंबर शामिल होना चाहिए, और आप दोनों ने एक-दूसरे की रुचि स्वीकार की हो। इससे हर सदस्य सुरक्षित रहता है।',
      gu: 'તમારા પ્લાનમાં ફોન નંબર સામેલ હોવો જોઈએ, અને તમે બંનેએ એકબીજાની રુચિ સ્વીકારી હોવી જોઈએ. આથી દરેક સભ્ય સુરક્ષિત રહે છે.',
    },
  },
  {
    q: {
      en: 'Someone is misbehaving or the profile looks fake',
      hi: 'कोई ग़लत व्यवहार कर रहा है या प्रोफ़ाइल नकली लगती है',
      gu: 'કોઈ ખોટું વર્તન કરે છે અથવા પ્રોફાઇલ નકલી લાગે છે',
    },
    a: {
      en: 'Open their profile and tap "Report this profile", or use the ⋮ menu in the chat. They are hidden from you at once and our team reviews every report. Never send money to anyone.',
      hi: 'उनकी प्रोफ़ाइल खोलें और "इस प्रोफ़ाइल की शिकायत करें" दबाएँ, या चैट में ⋮ मेनू का उपयोग करें। वे तुरंत आपसे छिप जाते हैं और हमारी टीम हर शिकायत देखती है। किसी को भी कभी पैसे न भेजें।',
      gu: 'તેમની પ્રોફાઇલ ખોલો અને "આ પ્રોફાઇલની ફરિયાદ કરો" દબાવો, અથવા ચૅટમાં ⋮ મેનુ વાપરો. તેઓ તરત તમારાથી છુપાઈ જાય છે અને અમારી ટીમ દરેક ફરિયાદ તપાસે છે. કોઈને પણ ક્યારેય પૈસા ન મોકલો.',
    },
  },
  {
    q: {
      en: 'I want to make a profile for my son or daughter',
      hi: 'मैं अपने बेटे या बेटी की प्रोफ़ाइल बनाना चाहता/चाहती हूँ',
      gu: 'હું મારા દીકરા કે દીકરીની પ્રોફાઇલ બનાવવા માંગું છું',
    },
    a: {
      en: 'Yes, you can. At the start of sign-up choose who the profile is for (Son or Daughter) and fill in their details. For the ✓ Verified badge, scan their Aadhaar, not yours.',
      hi: 'हाँ, बना सकते हैं। साइन-अप की शुरुआत में चुनें कि प्रोफ़ाइल किसके लिए है (बेटा या बेटी) और उनकी जानकारी भरें। ✓ सत्यापित बैज के लिए उनका आधार स्कैन करें, अपना नहीं।',
      gu: 'હા, બનાવી શકો છો. સાઇન-અપની શરૂઆતમાં પસંદ કરો કે પ્રોફાઇલ કોના માટે છે (દીકરો કે દીકરી) અને તેમની વિગતો ભરો. ✓ ચકાસેલ બેજ માટે તેમનું આધાર સ્કેન કરો, તમારું નહીં.',
    },
  },
  {
    q: {
      en: 'How do I change my email or phone number?',
      hi: 'ईमेल या फ़ोन नंबर कैसे बदलें?',
      gu: 'ઈમેલ કે ફોન નંબર કેવી રીતે બદલવો?',
    },
    a: {
      en: 'These cannot be changed in the app. Reply to our email with the new details and we will update them for you.',
      hi: 'ये ऐप में नहीं बदलते। नई जानकारी के साथ हमारे ईमेल का जवाब दें, हम आपके लिए बदल देंगे।',
      gu: 'આ એપમાં બદલાતા નથી. નવી વિગતો સાથે અમારા ઈમેલનો જવાબ આપો, અમે તમારા માટે બદલી આપીશું.',
    },
  },
  {
    q: {
      en: 'How do I delete my account?',
      hi: 'अपना खाता कैसे हटाएँ?',
      gu: 'મારું એકાઉન્ટ કેવી રીતે ડિલીટ કરવું?',
    },
    a: {
      en: 'Open the Settings tab, scroll to Danger Zone, tap "Delete My Account" and type DELETE to confirm. This removes your profile, photos and chats permanently. Cancel any Google Play subscription separately.',
      hi: 'सेटिंग्स टैब खोलें, नीचे खतरा क्षेत्र तक जाएँ, "मेरा खाता हटाएं" दबाएँ और पुष्टि के लिए DELETE लिखें। इससे आपकी प्रोफ़ाइल, फ़ोटो और चैट हमेशा के लिए हट जाती हैं। Google Play सब्सक्रिप्शन अलग से रद्द करें।',
      gu: 'સેટિંગ્સ ટૅબ ખોલો, નીચે જોખમ વિસ્તાર સુધી જાઓ, "મારું એકાઉન્ટ ડિલીટ કરો" દબાવો અને પુષ્ટિ માટે DELETE લખો. આથી તમારી પ્રોફાઇલ, ફોટા અને ચૅટ કાયમ માટે દૂર થાય છે. Google Play સબ્સ્ક્રિપ્શન અલગથી રદ કરો.',
    },
  },
]

const UI = {
  en: {
    title: 'Help — Chaudhary Samaj',
    heading: 'Help and common questions',
    intro: 'Most questions are answered below. If yours is not, reply to our email or write to',
    faq: 'Common questions',
    guide: 'How to use the app',
  },
  hi: {
    title: 'सहायता — चौधरी समाज',
    heading: 'सहायता और आम सवाल',
    intro: 'ज़्यादातर सवालों के जवाब नीचे हैं। अगर आपका सवाल नहीं है, तो हमारे ईमेल का जवाब दें या लिखें',
    faq: 'आम सवाल',
    guide: 'ऐप कैसे इस्तेमाल करें',
  },
  gu: {
    title: 'સહાય — ચૌધરી સમાજ',
    heading: 'સહાય અને સામાન્ય પ્રશ્નો',
    intro: 'મોટા ભાગના પ્રશ્નોના જવાબ નીચે છે. જો તમારો પ્રશ્ન ન હોય, તો અમારા ઈમેલનો જવાબ આપો અથવા લખો',
    faq: 'સામાન્ય પ્રશ્નો',
    guide: 'એપ કેવી રીતે વાપરવી',
  },
}

export const helpLang = (value) => (HELP_LANGS.includes(String(value)) ? String(value) : 'en')

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** The whole page; `guide` is active app_guide_sections rows. */
export function renderHelpPage(lang, guide) {
  const l = helpLang(lang)
  const ui = UI[l]
  const tabs = HELP_LANGS.map((code) =>
    code === l
      ? `<b>${{ en: 'English', hi: 'हिन्दी', gu: 'ગુજરાતી' }[code]}</b>`
      : `<a href="/help?lang=${code}">${{ en: 'English', hi: 'हिन्दी', gu: 'ગુજરાતી' }[code]}</a>`
  ).join(' · ')
  const faq = FAQ.map((item) => `<details><summary>${esc(item.q[l])}</summary><p>${esc(item.a[l])}</p></details>`).join('\n')
  const sections = guide
    .map((row) => `<h3>${esc(row[`title_${l}`] || row.title_en)}</h3><p>${esc(row[`body_${l}`] || row.body_en)}</p>`)
    .join('\n')
  return `<!doctype html>
<html lang="${l}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ui.title)}</title>
<style>
  :root { --ink:#1f2430; --soft:#4b5468; --muted:#6b7386; --line:#e4e6ee; --accent:#791611; --bg:#ffffff; --panel:#f7f7fb; }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#e8eaf2; --soft:#b9c0d0; --muted:#8e97ab; --line:#2b3040; --accent:#f0a6a0; --bg:#14161d; --panel:#1b1e28; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font:16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Gujarati", "Noto Sans Devanagari", Helvetica, Arial, sans-serif; }
  .wrap { max-width:44rem; margin:0 auto; padding:2.2rem 1rem 4rem; }
  h1 { font-size:1.7rem; line-height:1.25; margin:.6rem 0 .4rem; }
  h2 { font-size:1.15rem; margin:2.2rem 0 .7rem; }
  h3 { font-size:1rem; margin:1.3rem 0 .3rem; }
  p { color:var(--soft); margin:.3rem 0; }
  a { color:var(--accent); }
  .langs { color:var(--muted); font-size:.95rem; }
  details { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:.75rem .95rem; margin:.55rem 0; }
  summary { cursor:pointer; font-weight:600; color:var(--ink); }
  details p { margin-top:.5rem; }
  footer { margin-top:2.5rem; padding-top:1rem; border-top:1px solid var(--line); color:var(--muted); font-size:.9rem; }
</style>
</head>
<body>
<div class="wrap">
  <div class="langs">${tabs}</div>
  <h1>${esc(ui.heading)}</h1>
  <p>${esc(ui.intro)} <a href="mailto:support@chaudharysamaj.com">support@chaudharysamaj.com</a>.</p>
  <h2>${esc(ui.faq)}</h2>
  ${faq}
  <h2>${esc(ui.guide)}</h2>
  ${sections}
  <footer>Chaudhary Samaj · <a href="/terms">Terms</a> · <a href="/privacy-policy">Privacy</a></footer>
</div>
</body>
</html>`
}
