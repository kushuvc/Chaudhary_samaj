/**
 * What the in-app guide says out of the box.
 *
 * These rows seed `app_guide_sections` once. After that the admin screen owns
 * them — editing a section, adding one for a new feature, or hiding one takes
 * effect on every installed app without a release, which is the point of
 * keeping the guide in the database rather than in the bundle.
 *
 * Re-running the migration never overwrites an edit (ON CONFLICT DO NOTHING),
 * so adding a section here ships it to databases that have not seen it while
 * leaving everything already tuned alone.
 *
 * Icons are Ionicons names, the set the app already draws from.
 */
export const GUIDE_DEFAULTS = [
  {
    key: 'profile',
    icon: 'person-circle-outline',
    sortOrder: 10,
    title: {
      en: 'Your profile',
      hi: 'आपकी प्रोफ़ाइल',
      gu: 'તમારી પ્રોફાઇલ',
    },
    body: {
      en: 'Fill in as much as you can — profiles with photos and complete details get far more responses. Open the Profile tab, tap Edit, change what you need and press Save. Your email and phone number are fixed; write to support if they need to change.',
      hi: 'जितना हो सके उतना भरें — फ़ोटो और पूरी जानकारी वाली प्रोफ़ाइल को कहीं ज़्यादा जवाब मिलते हैं। प्रोफ़ाइल टैब खोलें, एडिट दबाएँ, जो बदलना है बदलें और सेव दबाएँ। आपका ईमेल और फ़ोन नंबर यहाँ नहीं बदलते; बदलवाने के लिए सपोर्ट को लिखें।',
      gu: 'જેટલું બની શકે તેટલું ભરો — ફોટો અને પૂરી વિગતોવાળી પ્રોફાઇલને ઘણા વધારે જવાબ મળે છે. પ્રોફાઇલ ટૅબ ખોલો, એડિટ દબાવો, જે બદલવું હોય તે બદલો અને સેવ દબાવો. તમારો ઈમેલ અને ફોન નંબર અહીં બદલાતા નથી; બદલાવવા માટે સપોર્ટને લખો.',
    },
  },
  {
    key: 'matrimony',
    icon: 'heart-outline',
    sortOrder: 20,
    title: {
      en: 'Finding matches',
      hi: 'मेल ढूँढना',
      gu: 'મેળ શોધવો',
    },
    body: {
      en: 'The Matrimony tab shows members of the community. Use Filters for age and education, and Sort to arrange them by name or age. Tap any profile to read the full details, and use the heart to shortlist someone you want to come back to.',
      hi: 'वैवाहिक टैब समाज के सदस्य दिखाता है। उम्र और शिक्षा के लिए फ़िल्टर इस्तेमाल करें, और नाम या उम्र से क्रम लगाने के लिए सॉर्ट। पूरी जानकारी पढ़ने के लिए किसी भी प्रोफ़ाइल पर टैप करें, और जिसे बाद में देखना हो उसे दिल के निशान से शॉर्टलिस्ट करें।',
      gu: 'લગ્ન ટૅબ સમાજના સભ્યો બતાવે છે. ઉંમર અને શિક્ષણ માટે ફિલ્ટર વાપરો, અને નામ કે ઉંમર પ્રમાણે ગોઠવવા માટે સૉર્ટ. પૂરી વિગતો વાંચવા કોઈપણ પ્રોફાઇલ પર ટૅપ કરો, અને જેને પછી જોવા હોય તેને હૃદયના નિશાનથી શૉર્ટલિસ્ટ કરો.',
    },
  },
  {
    key: 'interests',
    icon: 'mail-outline',
    sortOrder: 30,
    title: {
      en: 'Sending an interest',
      hi: 'रुचि भेजना',
      gu: 'રુચિ મોકલવી',
    },
    body: {
      en: 'An interest tells someone you would like to take things further. They see it in their Interests tab and can accept or decline. When both of you have accepted, you become a match and can start talking.',
      hi: 'रुचि भेजने का मतलब है कि आप बात आगे बढ़ाना चाहते हैं। सामने वाले को यह उनके रुचियाँ टैब में दिखती है और वे स्वीकार या अस्वीकार कर सकते हैं। जब दोनों स्वीकार कर लेते हैं, तो आपका मेल बन जाता है और बातचीत शुरू हो सकती है।',
      gu: 'રુચિ મોકલવાનો અર્થ છે કે તમે વાત આગળ વધારવા માગો છો. સામેવાળાને તે તેમના રુચિ ટૅબમાં દેખાય છે અને તેઓ સ્વીકારી કે નકારી શકે છે. જ્યારે બંનેએ સ્વીકારી લીધું, ત્યારે તમારો મેળ બને છે અને વાતચીત શરૂ થઈ શકે છે.',
    },
  },
  {
    key: 'messages',
    icon: 'chatbubble-ellipses-outline',
    sortOrder: 40,
    title: {
      en: 'Messages',
      hi: 'संदेश',
      gu: 'સંદેશા',
    },
    body: {
      en: 'Once you are matched you can chat. Open the Messages tab, choose the person and write. The three dots at the top right let you report them or end the conversation, which removes the chat for both of you.',
      hi: 'मेल बन जाने के बाद आप बातचीत कर सकते हैं। संदेश टैब खोलें, व्यक्ति चुनें और लिखें। ऊपर दाईं ओर तीन बिंदुओं से आप उनकी शिकायत कर सकते हैं या बातचीत ख़त्म कर सकते हैं, जिससे चैट दोनों के लिए हट जाती है।',
      gu: 'મેળ બની ગયા પછી તમે વાતચીત કરી શકો છો. સંદેશા ટૅબ ખોલો, વ્યક્તિ પસંદ કરો અને લખો. ઉપર જમણી બાજુ ત્રણ ટપકાંથી તમે તેમની ફરિયાદ કરી શકો છો કે વાતચીત પૂરી કરી શકો છો, જેનાથી ચેટ બંને માટે હટી જાય છે.',
    },
  },
  {
    key: 'plans',
    icon: 'card-outline',
    sortOrder: 50,
    title: {
      en: 'Membership',
      hi: 'सदस्यता',
      gu: 'સભ્યપદ',
    },
    body: {
      en: 'Free members can see a couple of profiles. A plan opens the whole community. Open the Plans tab to see what each one costs — the help card there explains paying through Google Play, renewal, and how to cancel.',
      hi: 'निःशुल्क सदस्य कुछ ही प्रोफ़ाइल देख सकते हैं। कोई भी योजना पूरे समाज को खोल देती है। कीमतें देखने के लिए योजनाएँ टैब खोलें — वहाँ का मदद कार्ड बताता है कि Google Play से भुगतान कैसे करें, यह कैसे नवीनीकृत होती है, और रद्द कैसे करें।',
      gu: 'મફત સભ્યો થોડી જ પ્રોફાઇલ જોઈ શકે છે. કોઈપણ યોજના આખો સમાજ ખોલી દે છે. કિંમતો જોવા યોજનાઓ ટૅબ ખોલો — ત્યાંનું મદદ કાર્ડ સમજાવે છે કે Google Play થી ચુકવણી કેવી રીતે કરવી, તે કેવી રીતે રિન્યૂ થાય છે, અને રદ કેવી રીતે કરવું.',
    },
  },
  {
    key: 'safety',
    icon: 'shield-checkmark-outline',
    sortOrder: 60,
    title: {
      en: 'Safety and privacy',
      hi: 'सुरक्षा और निजता',
      gu: 'સલામતી અને ગોપનીયતા',
    },
    body: {
      en: 'A phone number is shared only after you and the other person have both accepted each other’s interest — a plan alone never reveals it. If anyone behaves badly, report them: they are hidden from you straight away and our team reviews it.',
      hi: 'फ़ोन नंबर तभी मिलता है जब आप और सामने वाले, दोनों ने एक-दूसरे की रुचि स्वीकार कर ली हो — अकेली योजना से नंबर कभी नहीं दिखता। कोई ग़लत व्यवहार करे तो उसकी शिकायत करें: वह तुरंत आपसे छिप जाता है और हमारी टीम जाँच करती है।',
      gu: 'ફોન નંબર ત્યારે જ મળે છે જ્યારે તમે અને સામેવાળા, બંનેએ એકબીજાની રુચિ સ્વીકારી લીધી હોય — એકલી યોજનાથી નંબર કદી દેખાતો નથી. કોઈ ખોટું વર્તન કરે તો તેની ફરિયાદ કરો: તે તરત જ તમારાથી છુપાઈ જાય છે અને અમારી ટીમ તપાસ કરે છે.',
    },
  },
  {
    key: 'support',
    icon: 'help-buoy-outline',
    sortOrder: 70,
    title: {
      en: 'Need help?',
      hi: 'मदद चाहिए?',
      gu: 'મદદ જોઈએ છે?',
    },
    body: {
      en: 'Something not working, or a question about your account? The Settings tab has an Email support button. Tell us what happened and we usually reply within a day.',
      hi: 'कुछ काम नहीं कर रहा, या अपने खाते के बारे में कोई सवाल है? सेटिंग्स टैब में ईमेल सपोर्ट का बटन है। हमें बताएँ कि क्या हुआ, हम आमतौर पर एक दिन के भीतर जवाब देते हैं।',
      gu: 'કંઈક કામ નથી કરતું, કે તમારા ખાતા વિશે કોઈ સવાલ છે? સેટિંગ્સ ટૅબમાં ઈમેલ સપોર્ટનું બટન છે. અમને જણાવો શું થયું, અમે સામાન્ય રીતે એક દિવસમાં જવાબ આપીએ છીએ.',
    },
  },
]
