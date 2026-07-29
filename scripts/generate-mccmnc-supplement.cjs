#!/usr/bin/env node
// Supplementary MCCMNC entries - adds countries not in the main script
// to reach ~2700 total entries

const countries = [
  // ── Eastern Europe ─────────────────────────────────────
  { country: 'Lithuania', code: 'LT', mcc: '246', mncs: [
    {mnc:'01',op:'Telia LT',tech:'GSM'},{mnc:'02',op:'Bite LT',tech:'GSM'},{mnc:'03',op:'Tele2 LT',tech:'GSM'},
    {mnc:'05',op:'LitRail',tech:'GSM'},{mnc:'06',op:'Mediafon',tech:'GSM'}
  ]},
  { country: 'Latvia', code: 'LV', mcc: '247', mncs: [
    {mnc:'01',op:'LMT',tech:'GSM'},{mnc:'02',op:'Tele2 LV',tech:'GSM'},{mnc:'03',op:'Telekom Baltija',tech:'CDMA'},
    {mnc:'05',op:'Bite LV',tech:'GSM'},{mnc:'06',op:'Rigatta',tech:'GSM'},{mnc:'07',op:'MTS LV',tech:'GSM'},
    {mnc:'08',op:'IZZI',tech:'GSM'},{mnc:'09',op:'Camel Mobile',tech:'GSM'}
  ]},
  { country: 'Estonia', code: 'EE', mcc: '248', mncs: [
    {mnc:'01',op:'Telia EE',tech:'GSM'},{mnc:'02',op:'Elisa EE',tech:'GSM'},{mnc:'03',op:'Tele2 EE',tech:'GSM'},
    {mnc:'04',op:'OY Top Connect',tech:'GSM'},{mnc:'05',op:'AS Dagö',tech:'GSM'},{mnc:'06',op:'Progroup',tech:'GSM'},
    {mnc:'07',op:'Kou',tech:'GSM'},{mnc:'08',op:'VIVEX',tech:'GSM'},{mnc:'09',op:'Bravo Telecom',tech:'GSM'}
  ]},
  { country: 'Moldova', code: 'MD', mcc: '259', mncs: [
    {mnc:'01',op:'Orange MD',tech:'GSM'},{mnc:'02',op:'Moldcell',tech:'GSM'},{mnc:'03',op:'IDC',tech:'CDMA'},
    {mnc:'04',op:'Eventis',tech:'GSM'},{mnc:'05',op:'Unite',tech:'GSM'}
  ]},
  { country: 'Belarus', code: 'BY', mcc: '257', mncs: [
    {mnc:'01',op:'A1 BY',tech:'GSM'},{mnc:'02',op:'MTS BY',tech:'GSM'},{mnc:'03',op:'life:)',tech:'GSM'},
    {mnc:'04',op:'Beltelecom',tech:'GSM'}
  ]},
  { country: 'Slovenia', code: 'SI', mcc: '293', mncs: [
    {mnc:'10',op:'A1 SI',tech:'GSM'},{mnc:'20',op:'Telemach',tech:'GSM'},{mnc:'40',op:'Telekom SI',tech:'GSM'},
    {mnc:'41',op:'Mobitel',tech:'GSM'},{mnc:'64',op:'T-2',tech:'GSM'},{mnc:'70',op:'Telemach',tech:'GSM'}
  ]},
  { country: 'Bosnia and Herzegovina', code: 'BA', mcc: '218', mncs: [
    {mnc:'03',op:'BH Telecom',tech:'GSM'},{mnc:'05',op:'m:tel',tech:'GSM'},{mnc:'90',op:'HT Eronet',tech:'GSM'}
  ]},
  { country: 'North Macedonia', code: 'MK', mcc: '294', mncs: [
    {mnc:'01',op:'A1 MK',tech:'GSM'},{mnc:'02',op:'ONE MK',tech:'GSM'},{mnc:'03',op:'Makedonski Telekom',tech:'GSM'},
    {mnc:'10',op:'WTI',tech:'GSM'}
  ]},
  { country: 'Albania', code: 'AL', mcc: '276', mncs: [
    {mnc:'01',op:'Vodafone AL',tech:'GSM'},{mnc:'02',op:'One AL',tech:'GSM'},{mnc:'03',op:'ALBtelecom',tech:'GSM'},
    {mnc:'04',op:'Plus Communication',tech:'GSM'}
  ]},
  { country: 'Montenegro', code: 'ME', mcc: '297', mncs: [
    {mnc:'01',op:'Telenor ME',tech:'GSM'},{mnc:'02',op:'M:tel CG',tech:'GSM'},{mnc:'03',op:'One CG',tech:'GSM'}
  ]},
  { country: 'Kosovo', code: 'XK', mcc: '221', mncs: [
    {mnc:'01',op:'Vala',tech:'GSM'},{mnc:'02',op:'IPKO',tech:'GSM'}
  ]},
  { country: 'Luxembourg', code: 'LU', mcc: '270', mncs: [
    {mnc:'01',op:'POST',tech:'GSM'},{mnc:'02',op:'MTX Connect',tech:'GSM'},{mnc:'10',op:'BLUE',tech:'GSM'},
    {mnc:'77',op:'Tango',tech:'GSM'},{mnc:'99',op:'Orange LU',tech:'GSM'}
  ]},
  { country: 'Malta', code: 'MT', mcc: '278', mncs: [
    {mnc:'01',op:'GO Mobile',tech:'GSM'},{mnc:'11',op:'YOM',tech:'GSM'},{mnc:'21',op:'Melita',tech:'GSM'},
    {mnc:'77',op:'epic',tech:'GSM'}
  ]},
  { country: 'Cyprus', code: 'CY', mcc: '280', mncs: [
    {mnc:'01',op:'Cytamobile',tech:'GSM'},{mnc:'02',op:'epic',tech:'GSM'},{mnc:'10',op:'PrimeTel',tech:'GSM'},
    {mnc:'20',op:'Cablenet',tech:'GSM'}
  ]},
  { country: 'Iceland', code: 'IS', mcc: '274', mncs: [
    {mnc:'01',op:'Siminn',tech:'GSM'},{mnc:'02',op:'Vodafone IS',tech:'GSM'},{mnc:'03',op:'Nova',tech:'GSM'},
    {mnc:'04',op:'Viking',tech:'GSM'},{mnc:'05',op:'Vodafone IS',tech:'GSM'},{mnc:'08',op:'Siminn',tech:'GSM'}
  ]},
  { country: 'Armenia', code: 'AM', mcc: '283', mncs: [
    {mnc:'01',op:'Beeline AM',tech:'GSM'},{mnc:'05',op:'Ucom',tech:'GSM'},{mnc:'10',op:'MTS AM',tech:'GSM'}
  ]},
  { country: 'Georgia', code: 'GE', mcc: '282', mncs: [
    {mnc:'01',op:'MagtiCom',tech:'GSM'},{mnc:'02',op:'MagtiCom',tech:'GSM'},{mnc:'03',op:'MagtiCom',tech:'CDMA'},
    {mnc:'04',op:'Beeline GE',tech:'GSM'},{mnc:'05',op:'Silknet',tech:'CDMA'},{mnc:'06',op:'Geocell',tech:'GSM'}
  ]},
  { country: 'Azerbaijan', code: 'AZ', mcc: '400', mncs: [
    {mnc:'01',op:'Azercell',tech:'GSM'},{mnc:'02',op:'Bakcell',tech:'GSM'},{mnc:'03',op:'Catel',tech:'CDMA'},
    {mnc:'04',op:'Nar Mobile',tech:'GSM'},{mnc:'05',op:'Aztrank',tech:'GSM'},{mnc:'06',op:'Naxtel',tech:'CDMA'}
  ]},
  { country: 'Kazakhstan', code: 'KZ', mcc: '401', mncs: [
    {mnc:'01',op:'Beeline KZ',tech:'GSM'},{mnc:'02',op:'Kcell',tech:'GSM'},{mnc:'07',op:'Altel',tech:'GSM'},
    {mnc:'08',op:'Kazakhtelecom',tech:'CDMA'},{mnc:'77',op:'Tele2 KZ',tech:'GSM'}
  ]},
  { country: 'Uzbekistan', code: 'UZ', mcc: '434', mncs: [
    {mnc:'01',op:'Buzton',tech:'GSM'},{mnc:'02',op:'Uzmacom',tech:'GSM'},{mnc:'03',op:'UMS',tech:'GSM'},
    {mnc:'04',op:'Ucell',tech:'GSM'},{mnc:'05',op:'Beeline UZ',tech:'GSM'},{mnc:'06',op:'Perfectum',tech:'CDMA'},
    {mnc:'07',op:'Mobi.UZ',tech:'GSM'}
  ]},
  // ── Middle East (continued) ──────────────────────────
  { country: 'Bahrain', code: 'BH', mcc: '426', mncs: [
    {mnc:'01',op:'Batelco',tech:'GSM'},{mnc:'02',op:'Zain BH',tech:'GSM'},{mnc:'03',op:'STC BH',tech:'GSM'},
    {mnc:'04',op:'Batelco',tech:'GSM'}
  ]},
  { country: 'Oman', code: 'OM', mcc: '422', mncs: [
    {mnc:'02',op:'Omantel',tech:'GSM'},{mnc:'03',op:'Ooredoo OM',tech:'GSM'},{mnc:'04',op:'Omantel',tech:'GSM'}
  ]},
  { country: 'Lebanon', code: 'LB', mcc: '415', mncs: [
    {mnc:'01',op:'Alfa',tech:'GSM'},{mnc:'03',op:'touch',tech:'GSM'},{mnc:'05',op:'Ogero',tech:'GSM'}
  ]},
  { country: 'Iraq', code: 'IQ', mcc: '418', mncs: [
    {mnc:'05',op:'Asiacell',tech:'GSM'},{mnc:'08',op:'SanaTel',tech:'GSM'},{mnc:'20',op:'Zain IQ',tech:'GSM'},
    {mnc:'30',op:'Zain IQ',tech:'GSM'},{mnc:'40',op:'Korek',tech:'GSM'},{mnc:'45',op:'Mobitel',tech:'GSM'},
    {mnc:'62',op:'Itisaluna',tech:'CDMA'},{mnc:'70',op:'Kalimat',tech:'GSM'},{mnc:'80',op:'ITC',tech:'GSM'}
  ]},
  { country: 'Yemen', code: 'YE', mcc: '421', mncs: [
    {mnc:'01',op:'Sabafon',tech:'GSM'},{mnc:'02',op:'MTN YE',tech:'GSM'},{mnc:'03',op:'Yemen Mobile',tech:'CDMA'},
    {mnc:'04',op:'Y',tech:'GSM'}
  ]},
  { country: 'Syria', code: 'SY', mcc: '417', mncs: [
    {mnc:'01',op:'Syriatel',tech:'GSM'},{mnc:'02',op:'MTN SY',tech:'GSM'}
  ]},
  { country: 'Palestine', code: 'PS', mcc: '425', mncs: [
    {mnc:'01',op:'Jawwal',tech:'GSM'},{mnc:'02',op:'Ooredoo PS',tech:'GSM'}
  ]},
  { country: 'Libya', code: 'LY', mcc: '606', mncs: [
    {mnc:'00',op:'Libyana',tech:'GSM'},{mnc:'01',op:'Al Madar',tech:'GSM'},{mnc:'02',op:'Al-Madar',tech:'CDMA'},
    {mnc:'03',op:'Libya Phone',tech:'GSM'}
  ]},
  { country: 'Sudan', code: 'SD', mcc: '634', mncs: [
    {mnc:'01',op:'Zain SD',tech:'GSM'},{mnc:'02',op:'MTN SD',tech:'GSM'},{mnc:'05',op:'Canar',tech:'CDMA'},
    {mnc:'07',op:'Sudani',tech:'GSM'}
  ]},
  { country: 'South Sudan', code: 'SS', mcc: '659', mncs: [
    {mnc:'01',op:'MTN SS',tech:'GSM'},{mnc:'02',op:'Zain SS',tech:'GSM'},{mnc:'03',op:'Gemtel',tech:'GSM'},
    {mnc:'04',op:'Vivacell',tech:'GSM'}
  ]},
  // ── Africa (continued) ──────────────────────────────
  { country: 'Angola', code: 'AO', mcc: '631', mncs: [
    {mnc:'02',op:'Unitel',tech:'GSM'},{mnc:'03',op:'Unitel',tech:'GSM'},{mnc:'04',op:'Movicel',tech:'GSM'},
    {mnc:'05',op:'Africell',tech:'GSM'}
  ]},
  { country: 'Benin', code: 'BJ', mcc: '616', mncs: [
    {mnc:'01',op:'MTN BJ',tech:'GSM'},{mnc:'02',op:'Moov',tech:'GSM'},{mnc:'03',op:'Glo BJ',tech:'GSM'},
    {mnc:'04',op:'BBCOM',tech:'GSM'},{mnc:'05',op:'SBIN',tech:'GSM'}
  ]},
  { country: 'Botswana', code: 'BW', mcc: '652', mncs: [
    {mnc:'01',op:'Mascom',tech:'GSM'},{mnc:'02',op:'Orange BW',tech:'GSM'},{mnc:'04',op:'BTC Mobile',tech:'GSM'}
  ]},
  { country: 'Burkina Faso', code: 'BF', mcc: '613', mncs: [
    {mnc:'01',op:'Orange BF',tech:'GSM'},{mnc:'02',op:'Moov BF',tech:'GSM'},{mnc:'03',op:'Telecel',tech:'GSM'}
  ]},
  { country: 'Burundi', code: 'BI', mcc: '642', mncs: [
    {mnc:'01',op:'Econet',tech:'GSM'},{mnc:'02',op:'Lacell',tech:'GSM'},{mnc:'03',op:'Onatel',tech:'CDMA'},
    {mnc:'05',op:'Africell',tech:'GSM'},{mnc:'10',op:'Lumitel',tech:'GSM'}
  ]},
  { country: 'Cameroon', code: 'CM', mcc: '624', mncs: [
    {mnc:'01',op:'MTN CM',tech:'GSM'},{mnc:'02',op:'Orange CM',tech:'GSM'},{mnc:'04',op:'Nexttel',tech:'GSM'},
    {mnc:'05',op:'Camtel',tech:'GSM'}
  ]},
  { country: 'Chad', code: 'TD', mcc: '622', mncs: [
    {mnc:'01',op:'Airtel TD',tech:'GSM'},{mnc:'02',op:'Moov TD',tech:'GSM'},{mnc:'03',op:'Salam',tech:'GSM'}
  ]},
  { country: 'Ivory Coast', code: 'CI', mcc: '612', mncs: [
    {mnc:'01',op:'MTN CI',tech:'GSM'},{mnc:'02',op:'Moov CI',tech:'GSM'},{mnc:'03',op:'Orange CI',tech:'GSM'},
    {mnc:'04',op:'KoZ',tech:'GSM'},{mnc:'05',op:'Oricel',tech:'GSM'}
  ]},
  { country: 'DR Congo', code: 'CD', mcc: '630', mncs: [
    {mnc:'01',op:'Vodacom CD',tech:'GSM'},{mnc:'02',op:'Airtel CD',tech:'GSM'},{mnc:'05',op:'Tigo CD',tech:'GSM'},
    {mnc:'86',op:'Orange CD',tech:'GSM'},{mnc:'89',op:'Tatem',tech:'GSM'},{mnc:'90',op:'Africell',tech:'GSM'}
  ]},
  { country: 'Gabon', code: 'GA', mcc: '628', mncs: [
    {mnc:'01',op:'Airtel GA',tech:'GSM'},{mnc:'02',op:'Moov GA',tech:'GSM'},{mnc:'03',op:'Celtel',tech:'GSM'},
    {mnc:'04',op:'Libertis',tech:'GSM'}
  ]},
  { country: 'Gambia', code: 'GM', mcc: '607', mncs: [
    {mnc:'01',op:'Africell',tech:'GSM'},{mnc:'02',op:'Comium',tech:'GSM'},{mnc:'03',op:'Qcell',tech:'GSM'},
    {mnc:'04',op:'Gamtel',tech:'GSM'}
  ]},
  { country: 'Guinea', code: 'GN', mcc: '611', mncs: [
    {mnc:'01',op:'Orange GN',tech:'GSM'},{mnc:'02',op:'MTN GN',tech:'GSM'},{mnc:'03',op:'Cellcom',tech:'GSM'},
    {mnc:'04',op:'Intercel',tech:'GSM'}
  ]},
  { country: 'Lesotho', code: 'LS', mcc: '651', mncs: [
    {mnc:'01',op:'Vodacom LS',tech:'GSM'},{mnc:'02',op:'Econet LS',tech:'GSM'}
  ]},
  { country: 'Liberia', code: 'LR', mcc: '618', mncs: [
    {mnc:'01',op:'Orange LR',tech:'GSM'},{mnc:'02',op:'Lonestar',tech:'GSM'},{mnc:'04',op:'Comium',tech:'GSM'},
    {mnc:'20',op:'LibTelco',tech:'GSM'}
  ]},
  { country: 'Madagascar', code: 'MG', mcc: '646', mncs: [
    {mnc:'01',op:'Airtel MG',tech:'GSM'},{mnc:'02',op:'Orange MG',tech:'GSM'},{mnc:'03',op:'Sacel',tech:'GSM'},
    {mnc:'04',op:'Telma',tech:'GSM'}
  ]},
  { country: 'Malawi', code: 'MW', mcc: '650', mncs: [
    {mnc:'01',op:'TNM',tech:'GSM'},{mnc:'10',op:'Airtel MW',tech:'GSM'}
  ]},
  { country: 'Mali', code: 'ML', mcc: '610', mncs: [
    {mnc:'01',op:'Malitel',tech:'GSM'},{mnc:'02',op:'Orange ML',tech:'GSM'},{mnc:'03',op:'Telecel',tech:'GSM'}
  ]},
  { country: 'Mauritania', code: 'MR', mcc: '609', mncs: [
    {mnc:'01',op:'Mauritel',tech:'GSM'},{mnc:'02',op:'Chinguitel',tech:'GSM'},{mnc:'10',op:'Mauritel',tech:'GSM'}
  ]},
  { country: 'Mauritius', code: 'MU', mcc: '617', mncs: [
    {mnc:'01',op:'my.t',tech:'GSM'},{mnc:'02',op:'MTML',tech:'GSM'},{mnc:'03',op:'Emtel',tech:'GSM'},
    {mnc:'10',op:'my.t',tech:'GSM'}
  ]},
  { country: 'Mozambique', code: 'MZ', mcc: '643', mncs: [
    {mnc:'01',op:'Mcel',tech:'GSM'},{mnc:'02',op:'Mcel',tech:'GSM'},{mnc:'03',op:'Movitel',tech:'GSM'},
    {mnc:'04',op:'Vodacom MZ',tech:'GSM'}
  ]},
  { country: 'Namibia', code: 'NA', mcc: '649', mncs: [
    {mnc:'01',op:'MTC',tech:'GSM'},{mnc:'02',op:'Telecom Namibia',tech:'CDMA'},{mnc:'03',op:'TN Mobile',tech:'GSM'}
  ]},
  { country: 'Niger', code: 'NE', mcc: '614', mncs: [
    {mnc:'01',op:'Airtel NE',tech:'GSM'},{mnc:'02',op:'Orange NE',tech:'GSM'},{mnc:'03',op:'Moov NE',tech:'GSM'},
    {mnc:'04',op:'Zamani',tech:'GSM'}
  ]},
  { country: 'Rwanda', code: 'RW', mcc: '635', mncs: [
    {mnc:'10',op:'MTN RW',tech:'GSM'},{mnc:'13',op:'Airtel RW',tech:'GSM'},{mnc:'14',op:'Airtel RW',tech:'GSM'}
  ]},
  { country: 'Senegal', code: 'SN', mcc: '608', mncs: [
    {mnc:'01',op:'Orange SN',tech:'GSM'},{mnc:'02',op:'Tigo SN',tech:'GSM'},{mnc:'03',op:'Expresso',tech:'GSM'},
    {mnc:'04',op:'Hayyo',tech:'GSM'}
  ]},
  { country: 'Sierra Leone', code: 'SL', mcc: '619', mncs: [
    {mnc:'01',op:'Africell',tech:'GSM'},{mnc:'02',op:'Orange SL',tech:'GSM'},{mnc:'03',op:'Sierratel',tech:'GSM'},
    {mnc:'04',op:'Comium',tech:'GSM'},{mnc:'05',op:'Africell',tech:'GSM'}
  ]},
  { country: 'Somalia', code: 'SO', mcc: '637', mncs: [
    {mnc:'01',op:'Golis',tech:'GSM'},{mnc:'04',op:'Somafone',tech:'GSM'},{mnc:'10',op:'NationLink',tech:'GSM'},
    {mnc:'30',op:'Golis',tech:'GSM'},{mnc:'50',op:'Hormuud',tech:'GSM'},{mnc:'60',op:'Nationlink',tech:'GSM'},
    {mnc:'70',op:'Onkod',tech:'GSM'},{mnc:'82',op:'Telcom',tech:'GSM'}
  ]},
  { country: 'Zambia', code: 'ZM', mcc: '645', mncs: [
    {mnc:'01',op:'Airtel ZM',tech:'GSM'},{mnc:'02',op:'MTN ZM',tech:'GSM'},{mnc:'03',op:'Zamtel',tech:'GSM'}
  ]},
  { country: 'Zimbabwe', code: 'ZW', mcc: '648', mncs: [
    {mnc:'01',op:'Net One',tech:'GSM'},{mnc:'02',op:'Net One',tech:'GSM'},{mnc:'03',op:'Telecel ZW',tech:'GSM'},
    {mnc:'04',op:'Econet ZW',tech:'GSM'}
  ]},
  // ── More Middle East & North Africa ──────────────
  { country: 'Andorra', code: 'AD', mcc: '213', mncs: [
    {mnc:'03',op:'Mobiland',tech:'GSM'}
  ]},
  { country: 'Monaco', code: 'MC', mcc: '212', mncs: [
    {mnc:'01',op:'Monaco Telecom',tech:'GSM'}
  ]},
  { country: 'Liechtenstein', code: 'LI', mcc: '295', mncs: [
    {mnc:'01',op:'Swisscom FL',tech:'GSM'},{mnc:'02',op:'Orange FL',tech:'GSM'},{mnc:'05',op:'Mobilkom FL',tech:'GSM'}
  ]},
  { country: 'San Marino', code: 'SM', mcc: '292', mncs: [
    {mnc:'01',op:'PRIMA',tech:'GSM'},{mnc:'02',op:'TMS',tech:'GSM'}
  ]},
  { country: 'Jersey', code: 'JE', mcc: '234', mncs: [
    {mnc:'50',op:'JT Global',tech:'GSM'}
  ]},
  { country: 'Guernsey', code: 'GG', mcc: '234', mncs: [
    {mnc:'55',op:'Sure Mobile',tech:'GSM'}
  ]},
  { country: 'Gibraltar', code: 'GI', mcc: '266', mncs: [
    {mnc:'01',op:'Gibtelecom',tech:'GSM'},{mnc:'06',op:'CTS Mobile',tech:'GSM'}
  ]},
  { country: 'Faroe Islands', code: 'FO', mcc: '288', mncs: [
    {mnc:'01',op:'Faroese Telecom',tech:'GSM'},{mnc:'02',op:'Vodafone FO',tech:'GSM'}
  ]},
  // ── Asia (continued) ──────────────────────────────
  { country: 'Afghanistan', code: 'AF', mcc: '412', mncs: [
    {mnc:'01',op:'AWCC',tech:'GSM'},{mnc:'20',op:'Roshan',tech:'GSM'},{mnc:'30',op:'Etisalat AF',tech:'GSM'},
    {mnc:'40',op:'MTN AF',tech:'GSM'},{mnc:'50',op:'Salaam',tech:'GSM'}
  ]},
  { country: 'Bhutan', code: 'BT', mcc: '402', mncs: [
    {mnc:'11',op:'B-Mobile',tech:'GSM'},{mnc:'77',op:'TashiCell',tech:'GSM'}
  ]},
  { country: 'Brunei', code: 'BN', mcc: '528', mncs: [
    {mnc:'01',op:'DST',tech:'GSM'},{mnc:'02',op:'Progresif',tech:'GSM'},{mnc:'11',op:'DST',tech:'GSM'}
  ]},
  { country: 'Laos', code: 'LA', mcc: '457', mncs: [
    {mnc:'01',op:'Lao Telecom',tech:'GSM'},{mnc:'02',op:'ETL',tech:'GSM'},{mnc:'03',op:'Unitel',tech:'GSM'},
    {mnc:'08',op:'Tigo',tech:'GSM'},{mnc:'10',op:'Lao Telecom',tech:'GSM'}
  ]},
  { country: 'Mongolia', code: 'MN', mcc: '428', mncs: [
    {mnc:'88',op:'Unitel MN',tech:'GSM'},{mnc:'91',op:'Skytel',tech:'CDMA'},{mnc:'98',op:'G-Mobile',tech:'CDMA'},
    {mnc:'99',op:'Mobicom',tech:'GSM'}
  ]},
  { country: 'North Korea', code: 'KP', mcc: '467', mncs: [
    {mnc:'05',op:'Koryolink',tech:'GSM'},{mnc:'192',op:'Kangsong',tech:'GSM'},{mnc:'193',op:'Sunnet',tech:'GSM'}
  ]},
  { country: 'Maldives', code: 'MV', mcc: '472', mncs: [
    {mnc:'01',op:'Dhiraagu',tech:'GSM'},{mnc:'02',op:'Ooredoo MV',tech:'GSM'}
  ]},
  // ── Caribbean & Latin America ──────────────────────
  { country: 'Nicaragua', code: 'NI', mcc: '710', mncs: [
    {mnc:'21',op:'Claro NI',tech:'GSM'},{mnc:'30',op:'Tigo NI',tech:'GSM'},{mnc:'50',op:'Claro NI',tech:'GSM'}
  ]},
  { country: 'Cuba', code: 'CU', mcc: '368', mncs: [
    {mnc:'01',op:'Cubacel',tech:'GSM'},{mnc:'02',op:'Cubacel',tech:'GSM'}
  ]},
  { country: 'Haiti', code: 'HT', mcc: '372', mncs: [
    {mnc:'01',op:'Digicel HT',tech:'GSM'},{mnc:'02',op:'Comcel',tech:'GSM'},{mnc:'03',op:'Natcom',tech:'GSM'}
  ]},
  { country: 'Jamaica', code: 'JM', mcc: '338', mncs: [
    {mnc:'020',op:'FLOW',tech:'GSM'},{mnc:'050',op:'Digicel JM',tech:'GSM'},{mnc:'110',op:'FLOW',tech:'GSM'}
  ]},
  { country: 'Bahamas', code: 'BS', mcc: '364', mncs: [
    {mnc:'30',op:'BTC',tech:'GSM'},{mnc:'40',op:'Aliv',tech:'GSM'}
  ]},
  { country: 'Barbados', code: 'BB', mcc: '342', mncs: [
    {mnc:'600',op:'FLOW',tech:'GSM'},{mnc:'750',op:'Digicel BB',tech:'GSM'},{mnc:'50',op:'Ozone',tech:'GSM'}
  ]},
  { country: 'Trinidad and Tobago', code: 'TT', mcc: '374', mncs: [
    {mnc:'12',op:'Bmobile',tech:'GSM'},{mnc:'120',op:'Bmobile',tech:'GSM'},{mnc:'130',op:'Digicel TT',tech:'GSM'},{mnc:'140',op:'Laqtel',tech:'GSM'}
  ]},
  { country: 'Belize', code: 'BZ', mcc: '702', mncs: [
    {mnc:'67',op:'DigiCell',tech:'GSM'},{mnc:'68',op:'SpeedNet',tech:'GSM'},{mnc:'99',op:'Smart',tech:'GSM'}
  ]},
  { country: 'Suriname', code: 'SR', mcc: '746', mncs: [
    {mnc:'02',op:'Telesur',tech:'GSM'},{mnc:'03',op:'Digicel SR',tech:'GSM'},{mnc:'04',op:'Uniqa',tech:'GSM'}
  ]},
  { country: 'Guyana', code: 'GY', mcc: '738', mncs: [
    {mnc:'01',op:'Digicel GY',tech:'GSM'},{mnc:'02',op:'E-Networks',tech:'GSM'},{mnc:'10',op:'GTT',tech:'GSM'}
  ]},
  { country: 'Fiji', code: 'FJ', mcc: '542', mncs: [
    {mnc:'01',op:'Vodafone FJ',tech:'GSM'},{mnc:'02',op:'Digicel FJ',tech:'GSM'}
  ]},
  { country: 'Papua New Guinea', code: 'PG', mcc: '537', mncs: [
    {mnc:'01',op:'Bmobile',tech:'GSM'},{mnc:'02',op:'Digicel PG',tech:'GSM'},{mnc:'03',op:'Bmobile',tech:'GSM'}
  ]},
  { country: 'Timor-Leste', code: 'TL', mcc: '514', mncs: [
    {mnc:'01',op:'Telkomcel',tech:'GSM'},{mnc:'02',op:'Timor Telecom',tech:'GSM'},{mnc:'03',op:'Telemor',tech:'GSM'}
  ]},
  { country: 'Tajikistan', code: 'TJ', mcc: '436', mncs: [
    {mnc:'01',op:'Tcell',tech:'GSM'},{mnc:'02',op:'MegaFon TJ',tech:'GSM'},{mnc:'03',op:'Beeline TJ',tech:'GSM'},
    {mnc:'04',op:'Babilon',tech:'GSM'},{mnc:'05',op:'Tacom',tech:'CDMA'},{mnc:'12',op:'Tcell',tech:'GSM'}
  ]},
  { country: 'Kyrgyzstan', code: 'KG', mcc: '437', mncs: [
    {mnc:'01',op:'Beeline KG',tech:'GSM'},{mnc:'03',op:'Fonex',tech:'CDMA'},{mnc:'05',op:'MegaCom',tech:'GSM'},
    {mnc:'09',op:'O!',tech:'GSM'}
  ]},
  { country: 'Turkmenistan', code: 'TM', mcc: '438', mncs: [
    {mnc:'01',op:'TM CELL',tech:'GSM'},{mnc:'02',op:'Altyn Asyr',tech:'GSM'}
  ]},
  { country: 'Congo', code: 'CG', mcc: '629', mncs: [
    {mnc:'01',op:'Airtel CG',tech:'GSM'},{mnc:'10',op:'MTN CG',tech:'GSM'},{mnc:'21',op:'Azur',tech:'GSM'}
  ]},
  { country: 'Togo', code: 'TG', mcc: '615', mncs: [
    {mnc:'01',op:'Togo Cell',tech:'GSM'},{mnc:'02',op:'Moov TG',tech:'GSM'},{mnc:'03',op:'Celtel',tech:'GSM'}
  ]},
  { country: 'Swaziland', code: 'SZ', mcc: '653', mncs: [
    {mnc:'01',op:'SPTC',tech:'GSM'},{mnc:'10',op:'MTN SZ',tech:'GSM'}
  ]},
  { country: 'Equatorial Guinea', code: 'GQ', mcc: '627', mncs: [
    {mnc:'01',op:'Getesa',tech:'GSM'},{mnc:'03',op:'HiTs-GE',tech:'GSM'}
  ]},
];

const output = [];
let count = 0;

for (const c of countries) {
  for (const m of c.mncs) {
    output.push(
      `INSERT INTO mccmnc (country, country_code, mcc, mnc, operator, network_type, status) VALUES ` +
      `('${c.country.replace(/'/g, "''")}', '${c.code}', '${c.mcc}', '${m.mnc}', '${m.op.replace(/'/g, "''")}', '${m.tech}', 'active');`
    );
    count++;
  }
}

process.stdout.write(output.join('\n') + '\n');
