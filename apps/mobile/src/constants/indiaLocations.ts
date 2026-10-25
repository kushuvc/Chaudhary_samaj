/*
 * Every Indian state and union territory with its district headquarters and
 * larger towns, for the location dropdowns at signup and on the Profile tab.
 * The old list had ten states and cities for six of them, so anyone elsewhere
 * could only pick "Other". Gujarat and Rajasthan, where most members live,
 * list every district plus the bigger talukas. A town that is still missing
 * can be typed in after choosing "Other".
 */
export const INDIA_CITIES: Record<string, string[]> = {
  Gujarat: [
    'Ahmedabad', 'Amreli', 'Anand', 'Ankleshwar', 'Banaskantha (Palanpur)', 'Bardoli', 'Bharuch', 'Bhavnagar', 'Bhuj',
    'Botad', 'Chhota Udaipur', 'Dahod', 'Deesa', 'Dhanera', 'Dholka', 'Dwarka', 'Gandhidham', 'Gandhinagar',
    'Godhra', 'Gondal', 'Himmatnagar', 'Jamnagar', 'Jetpur', 'Junagadh', 'Kadi', 'Kalol', 'Kheda', 'Kheralu',
    'Lunawada', 'Mahesana', 'Mahuva', 'Modasa', 'Morbi', 'Nadiad', 'Navsari', 'Palanpur', 'Patan', 'Porbandar',
    'Radhanpur', 'Rajkot', 'Rajpipla', 'Sanand', 'Siddhpur', 'Surat', 'Surendranagar', 'Tharad', 'Unjha', 'Vadnagar',
    'Vadodara', 'Valsad', 'Vapi', 'Veraval', 'Vijapur', 'Visnagar', 'Vyara',
  ],
  Rajasthan: [
    'Ajmer', 'Alwar', 'Balotra', 'Banswara', 'Baran', 'Barmer', 'Beawar', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Bundi',
    'Chittorgarh', 'Churu', 'Dausa', 'Dholpur', 'Dungarpur', 'Hanumangarh', 'Jaipur', 'Jaisalmer', 'Jalore',
    'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Karauli', 'Kishangarh', 'Kota', 'Nagaur', 'Pali', 'Pratapgarh', 'Rajsamand',
    'Sanchore', 'Sawai Madhopur', 'Sikar', 'Sirohi', 'Sri Ganganagar', 'Tonk', 'Udaipur',
  ],
  Maharashtra: [
    'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad (Chhatrapati Sambhajinagar)', 'Beed', 'Bhiwandi', 'Chandrapur',
    'Dhule', 'Jalgaon', 'Kalyan', 'Kolhapur', 'Latur', 'Mumbai', 'Nagpur', 'Nanded', 'Nashik', 'Navi Mumbai',
    'Palghar', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Solapur', 'Thane', 'Vasai-Virar', 'Wardha', 'Yavatmal',
  ],
  'Madhya Pradesh': [
    'Bhopal', 'Chhindwara', 'Dewas', 'Gwalior', 'Indore', 'Jabalpur', 'Katni', 'Khandwa', 'Khargone', 'Mandsaur',
    'Morena', 'Neemuch', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Shivpuri', 'Ujjain', 'Vidisha',
  ],
  'Uttar Pradesh': [
    'Agra', 'Aligarh', 'Ayodhya', 'Bareilly', 'Ghaziabad', 'Gorakhpur', 'Jhansi', 'Kanpur', 'Lucknow', 'Mathura',
    'Meerut', 'Moradabad', 'Muzaffarnagar', 'Noida', 'Prayagraj', 'Saharanpur', 'Varanasi',
  ],
  Delhi: ['Central Delhi', 'Dwarka', 'East Delhi', 'New Delhi', 'North Delhi', 'Rohini', 'South Delhi', 'West Delhi'],
  Haryana: [
    'Ambala', 'Bhiwani', 'Faridabad', 'Fatehabad', 'Gurugram', 'Hisar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra',
    'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar',
  ],
  Punjab: [
    'Amritsar', 'Bathinda', 'Firozpur', 'Hoshiarpur', 'Jalandhar', 'Ludhiana', 'Mohali', 'Moga', 'Pathankot', 'Patiala',
    'Sangrur',
  ],
  Karnataka: [
    'Belagavi', 'Bengaluru', 'Davanagere', 'Hubballi-Dharwad', 'Kalaburagi', 'Mangaluru', 'Mysuru', 'Shivamogga',
    'Tumakuru', 'Udupi', 'Vijayapura',
  ],
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Erode', 'Madurai', 'Salem', 'Thanjavur', 'Tiruchirappalli', 'Tirunelveli', 'Tiruppur',
    'Vellore',
  ],
  Telangana: ['Hyderabad', 'Karimnagar', 'Khammam', 'Nizamabad', 'Secunderabad', 'Warangal'],
  'Andhra Pradesh': ['Guntur', 'Kakinada', 'Kurnool', 'Nellore', 'Rajahmundry', 'Tirupati', 'Vijayawada', 'Visakhapatnam'],
  Kerala: ['Kannur', 'Kochi', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Thiruvananthapuram', 'Thrissur'],
  'West Bengal': ['Asansol', 'Durgapur', 'Howrah', 'Kolkata', 'Siliguri'],
  Bihar: ['Bhagalpur', 'Darbhanga', 'Gaya', 'Muzaffarpur', 'Patna', 'Purnia'],
  Jharkhand: ['Bokaro', 'Dhanbad', 'Hazaribagh', 'Jamshedpur', 'Ranchi'],
  Odisha: ['Balasore', 'Berhampur', 'Bhubaneswar', 'Cuttack', 'Rourkela', 'Sambalpur'],
  Chhattisgarh: ['Bhilai', 'Bilaspur', 'Durg', 'Korba', 'Raipur', 'Rajnandgaon'],
  Assam: ['Dibrugarh', 'Guwahati', 'Jorhat', 'Nagaon', 'Silchar', 'Tezpur'],
  Uttarakhand: ['Dehradun', 'Haldwani', 'Haridwar', 'Nainital', 'Rishikesh', 'Roorkee', 'Rudrapur'],
  'Himachal Pradesh': ['Baddi', 'Dharamshala', 'Kullu', 'Mandi', 'Shimla', 'Solan'],
  'Jammu and Kashmir': ['Anantnag', 'Baramulla', 'Jammu', 'Kathua', 'Srinagar', 'Udhampur'],
  Goa: ['Mapusa', 'Margao', 'Panaji', 'Ponda', 'Vasco da Gama'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat'],
  Manipur: ['Imphal', 'Thoubal'],
  Meghalaya: ['Shillong', 'Tura'],
  Mizoram: ['Aizawl', 'Lunglei'],
  Nagaland: ['Dimapur', 'Kohima'],
  Sikkim: ['Gangtok', 'Namchi'],
  Tripura: ['Agartala', 'Udaipur (Tripura)'],
  Chandigarh: ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Diu', 'Silvassa'],
  Ladakh: ['Kargil', 'Leh'],
  Lakshadweep: ['Kavaratti'],
  Puducherry: ['Karaikal', 'Puducherry'],
  'Andaman and Nicobar Islands': ['Port Blair'],
};

/** Members' home states first, the rest alphabetically. */
const FIRST = ['Gujarat', 'Rajasthan', 'Maharashtra', 'Madhya Pradesh', 'Delhi', 'Haryana', 'Uttar Pradesh', 'Punjab'];
export const INDIA_STATES = [
  ...FIRST,
  ...Object.keys(INDIA_CITIES).filter((s) => !FIRST.includes(s)).sort(),
];
