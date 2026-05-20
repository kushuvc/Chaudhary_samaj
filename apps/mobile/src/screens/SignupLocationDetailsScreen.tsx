import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export interface LocationDetailsData {
  country: string;
  state: string;
  city: string;
  village: string;
  nativeCity: string;
  nativeVillage: string;
}

interface SignupLocationDetailsScreenProps {
  onBack: () => void;
  onNext: (data: LocationDetailsData) => void;
}

const countries = ['India', 'USA', 'UK', 'Canada', 'Australia', 'UAE', 'Other'];
const states: Record<string, string[]> = {
  'India': ['Gujarat', 'Maharashtra', 'Rajasthan', 'Punjab', 'Haryana', 'Delhi', 'Uttar Pradesh', 'Madhya Pradesh', 'Karnataka', 'Tamil Nadu', 'Kerala', 'Goa', 'Other'],
  'USA': ['California', 'Texas', 'New York', 'New Jersey', 'Illinois', 'Florida', 'Other'],
  'UK': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  'Canada': ['Ontario', 'British Columbia', 'Alberta', 'Quebec', 'Other'],
  'Australia': ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'Other'],
  'UAE': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Other'],
  'Other': ['Other'],
};

const cities: Record<string, string[]> = {
  // India
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Anand', 'Nadiad', 'Bharuch', 'Navsari', 'Mehsana', 'Patan', 'Junagadh', 'Porbandar', 'Morbi', 'Surendranagar', 'Amreli', 'Bhuj', 'Gandhidham', 'Other'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Kalyan', 'Vasai-Virar', 'Aurangabad', 'Navi Mumbai', 'Solapur', 'Mira-Bhayandar', 'Bhiwandi', 'Amravati', 'Nanded', 'Kolhapur', 'Akola', 'Ulhasnagar', 'Sangli', 'Malegaon', 'Jalgaon', 'Latur', 'Dhule', 'Ahmednagar', 'Chandrapur', 'Parbhani', 'Ichalkaranji', 'Jalna', 'Ambarnath', 'Bhusawal', 'Badlapur', 'Other'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Bhilwara', 'Alwar', 'Bharatpur', 'Sikar', 'Pali', 'Sri Ganganagar', 'Tonk', 'Kishangarh', 'Beawar', 'Hanumangarh', 'Dausa', 'Churu', 'Pratapgarh', 'Other'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Pathankot', 'Hoshiarpur', 'Moga', 'Firozpur', 'Kapurthala', 'Sangrur', 'Barnala', 'Malerkotla', 'Anandpur Sahib', 'Other'],
  'Haryana': ['Gurgaon', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula', 'Bhiwani', 'Sirsa', 'Bahadurgarh', 'Jind', 'Thanesar', 'Kaithal', 'Rewari', 'Palwal', 'Other'],
  'Delhi': ['New Delhi', 'Delhi NCR', 'Dwarka', 'Rohini', 'Karol Bagh', 'Saket', 'Vasant Kunj', 'Lajpat Nagar', 'Connaught Place', 'Chandni Chowk', 'Other'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Prayagraj', 'Meerut', 'Bareilly', 'Aligarh', 'Gorakhpur', 'Noida', 'Greater Noida', 'Muzaffarnagar', 'Saharanpur', 'Jhansi', 'Mathura', 'Firozabad', 'Ayodhya', 'Faizabad', 'Shahjahanpur', 'Other'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa', 'Murwara', 'Singrauli', 'Burhanpur', 'Khandwa', 'Bhind', 'Chhindwara', 'Guna', 'Shivpuri', 'Vidisha', 'Other'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Hubli-Dharwad', 'Mangaluru', 'Belagavi', 'Kalaburagi', 'Davanagere', 'Ballari', 'Vijayapura', 'Shivamogga', 'Tumakuru', 'Raichur', 'Bidar', 'Hassan', 'Udupi', 'Chikmagalur', 'Other'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tiruppur', 'Erode', 'Tirunelveli', 'Vellore', 'Thoothukudi', 'Dindigul', 'Thanjavur', 'Ranipet', 'Sivakasi', 'Karur', 'Other'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Kollam', 'Thrissur', 'Alappuzha', 'Palakkad', 'Malappuram', 'Kannur', 'Kasaragod', 'Pathanamthitta', 'Idukki', 'Wayanad', 'Other'],
  'Goa': ['Panaji', 'Vasco da Gama', 'Margao', 'Calangute', 'Mapusa', 'Ponda', 'Bicholim', 'Curchorem', 'Sanquelim', 'Cuncolim', 'Other'],
  // USA
  'California': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Fresno', 'Sacramento', 'Long Beach', 'Oakland', 'Bakersfield', 'Anaheim', 'Santa Ana', 'Riverside', 'Stockton', 'Chula Vista', 'Irvine', 'Fremont', 'San Bernardino', 'Modesto', 'Oxnard', 'Other'],
  'Texas': ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Laredo', 'Lubbock', 'Garland', 'Irving', 'Amarillo', 'Grand Prairie', 'McKinney', 'Frisco', 'Brownsville', 'Pasadena', 'Other'],
  'New York': ['New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany', 'New Rochelle', 'Mount Vernon', 'Schenectady', 'Utica', 'White Plains', 'Hempstead', 'Troy', 'Niagara Falls', 'Binghamton', 'Other'],
  'New Jersey': ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison', 'Woodbridge', 'Lakewood', 'Toms River', 'Hamilton', 'Trenton', 'Clifton', 'Camden', 'Brick', 'Cherry Hill', 'Passaic', 'Union City', 'Old Bridge', 'Bayonne', 'Vineland', 'Other'],
  'Illinois': ['Chicago', 'Aurora', 'Rockford', 'Joliet', 'Naperville', 'Springfield', 'Peoria', 'Elgin', 'Waukegan', 'Cicero', 'Champaign', 'Bloomington', 'Decatur', 'Evanston', 'Des Plaines', 'Other'],
  'Florida': ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg', 'Hialeah', 'Port St. Lucie', 'Cape Coral', 'Tallahassee', 'Fort Lauderdale', 'Pembroke Pines', 'Hollywood', 'Gainesville', 'Miramar', 'Coral Springs', 'Other'],
  // UK
  'England': ['London', 'Manchester', 'Birmingham', 'Liverpool', 'Leeds', 'Sheffield', 'Bristol', 'Leicester', 'Coventry', 'Bradford', 'Nottingham', 'Southampton', 'Portsmouth', 'Newcastle', 'York', 'Oxford', 'Cambridge', 'Other'],
  'Scotland': ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness', 'Stirling', 'Perth', 'Paisley', 'Livingston', 'Dumfries', 'Kilmarnock', 'Other'],
  'Wales': ['Cardiff', 'Swansea', 'Newport', 'Wrexham', 'Barry', 'Neath', 'Cwmbran', 'Bridgend', 'Llanelli', 'Merthyr Tydfil', 'Other'],
  'Northern Ireland': ['Belfast', 'Derry', 'Lisburn', 'Newtownabbey', 'Bangor', 'Craigavon', 'Castlereagh', 'Ballymena', 'Newtownards', 'Carrickfergus', 'Other'],
  // Canada
  'Ontario': ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor', 'Richmond Hill', 'Burlington', 'Oakville', 'Barrie', 'Sudbury', 'Other'],
  'British Columbia': ['Vancouver', 'Surrey', 'Burnaby', 'Richmond', 'Abbotsford', 'Coquitlam', 'Kelowna', 'Langley', 'Saanich', 'Delta', 'Victoria', 'Nanaimo', 'Kamloops', 'Other'],
  'Alberta': ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert', 'Medicine Hat', 'Grande Prairie', 'Airdrie', 'Spruce Grove', 'Leduc', 'Other'],
  'Quebec': ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil', 'Saguenay', 'Levis', 'Sherbrooke', 'Trois-Rivieres', 'Terrebonne', 'Other'],
  // Australia
  'New South Wales': ['Sydney', 'Newcastle', 'Wollongong', 'Maitland', 'Tweed Heads', 'Coffs Harbour', 'Tamworth', 'Albury', 'Port Macquarie', 'Orange', 'Dubbo', 'Other'],
  'Victoria': ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo', 'Shepparton', 'Mildura', 'Warrnambool', 'Traralgon', 'Wodonga', 'Sunbury', 'Other'],
  'Queensland': ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Townsville', 'Cairns', 'Toowoomba', 'Mackay', 'Rockhampton', 'Bundaberg', 'Hervey Bay', 'Other'],
  'Western Australia': ['Perth', 'Bunbury', 'Geraldton', 'Kalgoorlie', 'Albany', 'Karratha', 'Port Hedland', 'Broome', 'Other'],
  // UAE
  'Dubai': ['Dubai Marina', 'Downtown Dubai', 'Jumeirah', 'Deira', 'Bur Dubai', 'Al Barsha', 'Business Bay', 'Palm Jumeirah', 'International City', 'Other'],
  'Abu Dhabi': ['Al Maryah Island', 'Corniche', 'Al Reem Island', 'Yas Island', 'Khalifa City', 'Mohammed Bin Zayed City', 'Al Ain', 'Other'],
  'Sharjah': ['Al Majaz', 'Al Qasimia', 'Al Nahda', 'Al Taawun', 'Al Khan', 'Muwaileh', 'Al Saja', 'Other'],
  // Fallback
  'Other': ['Other'],
};

export function SignupLocationDetailsScreen({ onBack, onNext }: SignupLocationDetailsScreenProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  
  const [data, setData] = useState<LocationDetailsData>({
    country: 'India',
    state: '',
    city: '',
    village: '',
    nativeCity: '',
    nativeVillage: '',
  });
  const [activePicker, setActivePicker] = useState<'country' | 'state' | 'city' | null>(null);

  const isValid =
    data.country &&
    data.state &&
    data.city &&
    data.village.trim() &&
    data.nativeCity.trim() &&
    data.nativeVillage.trim();

  const availableStates = states[data.country] || ['Other'];
  const availableCities = cities[data.state] || ['Other'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Location Details (3/5)</Text>
        <View style={styles.backButton} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '60%' }]} />
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Country */}
        <View style={styles.section}>
          <Pressable 
            style={styles.selector}
            onPress={() => setActivePicker('country')}
          >
            <Text style={styles.floatingLabel}>Your residing country</Text>
            <Text style={styles.selectorText}>{data.country}</Text>
            <Ionicons name="chevron-down" size={20} color={palette.muted} />
          </Pressable>
        </View>

        {/* State */}
        <View style={styles.section}>
          <Pressable 
            style={styles.selector}
            onPress={() => setActivePicker('state')}
          >
            <Text style={styles.floatingLabel}>Your residing state</Text>
            <Text style={styles.selectorText}>{data.state || 'Select state'}</Text>
            <Ionicons name="chevron-down" size={20} color={palette.muted} />
          </Pressable>
        </View>

        {/* City */}
        <View style={styles.section}>
          <Pressable 
            style={styles.selector}
            onPress={() => setActivePicker('city')}
          >
            <Text style={styles.floatingLabel}>Your residing city</Text>
            <Text style={styles.selectorText}>{data.city || 'Select city'}</Text>
            <Ionicons name="chevron-down" size={20} color={palette.muted} />
          </Pressable>
        </View>

        {/* Village */}
        <View style={styles.section}>
          <Text style={styles.label}>Village <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter your village name"
            placeholderTextColor={palette.muted}
            value={data.village}
            onChangeText={(text) => setData({ ...data, village: text })}
          />
        </View>

        {/* Native City */}
        <View style={styles.section}>
          <Text style={styles.label}>Native City <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter your native city"
            placeholderTextColor={palette.muted}
            value={data.nativeCity}
            onChangeText={(text) => setData({ ...data, nativeCity: text })}
          />
        </View>

        {/* Native Village */}
        <View style={styles.section}>
          <Text style={styles.label}>Native Village <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter your native village"
            placeholderTextColor={palette.muted}
            value={data.nativeVillage}
            onChangeText={(text) => setData({ ...data, nativeVillage: text })}
          />
        </View>
      </ScrollView>

      {/* Modal Picker Overlay */}
      {activePicker && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setActivePicker(null)} />
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {activePicker === 'country' && 'Select Country'}
                {activePicker === 'state' && 'Select State'}
                {activePicker === 'city' && 'Select City'}
              </Text>
              <Pressable onPress={() => setActivePicker(null)}>
                <Ionicons name="close" size={24} color={palette.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={true}>
              {activePicker === 'country' && countries.map((item) => (
                <Pressable
                  key={item}
                  style={[styles.pickerItem, data.country === item && styles.pickerItemActive]}
                  onPress={() => {
                    setData({ ...data, country: item, state: '', city: '' });
                    setActivePicker(null);
                  }}
                >
                  <Text style={[styles.pickerItemText, data.country === item && styles.pickerItemTextActive]}>
                    {item}
                  </Text>
                  {data.country === item && <Ionicons name="checkmark" size={20} color="#E53935" />}
                </Pressable>
              ))}
              {activePicker === 'state' && availableStates.map((item) => (
                <Pressable
                  key={item}
                  style={[styles.pickerItem, data.state === item && styles.pickerItemActive]}
                  onPress={() => {
                    setData({ ...data, state: item, city: '' });
                    setActivePicker(null);
                  }}
                >
                  <Text style={[styles.pickerItemText, data.state === item && styles.pickerItemTextActive]}>
                    {item}
                  </Text>
                  {data.state === item && <Ionicons name="checkmark" size={20} color="#E53935" />}
                </Pressable>
              ))}
              {activePicker === 'city' && availableCities.map((item) => (
                <Pressable
                  key={item}
                  style={[styles.pickerItem, data.city === item && styles.pickerItemActive]}
                  onPress={() => {
                    setData({ ...data, city: item });
                    setActivePicker(null);
                  }}
                >
                  <Text style={[styles.pickerItemText, data.city === item && styles.pickerItemTextActive]}>
                    {item}
                  </Text>
                  {data.city === item && <Ionicons name="checkmark" size={20} color="#E53935" />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.nextButton, !isValid && styles.nextButtonDisabled]}
          onPress={() => isValid && onNext(data)}
          disabled={!isValid}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </Pressable>
        
      </View>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: palette.text,
    },
    progressContainer: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: palette.bg,
    },
    progressBar: {
      height: 4,
      backgroundColor: palette.border,
      borderRadius: 2,
    },
    progressFill: {
      height: 4,
      backgroundColor: '#E53935',
      borderRadius: 2,
    },
    content: {
      flex: 1,
    },
    contentInner: {
      padding: 24,
    },
    section: {
      marginBottom: 20,
    },
    selector: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: palette.cardBg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    floatingLabel: {
      position: 'absolute',
      left: 12,
      top: -10,
      backgroundColor: palette.bg,
      paddingHorizontal: 4,
      fontSize: 12,
      color: palette.muted,
    },
    selectorText: {
      fontSize: 16,
      color: palette.text,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
      marginBottom: 8,
    },
    required: {
      fontSize: 14,
      color: '#E53935',
      fontWeight: '700' as const,
    },
    optional: {
      fontSize: 14,
      color: palette.muted,
      fontWeight: '400',
    },
    textInput: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 16,
      color: palette.text,
      backgroundColor: palette.cardBg,
    },
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    pickerContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: palette.cardBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
    },
    pickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    pickerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: palette.text,
    },
    pickerList: {
      maxHeight: 400,
    },
    pickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    pickerItemActive: {
      backgroundColor: '#FFEBEE',
    },
    pickerItemText: {
      fontSize: 16,
      color: palette.text,
    },
    pickerItemTextActive: {
      color: '#E53935',
      fontWeight: '600',
    },
    footer: {
      padding: 24,
      paddingBottom: 40,
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    nextButton: {
      backgroundColor: '#E53935',
      borderRadius: 28,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 16,
    },
    nextButtonDisabled: {
      backgroundColor: '#F5F5F5',
    },
    nextButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
