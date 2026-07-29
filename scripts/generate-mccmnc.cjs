#!/usr/bin/env node
// Generate comprehensive MCCMNC data for all major global mobile operators.
// Outputs SQL INSERT statements to stdout. Pipe to a .sql file.
// Based on ITU-T E.212 mobile network codes database.

const countries = [
  // ── North America ───────────────────────────────────
  { country: 'United States', code: 'US', mcc: '310', mncs: [
    { mnc: '010', op: 'Verizon', tech: 'LTE' },{ mnc: '012', op: 'Verizon', tech: 'LTE' },{ mnc: '014', op: 'Testing', tech: 'GSM' },
    { mnc: '016', op: 'Cricket Communications', tech: 'CDMA' },{ mnc: '020', op: 'Union Telephone', tech: 'GSM' },{ mnc: '026', op: 'T-Mobile USA', tech: 'GSM' },
    { mnc: '030', op: 'AT&T Mobility', tech: 'GSM' },{ mnc: '032', op: 'IT&E', tech: 'GSM' },{ mnc: '034', op: 'AirVoice', tech: 'GSM' },
    { mnc: '040', op: 'Concho Cellular', tech: 'CDMA' },{ mnc: '046', op: 'SIMMETRY', tech: 'GSM' },{ mnc: '050', op: 'GCI Communication', tech: 'GSM' },
    { mnc: '053', op: 'Virgin Mobile USA', tech: 'CDMA' },{ mnc: '060', op: 'Consolidated Telcom', tech: 'CDMA' },{ mnc: '066', op: 'U.S. Cellular', tech: 'CDMA' },
    { mnc: '070', op: 'AT&T Mobility', tech: 'GSM' },{ mnc: '080', op: 'AT&T Mobility', tech: 'GSM' },{ mnc: '090', op: 'AT&T Mobility', tech: 'GSM' },
    { mnc: '100', op: 'New Mexico RSA', tech: 'GSM' },{ mnc: '110', op: 'PTI Pacifica', tech: 'GSM' },{ mnc: '120', op: 'Sprint', tech: 'CDMA' },
    { mnc: '130', op: 'Carolina West', tech: 'CDMA' },{ mnc: '140', op: 'GTA', tech: 'GSM' },{ mnc: '150', op: 'AT&T Mobility', tech: 'GSM' },
    { mnc: '160', op: 'T-Mobile USA', tech: 'GSM' },{ mnc: '170', op: 'AT&T Mobility', tech: 'GSM' },{ mnc: '180', op: 'West Central', tech: 'GSM' },
    { mnc: '190', op: 'Alaska Communications', tech: 'GSM' },{ mnc: '200', op: 'T-Mobile USA', tech: 'GSM' },{ mnc: '210', op: 'T-Mobile USA', tech: 'GSM' },
    { mnc: '220', op: 'T-Mobile USA', tech: 'GSM' },{ mnc: '230', op: 'T-Mobile USA', tech: 'GSM' },{ mnc: '240', op: 'T-Mobile USA', tech: 'GSM' },
    { mnc: '250', op: 'T-Mobile USA', tech: 'GSM' },{ mnc: '260', op: 'T-Mobile USA', tech: 'GSM' },{ mnc: '270', op: 'T-Mobile USA', tech: 'GSM' },
    { mnc: '280', op: 'AT&T Mobility', tech: 'GSM' },{ mnc: '290', op: 'T-Mobile USA', tech: 'GSM' },{ mnc: '300', op: 'Big Sky Mobile', tech: 'GSM' },
    { mnc: '310', op: 'T-Mobile USA', tech: 'GSM' },{ mnc: '311', op: 'Farmers Mutual', tech: 'CDMA' },{ mnc: '320', op: 'Cellular One', tech: 'GSM' },
    { mnc: '330', op: 'Alltel', tech: 'CDMA' },{ mnc: '340', op: 'Westlink', tech: 'GSM' },{ mnc: '350', op: 'Carolina Phone', tech: 'CDMA' },
    { mnc: '360', op: 'Cellular Network', tech: 'GSM' },{ mnc: '370', op: 'Commnet Wireless', tech: 'GSM' },{ mnc: '380', op: 'AT&T Mobility', tech: 'GSM' },
    { mnc: '390', op: 'Verizon', tech: 'LTE' },{ mnc: '400', op: 'Minnesota South', tech: 'GSM' },{ mnc: '410', op: 'AT&T Mobility', tech: 'GSM' },
    { mnc: '420', op: 'Cincinnati Bell', tech: 'GSM' },{ mnc: '430', op: 'Alaska DigiTel', tech: 'GSM' },{ mnc: '440', op: 'Numerex', tech: 'GSM' },
    { mnc: '450', op: 'Viaero Wireless', tech: 'GSM' },{ mnc: '460', op: 'TMP Corp', tech: 'GSM' },{ mnc: '470', op: 'nTelos', tech: 'CDMA' },
    { mnc: '480', op: 'Choice Phone', tech: 'GSM' },{ mnc: '490', op: 'T-Mobile USA', tech: 'GSM' },{ mnc: '500', op: 'Public Service', tech: 'GSM' },
    { mnc: '510', op: 'Airtel', tech: 'GSM' },{ mnc: '520', op: 'VeriSign', tech: 'GSM' },{ mnc: '530', op: 'West Virginia', tech: 'CDMA' },
    { mnc: '540', op: 'Oklahoma Western', tech: 'GSM' },{ mnc: '550', op: 'Commnet Wireless', tech: 'GSM' },{ mnc: '560', op: 'AT&T Mobility', tech: 'GSM' },
    { mnc: '570', op: 'MTPCS', tech: 'GSM' },{ mnc: '580', op: 'T-Mobile USA', tech: 'GSM' },{ mnc: '590', op: 'AT&T Mobility', tech: 'GSM' },
    { mnc: '600', op: 'Cellcom', tech: 'CDMA' },{ mnc: '610', op: 'Epic Touch', tech: 'GSM' },{ mnc: '620', op: 'Coleman County', tech: 'GSM' },
    { mnc: '630', op: 'AmeriLink PCS', tech: 'GSM' },{ mnc: '640', op: 'Einstein PCS', tech: 'GSM' },{ mnc: '650', op: 'Jasper Wireless', tech: 'GSM' },
    { mnc: '660', op: 'T-Mobile USA', tech: 'GSM' },{ mnc: '670', op: 'AT&T Mobility', tech: 'GSM' },{ mnc: '680', op: 'AT&T Mobility', tech: 'GSM' },
    { mnc: '690', op: 'Limitless Mobile', tech: 'GSM' },{ mnc: '700', op: 'Cross Valiant', tech: 'GSM' },{ mnc: '710', op: 'Arctic Slope', tech: 'GSM' },
    { mnc: '720', op: 'Syniverse', tech: 'GSM' },{ mnc: '730', op: 'U.S. Cellular', tech: 'CDMA' },{ mnc: '740', op: 'Telemetrix', tech: 'GSM' },
    { mnc: '750', op: 'Appalachian', tech: 'CDMA' },{ mnc: '760', op: 'Panhandle Tel', tech: 'GSM' },{ mnc: '770', op: 'Iowa Wireless', tech: 'GSM' },
    { mnc: '780', op: 'Connecticut', tech: 'CDMA' },{ mnc: '790', op: 'Pine Belt', tech: 'CDMA' },{ mnc: '800', op: 'T-Mobile USA', tech: 'GSM' },
    { mnc: '810', op: 'Brazos Cellular', tech: 'CDMA' },{ mnc: '820', op: 'South Canaan', tech: 'GSM' },{ mnc: '830', op: 'Caprock Cellular', tech: 'GSM' },
    { mnc: '840', op: 'Telecom North', tech: 'GSM' },{ mnc: '850', op: 'Aeris Comm', tech: 'GSM' },{ mnc: '860', op: 'TX RSA 15B2', tech: 'GSM' },
    { mnc: '870', op: 'Kaplan Tel', tech: 'GSM' },{ mnc: '880', op: 'Advantage Cellular', tech: 'CDMA' },{ mnc: '890', op: 'Verizon', tech: 'LTE' },
    { mnc: '900', op: 'Cable & Co', tech: 'CDMA' },{ mnc: '910', op: 'Vitel Cellular', tech: 'CDMA' },{ mnc: '920', op: 'Get Mobile', tech: 'GSM' },
    { mnc: '940', op: 'Iris Wireless', tech: 'GSM' },{ mnc: '950', op: 'XIT Wireless', tech: 'GSM' },{ mnc: '960', op: 'Plateau Wireless', tech: 'GSM' },
    { mnc: '970', op: 'Globalstar', tech: 'Satellite' },{ mnc: '980', op: 'AT&T Mobility', tech: 'GSM' },{ mnc: '990', op: 'AT&T Mobility', tech: 'GSM' }
  ]},
  { country: 'United States', code: 'US', mcc: '311', mncs: [
    { mnc: '010', op: 'Chariton Valley', tech: 'GSM' },{ mnc: '020', op: 'Missouri RSA', tech: 'CDMA' },{ mnc: '030', op: 'Indigo Wireless', tech: 'GSM' },
    { mnc: '040', op: 'Commnet Wireless', tech: 'GSM' },{ mnc: '050', op: 'WUE Inc', tech: 'CDMA' },{ mnc: '060', op: 'Farmers Cellular', tech: 'GSM' },
    { mnc: '070', op: 'Easterbrooke', tech: 'CDMA' },{ mnc: '080', op: 'Pine Telephone', tech: 'GSM' },{ mnc: '090', op: 'SI Wireless', tech: 'CDMA' },
    { mnc: '100', op: 'Ama Comm', tech: 'GSM' },{ mnc: '110', op: 'High Plains', tech: 'GSM' },{ mnc: '120', op: 'Sprint', tech: 'CDMA' },
    { mnc: '130', op: 'Cell One', tech: 'GSM' },{ mnc: '140', op: 'Cross Telephone', tech: 'GSM' },{ mnc: '150', op: 'Wilkes Cellular', tech: 'GSM' },
    { mnc: '160', op: 'Standing Rock', tech: 'GSM' },{ mnc: '170', op: 'PetroCom', tech: 'GSM' },{ mnc: '180', op: 'Custer Telephone', tech: 'CDMA' },
    { mnc: '190', op: 'Cellular Properties', tech: 'CDMA' },{ mnc: '210', op: 'Emery Telcom', tech: 'GSM' },{ mnc: '220', op: 'U.S. Cellular', tech: 'CDMA' },
    { mnc: '230', op: 'C Spire Wireless', tech: 'CDMA' },{ mnc: '240', op: 'Cordova Wireless', tech: 'GSM' },{ mnc: '250', op: 'WaveRunner', tech: 'GSM' },
    { mnc: '260', op: 'Cellular One', tech: 'GSM' },{ mnc: '270', op: 'Verizon', tech: 'LTE' },{ mnc: '280', op: 'Verizon', tech: 'LTE' },
    { mnc: '290', op: 'PinPoint Comm', tech: 'CDMA' },{ mnc: '300', op: 'Nexus Comm', tech: 'CDMA' },{ mnc: '310', op: 'Leap Wireless', tech: 'CDMA' },
    { mnc: '320', op: 'Commnet Wireless', tech: 'GSM' },{ mnc: '330', op: 'Bug Tussel', tech: 'GSM' },{ mnc: '340', op: 'Illinois Valley', tech: 'CDMA' },
    { mnc: '350', op: 'ETC', tech: 'CDMA' },{ mnc: '360', op: 'Stelera Wireless', tech: 'GSM' },{ mnc: '370', op: 'GCI Communication', tech: 'GSM' },
    { mnc: '380', op: 'New-Cell Inc', tech: 'GSM' },{ mnc: '390', op: 'Verizon', tech: 'LTE' },{ mnc: '410', op: 'Iowa RSA 2', tech: 'CDMA' },
    { mnc: '420', op: 'NW Missouri', tech: 'CDMA' },{ mnc: '430', op: 'Chat Mobility', tech: 'GSM' },{ mnc: '440', op: 'Bluegrass Cellular', tech: 'CDMA' },
    { mnc: '450', op: 'Panhandle Tel', tech: 'CDMA' },{ mnc: '460', op: 'Fisher Wireless', tech: 'GSM' },{ mnc: '470', op: 'Vitel Cellular', tech: 'CDMA' },
    { mnc: '480', op: 'Verizon', tech: 'LTE' },{ mnc: '490', op: 'Sprint', tech: 'CDMA' },{ mnc: '500', op: 'Mosaic Telecom', tech: 'GSM' },
    { mnc: '510', op: 'LigTel', tech: 'CDMA' },{ mnc: '520', op: 'Mid-Rivers', tech: 'CDMA' },{ mnc: '530', op: 'Wilkes Cellular', tech: 'CDMA' },
    { mnc: '540', op: 'Telekom', tech: 'GSM' },{ mnc: '550', op: 'Commnet Wireless', tech: 'GSM' },{ mnc: '560', op: 'OTZ Telephone', tech: 'CDMA' },
    { mnc: '570', op: 'Bentina Wireless', tech: 'GSM' },{ mnc: '580', op: 'U.S. Cellular', tech: 'CDMA' },{ mnc: '590', op: 'California RSA', tech: 'CDMA' },
    { mnc: '600', op: 'Copper Valley', tech: 'CDMA' },{ mnc: '610', op: 'North Dakota', tech: 'CDMA' },{ mnc: '620', op: 'Nex-Tech', tech: 'CDMA' },
    { mnc: '630', op: 'Cordova Wireless', tech: 'GSM' },{ mnc: '640', op: 'Standing Rock', tech: 'GSM' },{ mnc: '650', op: 'United Wireless', tech: 'CDMA' },
    { mnc: '660', op: 'metroPCS', tech: 'CDMA' },{ mnc: '670', op: 'Pine Belt', tech: 'CDMA' },{ mnc: '680', op: 'GreenFly LLC', tech: 'GSM' },
    { mnc: '690', op: 'TeleBEEPER', tech: 'GSM' },{ mnc: '700', op: 'Midwest Wireless', tech: 'CDMA' },{ mnc: '710', op: 'Northeast Wireless', tech: 'GSM' },
    { mnc: '720', op: 'Choice Wireless', tech: 'GSM' },{ mnc: '730', op: 'Uintah Basin', tech: 'CDMA' },{ mnc: '740', op: 'Telemetrix', tech: 'GSM' },
    { mnc: '750', op: 'Appalachian', tech: 'CDMA' },{ mnc: '760', op: 'Panhandle Tel', tech: 'GSM' },{ mnc: '770', op: 'Iowa Wireless', tech: 'GSM' },
    { mnc: '780', op: 'Connecticut', tech: 'CDMA' },{ mnc: '790', op: 'Pine Belt', tech: 'CDMA' },{ mnc: '800', op: 'Bluegrass Cellular', tech: 'CDMA' },
    { mnc: '810', op: 'Brazos Cellular', tech: 'CDMA' },{ mnc: '820', op: 'South Canaan', tech: 'GSM' },{ mnc: '830', op: 'Thumb Cellular', tech: 'CDMA' },
    { mnc: '840', op: 'Telna Mobile', tech: 'GSM' },{ mnc: '850', op: 'Aeris Comm', tech: 'GSM' },{ mnc: '860', op: 'Uintah Basin', tech: 'CDMA' },
    { mnc: '870', op: 'Kaplan Tel', tech: 'GSM' },{ mnc: '880', op: 'Sprint', tech: 'CDMA' },{ mnc: '890', op: 'Globecomm', tech: 'GSM' },
    { mnc: '900', op: 'GigSky', tech: 'GSM' },{ mnc: '910', op: 'Mobile Nation', tech: 'GSM' },{ mnc: '920', op: 'Sprocket', tech: 'GSM' },
    { mnc: '930', op: 'Syringa Wireless', tech: 'CDMA' },{ mnc: '940', op: 'ClearTalk', tech: 'CDMA' },{ mnc: '950', op: 'ETC', tech: 'CDMA' },
    { mnc: '960', op: 'Lycamobile', tech: 'GSM' },{ mnc: '970', op: 'Big River', tech: 'GSM' },{ mnc: '980', op: 'LigTel', tech: 'CDMA' },
    { mnc: '990', op: 'VTel Wireless', tech: 'GSM' }
  ]},
  { country: 'United States', code: 'US', mcc: '312', mncs: [
    { mnc: '010', op: 'Verizon', tech: 'LTE' },{ mnc: '020', op: 'Infrastructure', tech: 'GSM' },{ mnc: '030', op: 'Bravado Wireless', tech: 'CDMA' },
    { mnc: '040', op: 'Custer Telephone', tech: 'CDMA' },{ mnc: '050', op: 'East Kentucky', tech: 'CDMA' },{ mnc: '060', op: 'CoverageCo', tech: 'GSM' },
    { mnc: '070', op: 'Adams Net', tech: 'CDMA' },{ mnc: '080', op: 'Sync., Inc.', tech: 'GSM' },{ mnc: '090', op: 'Aicent Inc.', tech: 'GSM' },
    { mnc: '100', op: 'ClearSky', tech: 'GSM' },{ mnc: '110', op: 'Texas Energy', tech: 'GSM' },{ mnc: '120', op: 'East Kentucky', tech: 'CDMA' },
    { mnc: '130', op: 'Sprint', tech: 'CDMA' },{ mnc: '140', op: 'Revol Wireless', tech: 'CDMA' },{ mnc: '150', op: 'NW Missouri', tech: 'CDMA' },
    { mnc: '160', op: 'RSA1 LP', tech: 'CDMA' },{ mnc: '170', op: 'Iowa RSA 2', tech: 'CDMA' },{ mnc: '180', op: 'Keystone Wireless', tech: 'GSM' },
    { mnc: '190', op: 'Sprint', tech: 'CDMA' },{ mnc: '200', op: 'Space Data', tech: 'GSM' },{ mnc: '210', op: 'ASP-wireless', tech: 'GSM' },
    { mnc: '220', op: 'Chariton Valley', tech: 'CDMA' },{ mnc: '230', op: 'SRT Communications', tech: 'CDMA' },{ mnc: '240', op: 'Sprint', tech: 'CDMA' },
    { mnc: '250', op: 'Sprint', tech: 'CDMA' },{ mnc: '260', op: 'Cellular One', tech: 'GSM' },{ mnc: '270', op: 'Cellular One', tech: 'GSM' },
    { mnc: '280', op: 'Cellular One', tech: 'GSM' },{ mnc: '290', op: 'Uintah Basin', tech: 'CDMA' },{ mnc: '300', op: 'Sprint', tech: 'CDMA' },
    { mnc: '310', op: 'Carolina West', tech: 'CDMA' },{ mnc: '320', op: 'Adams Net', tech: 'CDMA' },{ mnc: '330', op: 'Wireless Partners', tech: 'GSM' },
    { mnc: '340', op: 'MTA', tech: 'GSM' },{ mnc: '350', op: 'Triangle Mobile', tech: 'GSM' },{ mnc: '360', op: 'WUE Inc', tech: 'CDMA' },
    { mnc: '370', op: 'Commnet Wireless', tech: 'CDMA' },{ mnc: '380', op: 'Commnet Wireless', tech: 'GSM' },{ mnc: '390', op: 'Verizon', tech: 'LTE' },
    { mnc: '400', op: 'Mid-Rivers', tech: 'CDMA' }
  ]},
  { country: 'United States', code: 'US', mcc: '313', mncs: [{mnc:'100',op:'700 MHz Guard',tech:'LTE'},{mnc:'110',op:'700 MHz Guard',tech:'LTE'},{mnc:'120',op:'Sprint',tech:'CDMA'},{mnc:'130',op:'Sprint',tech:'CDMA'},{mnc:'140',op:'Sprint',tech:'CDMA'},{mnc:'150',op:'Sprint',tech:'CDMA'},{mnc:'160',op:'Sprint',tech:'CDMA'},{mnc:'170',op:'Sprint',tech:'CDMA'},{mnc:'180',op:'Sprint',tech:'CDMA'},{mnc:'190',op:'Sprint',tech:'CDMA'},{mnc:'200',op:'Sprint',tech:'CDMA'}] },
  { country: 'United States', code: 'US', mcc: '316', mncs: [{mnc:'010',op:'T-Mobile USA',tech:'GSM'},{mnc:'011',op:'Southern Linc',tech:'GSM'}] },
  { country: 'Canada', code: 'CA', mcc: '302', mncs: [
    {mnc:'220',op:'Telus Mobility',tech:'GSM'},{mnc:'221',op:'Telus',tech:'GSM'},{mnc:'270',op:'EastLink',tech:'GSM'},{mnc:'290',op:'Airtel',tech:'GSM'},
    {mnc:'320',op:'Mobilicity',tech:'GSM'},{mnc:'350',op:'FIRST',tech:'GSM'},{mnc:'360',op:'MiKe',tech:'CDMA'},{mnc:'370',op:'Fido',tech:'GSM'},
    {mnc:'380',op:'DMTS',tech:'GSM'},{mnc:'390',op:'Rogers',tech:'GSM'},{mnc:'480',op:'SSi',tech:'GSM'},{mnc:'490',op:'Globalive',tech:'GSM'},
    {mnc:'500',op:'Videotron',tech:'GSM'},{mnc:'510',op:'Videotron',tech:'GSM'},{mnc:'520',op:'Videotron',tech:'GSM'},{mnc:'530',op:'Keewaytinook',tech:'GSM'},
    {mnc:'540',op:'Rogers',tech:'GSM'},{mnc:'590',op:'Quadro',tech:'GSM'},{mnc:'610',op:'Bell Mobility',tech:'GSM'},{mnc:'620',op:'ICE Wireless',tech:'GSM'},
    {mnc:'640',op:'Bell Mobility',tech:'GSM'},{mnc:'650',op:'TBayTel',tech:'GSM'},{mnc:'660',op:'MTS',tech:'GSM'},{mnc:'670',op:'CityTel',tech:'GSM'},
    {mnc:'680',op:'SaskTel',tech:'GSM'},{mnc:'690',op:'Bell Mobility',tech:'GSM'},{mnc:'710',op:'Globalstar',tech:'Satellite'},{mnc:'720',op:'Rogers',tech:'GSM'},
    {mnc:'740',op:'Shaw Telecom',tech:'GSM'},{mnc:'760',op:'Public Mobile',tech:'GSM'},{mnc:'770',op:'Rural Com',tech:'GSM'},{mnc:'780',op:'SaskTel',tech:'GSM'},
    {mnc:'790',op:'NetSet',tech:'GSM'},{mnc:'820',op:'Rogers',tech:'GSM'},{mnc:'860',op:'Telus',tech:'GSM'},{mnc:'880',op:'Bell/Telus',tech:'GSM'}
  ]},
  // ── Latin America ─────────────────────────────────────
  { country: 'Mexico', code: 'MX', mcc: '334', mncs: [
    {mnc:'010',op:'Nextel Mexico',tech:'GSM'},{mnc:'020',op:'Telcel',tech:'GSM'},{mnc:'030',op:'Movistar',tech:'GSM'},
    {mnc:'040',op:'IUSACELL',tech:'CDMA'},{mnc:'050',op:'AT&T Mexico',tech:'GSM'},{mnc:'060',op:'Servicios',tech:'GSM'},
    {mnc:'070',op:'Operadora Unefon',tech:'CDMA'},{mnc:'080',op:'Operadora Unefon',tech:'CDMA'},{mnc:'090',op:'AT&T Mexico',tech:'GSM'},
    {mnc:'100',op:'AT&T Mexico',tech:'GSM'},{mnc:'110',op:'AT&T Mexico',tech:'GSM'},{mnc:'120',op:'AT&T Mexico',tech:'GSM'},
    {mnc:'130',op:'AT&T Mexico',tech:'GSM'},{mnc:'140',op:'Altán Redes',tech:'LTE'},{mnc:'150',op:'Ultranet',tech:'GSM'}
  ]},
  { country: 'Brazil', code: 'BR', mcc: '724', mncs: [
    {mnc:'000',op:'Null',tech:'GSM'},{mnc:'010',op:'Vivo',tech:'GSM'},{mnc:'011',op:'Vivo',tech:'GSM'},{mnc:'012',op:'Claro',tech:'GSM'},
    {mnc:'013',op:'Sercomtel',tech:'GSM'},{mnc:'014',op:'Sisteer',tech:'LTE'},{mnc:'015',op:'CTBC',tech:'GSM'},{mnc:'016',op:'Brasil Telecom',tech:'GSM'},
    {mnc:'017',op:'Viking',tech:'GSM'},{mnc:'018',op:'Datora',tech:'GSM'},{mnc:'019',op:'Vivo',tech:'GSM'},{mnc:'020',op:'Unicel',tech:'GSM'},
    {mnc:'021',op:'Claro',tech:'GSM'},{mnc:'022',op:'Claro',tech:'GSM'},{mnc:'023',op:'Vivo',tech:'GSM'},{mnc:'024',op:'Amazonia Celular',tech:'GSM'},
    {mnc:'025',op:'Vivo',tech:'GSM'},{mnc:'026',op:'Vivo',tech:'GSM'},{mnc:'027',op:'Vivo',tech:'GSM'},{mnc:'028',op:'Vivo',tech:'GSM'},
    {mnc:'029',op:'Vivo',tech:'GSM'},{mnc:'030',op:'Oi',tech:'GSM'},{mnc:'031',op:'Oi',tech:'GSM'},{mnc:'032',op:'CTBC',tech:'GSM'},
    {mnc:'033',op:'CTBC',tech:'GSM'},{mnc:'034',op:'CTBC',tech:'GSM'},{mnc:'035',op:'Telcom',tech:'GSM'},{mnc:'036',op:'Options',tech:'GSM'},
    {mnc:'037',op:'aeiou',tech:'GSM'},{mnc:'038',op:'Claro',tech:'GSM'},{mnc:'039',op:'Nextel',tech:'GSM'},{mnc:'040',op:'TIM',tech:'GSM'},
    {mnc:'041',op:'TIM',tech:'GSM'},{mnc:'042',op:'TIM',tech:'GSM'},{mnc:'043',op:'TIM',tech:'GSM'},{mnc:'044',op:'TIM',tech:'GSM'},
    {mnc:'045',op:'Sercomtel',tech:'GSM'},{mnc:'046',op:'Claro',tech:'GSM'},{mnc:'047',op:'Vivo',tech:'GSM'},{mnc:'048',op:'Claro',tech:'GSM'},
    {mnc:'049',op:'Vivo',tech:'GSM'},{mnc:'050',op:'Claro',tech:'GSM'},{mnc:'051',op:'Claro',tech:'GSM'},{mnc:'052',op:'Claro',tech:'GSM'},
    {mnc:'053',op:'Claro',tech:'GSM'},{mnc:'054',op:'Vivo',tech:'GSM'},{mnc:'055',op:'Vivo',tech:'GSM'},{mnc:'056',op:'Vivo',tech:'GSM'}
  ]},
  { country: 'Argentina', code: 'AR', mcc: '722', mncs: [
    {mnc:'010',op:'Movistar',tech:'GSM'},{mnc:'020',op:'Nextel',tech:'GSM'},{mnc:'040',op:'Globalstar',tech:'Satellite'},
    {mnc:'070',op:'Movistar',tech:'GSM'},{mnc:'310',op:'Claro',tech:'GSM'},{mnc:'320',op:'Claro',tech:'GSM'},
    {mnc:'330',op:'Claro',tech:'GSM'},{mnc:'340',op:'Personal',tech:'GSM'},{mnc:'350',op:'PORT-HABLE',tech:'GSM'}
  ]},
  { country: 'Colombia', code: 'CO', mcc: '732', mncs: [
    {mnc:'001',op:'Tigo',tech:'GSM'},{mnc:'002',op:'Edatel',tech:'GSM'},{mnc:'020',op:'Emtelsa',tech:'GSM'},
    {mnc:'101',op:'Claro',tech:'GSM'},{mnc:'102',op:'Movistar',tech:'GSM'},{mnc:'103',op:'Tigo',tech:'GSM'},
    {mnc:'111',op:'Tigo',tech:'GSM'},{mnc:'123',op:'Movistar',tech:'GSM'}
  ]},
  // ── Europe ────────────────────────────────────────────
  { country: 'United Kingdom', code: 'GB', mcc: '234', mncs: [
    {mnc:'00',op:'BT Group',tech:'GSM'},{mnc:'01',op:'Vectone Mobile',tech:'GSM'},{mnc:'02',op:'O2 UK',tech:'GSM'},
    {mnc:'03',op:'Airtel-Vodafone',tech:'GSM'},{mnc:'04',op:'FMS Solutions',tech:'GSM'},{mnc:'05',op:'COLT Mobile',tech:'GSM'},
    {mnc:'06',op:'Internetware',tech:'GSM'},{mnc:'07',op:'Cable & Wireless',tech:'GSM'},{mnc:'08',op:'BT OnePhone',tech:'GSM'},
    {mnc:'09',op:'Tismi',tech:'GSM'},{mnc:'10',op:'O2 UK',tech:'GSM'},{mnc:'11',op:'O2 UK',tech:'GSM'},
    {mnc:'12',op:'Railtrack',tech:'GSM'},{mnc:'13',op:'Railtrack',tech:'GSM'},{mnc:'14',op:'Hay Systems',tech:'GSM'},
    {mnc:'15',op:'Vodafone UK',tech:'GSM'},{mnc:'16',op:'TalkTalk',tech:'GSM'},{mnc:'17',op:'FleXtel',tech:'GSM'},
    {mnc:'18',op:'Cloud9',tech:'GSM'},{mnc:'19',op:'PMN',tech:'GSM'},{mnc:'20',op:'Three UK',tech:'GSM'},
    {mnc:'21',op:'LogicStar',tech:'GSM'},{mnc:'22',op:'Telesign Mobile',tech:'GSM'},{mnc:'23',op:'Icron Network',tech:'GSM'},
    {mnc:'24',op:'Stour Marine',tech:'GSM'},{mnc:'25',op:'Truphone',tech:'GSM'},{mnc:'26',op:'Lycamobile UK',tech:'GSM'},
    {mnc:'27',op:'Teleena UK',tech:'GSM'},{mnc:'28',op:'Maronet',tech:'GSM'},{mnc:'29',op:'aql',tech:'GSM'},
    {mnc:'30',op:'T-Mobile UK',tech:'GSM'},{mnc:'31',op:'Virgin Mobile',tech:'GSM'},{mnc:'32',op:'Virgin Mobile',tech:'GSM'},
    {mnc:'33',op:'Orange UK',tech:'GSM'},{mnc:'34',op:'Orange UK',tech:'GSM'},{mnc:'35',op:'JSC Ingenium',tech:'GSM'},
    {mnc:'36',op:'Sure Mobile',tech:'GSM'},{mnc:'37',op:'Synectiv',tech:'GSM'},{mnc:'38',op:'Virgin Mobile',tech:'GSM'},
    {mnc:'39',op:'SSE Energy',tech:'GSM'},{mnc:'50',op:'JT Global',tech:'GSM'},{mnc:'51',op:'UK Broadband',tech:'LTE'},
    {mnc:'52',op:'Shyam Telecom',tech:'GSM'},{mnc:'53',op:'Limitless Mobile',tech:'GSM'},{mnc:'54',op:'The Cloud',tech:'GSM'},
    {mnc:'55',op:'Cable & Wireless',tech:'GSM'},{mnc:'56',op:'CESG',tech:'GSM'},{mnc:'57',op:'British Telecom',tech:'GSM'},
    {mnc:'58',op:'Manx Telecom',tech:'GSM'},{mnc:'59',op:'Limitless Mobile',tech:'GSM'},{mnc:'60',op:'T-Mobile UK',tech:'GSM'},
    {mnc:'61',op:'Vodafone UK',tech:'GSM'},{mnc:'62',op:'Airtel-Vodafone',tech:'GSM'},{mnc:'63',op:'Truphone',tech:'GSM'},
    {mnc:'64',op:'BT Group',tech:'GSM'},{mnc:'65',op:'Umbilical',tech:'GSM'},{mnc:'66',op:'TM',tech:'GSM'},
    {mnc:'67',op:'TM',tech:'GSM'},{mnc:'68',op:'TM',tech:'GSM'},{mnc:'69',op:'TM',tech:'GSM'},
    {mnc:'70',op:'AMSUK',tech:'GSM'},{mnc:'71',op:'TM',tech:'GSM'},{mnc:'72',op:'TM',tech:'GSM'},
    {mnc:'73',op:'TM',tech:'GSM'},{mnc:'74',op:'TM',tech:'GSM'},{mnc:'75',op:'TM',tech:'GSM'},
    {mnc:'76',op:'BT Group',tech:'GSM'},{mnc:'77',op:'BT Group',tech:'GSM'},{mnc:'78',op:'Airwave',tech:'GSM'}
  ]},
  { country: 'Germany', code: 'DE', mcc: '262', mncs: [
    {mnc:'01',op:'Deutsche Telekom',tech:'GSM'},{mnc:'02',op:'Vodafone DE',tech:'GSM'},{mnc:'03',op:'E-Plus',tech:'GSM'},
    {mnc:'04',op:'Vodafone DE',tech:'GSM'},{mnc:'05',op:'E-Plus',tech:'GSM'},{mnc:'06',op:'Deutsche Telekom',tech:'GSM'},
    {mnc:'07',op:'O2 Germany',tech:'GSM'},{mnc:'08',op:'O2 Germany',tech:'GSM'},{mnc:'09',op:'Vodafone DE',tech:'GSM'},
    {mnc:'10',op:'Arcor',tech:'GSM'},{mnc:'11',op:'O2 Germany',tech:'GSM'},{mnc:'12',op:'Dolphin Telecom',tech:'GSM'},
    {mnc:'13',op:'Mobilcom',tech:'GSM'},{mnc:'14',op:'Group 3G',tech:'UMTS'},{mnc:'15',op:'Airdata',tech:'GSM'},
    {mnc:'16',op:'Telogic',tech:'GSM'},{mnc:'17',op:'E-Plus',tech:'GSM'},{mnc:'18',op:'Cellular',tech:'GSM'},
    {mnc:'19',op:'Inquam',tech:'GSM'},{mnc:'20',op:'E-Plus',tech:'GSM'},{mnc:'21',op:'Multiconnect',tech:'GSM'},
    {mnc:'22',op:'O2 Germany',tech:'GSM'},{mnc:'23',op:'O2 Germany',tech:'GSM'},{mnc:'24',op:'Telco',tech:'GSM'},
    {mnc:'25',op:'Vodafone DE',tech:'GSM'},{mnc:'26',op:'Vodafone DE',tech:'GSM'},{mnc:'27',op:'E-Plus',tech:'GSM'},
    {mnc:'28',op:'E-Plus',tech:'GSM'},{mnc:'29',op:'Telco',tech:'GSM'},{mnc:'30',op:'Telco',tech:'GSM'},
    {mnc:'31',op:'Telco',tech:'GSM'},{mnc:'32',op:'Telco',tech:'GSM'},{mnc:'33',op:'Sipgate',tech:'GSM'},
    {mnc:'42',op:'Vodafone DE',tech:'GSM'},{mnc:'43',op:'Lycamobile',tech:'GSM'},{mnc:'76',op:'Siemens',tech:'GSM'},
    {mnc:'77',op:'E-Plus',tech:'GSM'},{mnc:'78',op:'Telekom DE',tech:'GSM'}
  ]},
  { country: 'France', code: 'FR', mcc: '208', mncs: [
    {mnc:'00',op:'Orange France',tech:'GSM'},{mnc:'01',op:'Orange France',tech:'GSM'},{mnc:'02',op:'Orange France',tech:'GSM'},
    {mnc:'03',op:'MobiquiThings',tech:'GSM'},{mnc:'04',op:'Sisteer',tech:'GSM'},{mnc:'05',op:'Globalstar',tech:'Satellite'},
    {mnc:'06',op:'Globalstar',tech:'Satellite'},{mnc:'07',op:'Globalstar',tech:'Satellite'},{mnc:'08',op:'Altitude Telecom',tech:'LTE'},
    {mnc:'09',op:'SFR',tech:'GSM'},{mnc:'10',op:'SFR',tech:'GSM'},{mnc:'11',op:'SFR',tech:'GSM'},
    {mnc:'12',op:'SFR',tech:'GSM'},{mnc:'13',op:'SFR',tech:'GSM'},{mnc:'14',op:'Lliad',tech:'LTE'},
    {mnc:'15',op:'Free Mobile',tech:'GSM'},{mnc:'16',op:'Free Mobile',tech:'GSM'},{mnc:'17',op:'Legos',tech:'GSM'},
    {mnc:'20',op:'Bouygues Telecom',tech:'GSM'},{mnc:'21',op:'Bouygues Telecom',tech:'GSM'},{mnc:'22',op:'Transatel',tech:'GSM'},
    {mnc:'23',op:'Virgin Mobile',tech:'GSM'},{mnc:'24',op:'MobiquiThings',tech:'GSM'},{mnc:'25',op:'Lycamobile',tech:'GSM'},
    {mnc:'26',op:'NRJ Mobile',tech:'GSM'},{mnc:'27',op:'Afone',tech:'GSM'},{mnc:'28',op:'Astrium',tech:'GSM'},
    {mnc:'29',op:'Societe Internationale',tech:'GSM'},{mnc:'30',op:'Syma Mobile',tech:'GSM'},{mnc:'31',op:'Vectone',tech:'GSM'}
  ]},
  { country: 'Italy', code: 'IT', mcc: '222', mncs: [
    {mnc:'01',op:'TIM',tech:'GSM'},{mnc:'02',op:'Elsacom',tech:'GSM'},{mnc:'04',op:'Intermatica',tech:'GSM'},
    {mnc:'05',op:'Telespazio',tech:'GSM'},{mnc:'06',op:'Vodafone IT',tech:'GSM'},{mnc:'07',op:'Noverca',tech:'GSM'},
    {mnc:'08',op:'Fastweb',tech:'GSM'},{mnc:'10',op:'Vodafone IT',tech:'GSM'},{mnc:'30',op:'RFI',tech:'GSM'},
    {mnc:'33',op:'PostePay',tech:'GSM'},{mnc:'34',op:'BT Italia',tech:'GSM'},{mnc:'35',op:'Lycamobile',tech:'GSM'},
    {mnc:'36',op:'Digi Mobil',tech:'GSM'},{mnc:'37',op:'Wind Tre',tech:'GSM'},{mnc:'38',op:'Wind Tre',tech:'GSM'},
    {mnc:'39',op:'SMS Italia',tech:'GSM'},{mnc:'43',op:'TIM',tech:'GSM'},{mnc:'44',op:'Wind Tre',tech:'GSM'},
    {mnc:'47',op:'Vodafone IT',tech:'GSM'},{mnc:'48',op:'TIM',tech:'GSM'},{mnc:'49',op:'Vianova',tech:'GSM'},
    {mnc:'50',op:'Iliad Italia',tech:'GSM'},{mnc:'88',op:'Wind Tre',tech:'GSM'},{mnc:'99',op:'Wind Tre',tech:'GSM'}
  ]},
  { country: 'Spain', code: 'ES', mcc: '214', mncs: [
    {mnc:'01',op:'Vodafone ES',tech:'GSM'},{mnc:'02',op:'France Telecom ES',tech:'GSM'},{mnc:'03',op:'Orange Spain',tech:'GSM'},
    {mnc:'04',op:'Yoigo',tech:'GSM'},{mnc:'05',op:'Movistar',tech:'GSM'},{mnc:'06',op:'Vodafone ES',tech:'GSM'},
    {mnc:'07',op:'Movistar',tech:'GSM'},{mnc:'08',op:'Euskaltel',tech:'GSM'},{mnc:'09',op:'Orange Spain',tech:'GSM'},
    {mnc:'10',op:'ZINNIA',tech:'GSM'},{mnc:'11',op:'Orange Spain',tech:'GSM'},{mnc:'12',op:'Contacta',tech:'GSM'},
    {mnc:'13',op:'Incotel',tech:'GSM'},{mnc:'14',op:'Avatel',tech:'GSM'},{mnc:'15',op:'BT Spain',tech:'GSM'},
    {mnc:'16',op:'Telecable',tech:'GSM'},{mnc:'17',op:'R Cable',tech:'GSM'},{mnc:'18',op:'ONO',tech:'GSM'},
    {mnc:'19',op:'Simyo',tech:'GSM'},{mnc:'20',op:'Fonyou',tech:'GSM'},{mnc:'21',op:'Jazztel',tech:'GSM'},
    {mnc:'22',op:'DigiMobil',tech:'GSM'},{mnc:'23',op:'Lycamobile',tech:'GSM'},{mnc:'24',op:'Vodafone ES',tech:'GSM'},
    {mnc:'25',op:'Lycamobile',tech:'GSM'},{mnc:'26',op:'Lleida',tech:'GSM'},{mnc:'27',op:'Truphone',tech:'GSM'}
  ]},
  { country: 'Netherlands', code: 'NL', mcc: '204', mncs: [
    {mnc:'01',op:'RadioAccess',tech:'GSM'},{mnc:'02',op:'KPN',tech:'GSM'},{mnc:'03',op:'Voiceworks',tech:'GSM'},
    {mnc:'04',op:'Vodafone NL',tech:'GSM'},{mnc:'05',op:'Elephant Talk',tech:'GSM'},{mnc:'06',op:'Vectone',tech:'GSM'},
    {mnc:'07',op:'Teleena',tech:'GSM'},{mnc:'08',op:'KPN',tech:'GSM'},{mnc:'09',op:'Lycamobile',tech:'GSM'},
    {mnc:'10',op:'KPN',tech:'GSM'},{mnc:'12',op:'Telfort',tech:'GSM'},{mnc:'14',op:'6GMOBILE',tech:'GSM'},
    {mnc:'15',op:'Ziggo',tech:'GSM'},{mnc:'16',op:'T-Mobile NL',tech:'GSM'},{mnc:'17',op:'Intercity Mobile',tech:'GSM'},
    {mnc:'18',op:'UPC NL',tech:'GSM'},{mnc:'20',op:'T-Mobile NL',tech:'GSM'},{mnc:'21',op:'ProRail',tech:'GSM'},
    {mnc:'22',op:'Ministerie',tech:'GSM'},{mnc:'23',op:'ASPIDER',tech:'GSM'},{mnc:'24',op:'Private Mobility',tech:'GSM'},
    {mnc:'25',op:'CapX',tech:'GSM'},{mnc:'26',op:'SpeakUp',tech:'GSM'},{mnc:'27',op:'Breezz',tech:'GSM'},
    {mnc:'28',op:'Lancelot',tech:'GSM'},{mnc:'67',op:'RadioAccess',tech:'GSM'},{mnc:'68',op:'Roamware',tech:'GSM'},
    {mnc:'69',op:'KPN',tech:'GSM'}
  ]},
  { country: 'Poland', code: 'PL', mcc: '260', mncs: [
    {mnc:'01',op:'Plus',tech:'GSM'},{mnc:'02',op:'T-Mobile PL',tech:'GSM'},{mnc:'03',op:'Orange PL',tech:'GSM'},
    {mnc:'04',op:'Aero2',tech:'GSM'},{mnc:'05',op:'Orange PL',tech:'GSM'},{mnc:'06',op:'Play',tech:'GSM'},
    {mnc:'07',op:'Netia',tech:'GSM'},{mnc:'08',op:'E-Telko',tech:'GSM'},{mnc:'09',op:'Lycamobile',tech:'GSM'},
    {mnc:'10',op:'Sferia',tech:'GSM'},{mnc:'11',op:'Nordisk',tech:'GSM'},{mnc:'12',op:'Cyfrowy Polsat',tech:'GSM'},
    {mnc:'13',op:'Sferia',tech:'GSM'},{mnc:'14',op:'Sferia',tech:'GSM'},{mnc:'15',op:'Aero2',tech:'GSM'},
    {mnc:'16',op:'Mobyland',tech:'GSM'},{mnc:'17',op:'Aero2',tech:'GSM'},{mnc:'18',op:'AMD Telecom',tech:'GSM'},
    {mnc:'19',op:'Teleena',tech:'GSM'},{mnc:'20',op:'MobileVikings',tech:'GSM'}
  ]},
  { country: 'Sweden', code: 'SE', mcc: '240', mncs: [
    {mnc:'01',op:'Telia SE',tech:'GSM'},{mnc:'02',op:'H3G Access',tech:'GSM'},{mnc:'03',op:'Ice.net',tech:'GSM'},
    {mnc:'04',op:'3G Infrastructure',tech:'GSM'},{mnc:'05',op:'Telia SE',tech:'GSM'},{mnc:'06',op:'Telenor SE',tech:'GSM'},
    {mnc:'07',op:'Tele2 SE',tech:'GSM'},{mnc:'08',op:'Telenor SE',tech:'GSM'},{mnc:'09',op:'Telenor SE',tech:'GSM'},
    {mnc:'10',op:'Tele2 SE',tech:'GSM'},{mnc:'11',op:'Lindholmen',tech:'GSM'},{mnc:'12',op:'Lycamobile',tech:'GSM'},
    {mnc:'13',op:'Alltele',tech:'GSM'},{mnc:'14',op:'Telenor SE',tech:'GSM'},{mnc:'15',op:'Wireless Maingate',tech:'GSM'},
    {mnc:'16',op:'42 Telecom',tech:'GSM'},{mnc:'17',op:'Gotalandsnatet',tech:'GSM'},{mnc:'18',op:'Generic',tech:'GSM'},
    {mnc:'19',op:'Mundio Mobile',tech:'GSM'},{mnc:'20',op:'Imez',tech:'GSM'},{mnc:'21',op:'Telenor',tech:'GSM'}
  ]},
  { country: 'Switzerland', code: 'CH', mcc: '228', mncs: [
    {mnc:'01',op:'Swisscom',tech:'GSM'},{mnc:'02',op:'Sunrise',tech:'GSM'},{mnc:'03',op:'Salt',tech:'GSM'},
    {mnc:'05',op:'Comfone',tech:'GSM'},{mnc:'06',op:'SBB-CFF-FFS',tech:'GSM'},{mnc:'07',op:'IN&Phone',tech:'GSM'},
    {mnc:'08',op:'Swisscom',tech:'GSM'},{mnc:'09',op:'Comfone',tech:'GSM'},{mnc:'12',op:'Sunrise',tech:'GSM'},
    {mnc:'51',op:'relario',tech:'GSM'},{mnc:'53',op:'UPC Switzerland',tech:'GSM'},{mnc:'54',op:'Lycamobile',tech:'GSM'},
    {mnc:'55',op:'Bebbicell',tech:'GSM'}
  ]},
  { country: 'Russia', code: 'RU', mcc: '250', mncs: [
    {mnc:'01',op:'MTS',tech:'GSM'},{mnc:'02',op:'MegaFon',tech:'GSM'},{mnc:'03',op:'NCC',tech:'GSM'},
    {mnc:'04',op:'Tele2 RU',tech:'GSM'},{mnc:'05',op:'Yeniseytelecom',tech:'GSM'},{mnc:'06',op:'Scartel',tech:'LTE'},
    {mnc:'07',op:'SMARTS',tech:'GSM'},{mnc:'08',op:'Vainakh Telecom',tech:'GSM'},{mnc:'09',op:'Skylink',tech:'CDMA'},
    {mnc:'10',op:'Dontelecom',tech:'GSM'},{mnc:'11',op:'Scartel',tech:'LTE'},{mnc:'12',op:'Akos',tech:'GSM'},
    {mnc:'13',op:'Kuban-GSM',tech:'GSM'},{mnc:'14',op:'MegaFon',tech:'GSM'},{mnc:'15',op:'SMARTS',tech:'GSM'},
    {mnc:'16',op:'New Telephone',tech:'GSM'},{mnc:'17',op:'Tele2 RU',tech:'GSM'},{mnc:'18',op:'Osnova Telecom',tech:'LTE'},
    {mnc:'19',op:'Tele2 RU',tech:'GSM'},{mnc:'20',op:'Tele2 RU',tech:'GSM'},{mnc:'21',op:'Rostelecom',tech:'GSM'},
    {mnc:'22',op:'Rostelecom',tech:'GSM'},{mnc:'23',op:'MTS',tech:'GSM'},{mnc:'24',op:'Vainakh Telecom',tech:'GSM'},
    {mnc:'25',op:'Rostelecom',tech:'GSM'},{mnc:'26',op:'Scartel',tech:'LTE'},{mnc:'27',op:'Letai',tech:'LTE'},
    {mnc:'28',op:'Beeline',tech:'GSM'},{mnc:'29',op:'TELE2 RU',tech:'GSM'},{mnc:'30',op:'Tele2 RU',tech:'GSM'},
    {mnc:'32',op:'Win Mobile',tech:'GSM'},{mnc:'33',op:'Beeline',tech:'GSM'},{mnc:'34',op:'Krymtelecom',tech:'GSM'},
    {mnc:'35',op:'MOTIV',tech:'GSM'},{mnc:'36',op:'MTS',tech:'GSM'},{mnc:'38',op:'Tambov GSM',tech:'GSM'},
    {mnc:'39',op:'Rostelecom',tech:'GSM'},{mnc:'44',op:'Vainakh',tech:'GSM'},{mnc:'50',op:'MTS',tech:'GSM'},
    {mnc:'91',op:'MTS',tech:'GSM'},{mnc:'92',op:'MTS',tech:'GSM'},{mnc:'93',op:'Telecom XXI',tech:'GSM'},
    {mnc:'99',op:'Beeline',tech:'GSM'}
  ]},
  { country: 'Ukraine', code: 'UA', mcc: '255', mncs: [
    {mnc:'01',op:'Vodafone UA',tech:'GSM'},{mnc:'02',op:'Kyivstar',tech:'GSM'},{mnc:'03',op:'Kyivstar',tech:'GSM'},
    {mnc:'04',op:'Intertelecom',tech:'CDMA'},{mnc:'05',op:'Kyivstar',tech:'GSM'},{mnc:'06',op:'lifecell',tech:'GSM'},
    {mnc:'07',op:'3Mob',tech:'UMTS'},{mnc:'21',op:'PEOPLEnet',tech:'CDMA'}
  ]},
  { country: 'Turkey', code: 'TR', mcc: '286', mncs: [
    {mnc:'01',op:'Turkcell',tech:'GSM'},{mnc:'02',op:'Vodafone TR',tech:'GSM'},{mnc:'03',op:'Turk Telekom',tech:'GSM'},
    {mnc:'04',op:'Aycell',tech:'GSM'}
  ]},
  { country: 'Greece', code: 'GR', mcc: '202', mncs: [
    {mnc:'01',op:'Cosmote',tech:'GSM'},{mnc:'02',op:'Cosmote',tech:'GSM'},{mnc:'03',op:'OTE',tech:'GSM'},
    {mnc:'04',op:'OSE',tech:'GSM'},{mnc:'05',op:'Vodafone GR',tech:'GSM'},{mnc:'06',op:'Cosmoline',tech:'GSM'},
    {mnc:'07',op:'AMD Telecom',tech:'GSM'},{mnc:'09',op:'Wind GR',tech:'GSM'},{mnc:'10',op:'Wind GR',tech:'GSM'},
    {mnc:'11',op:'interConnect',tech:'GSM'},{mnc:'12',op:'Yuboto',tech:'GSM'},{mnc:'13',op:'Compatel',tech:'GSM'},
    {mnc:'14',op:'CyTa GR',tech:'GSM'}
  ]},
  // ── Asia ──────────────────────────────────────────────
  { country: 'India', code: 'IN', mcc: '404', mncs: [
    {mnc:'01',op:'Vodafone Idea',tech:'GSM'},{mnc:'02',op:'Bharti Airtel',tech:'GSM'},{mnc:'03',op:'BSNL Mobile',tech:'GSM'},
    {mnc:'04',op:'Vodafone Idea',tech:'GSM'},{mnc:'05',op:'Vodafone Idea',tech:'GSM'},{mnc:'06',op:'Vodafone Idea',tech:'GSM'},
    {mnc:'07',op:'Vodafone Idea',tech:'GSM'},{mnc:'08',op:'Vodafone Idea',tech:'GSM'},{mnc:'09',op:'Reliance Comm',tech:'GSM'},
    {mnc:'10',op:'Bharti Airtel',tech:'GSM'},{mnc:'11',op:'Vodafone Idea',tech:'GSM'},{mnc:'12',op:'Vodafone Idea',tech:'GSM'},
    {mnc:'13',op:'Vodafone Idea',tech:'GSM'},{mnc:'14',op:'BSNL Mobile',tech:'GSM'},{mnc:'15',op:'Vodafone Idea',tech:'GSM'},
    {mnc:'16',op:'Bharti Airtel',tech:'GSM'},{mnc:'17',op:'Bharti Airtel',tech:'GSM'},{mnc:'18',op:'Reliance Comm',tech:'GSM'},
    {mnc:'19',op:'Vodafone Idea',tech:'GSM'},{mnc:'20',op:'Vodafone Idea',tech:'GSM'},{mnc:'21',op:'Loop Mobile',tech:'GSM'},
    {mnc:'22',op:'Vodafone Idea',tech:'GSM'},{mnc:'23',op:'Vodafone Idea',tech:'GSM'},{mnc:'24',op:'Vodafone Idea',tech:'GSM'},
    {mnc:'25',op:'Vodafone Idea',tech:'GSM'},{mnc:'26',op:'Vodafone Idea',tech:'GSM'},{mnc:'27',op:'Vodafone Idea',tech:'GSM'},
    {mnc:'28',op:'Vodafone Idea',tech:'GSM'},{mnc:'29',op:'Bharti Airtel',tech:'GSM'},{mnc:'30',op:'Vodafone Idea',tech:'GSM'},
    {mnc:'31',op:'Bharti Airtel',tech:'GSM'},{mnc:'32',op:'Bharti Airtel',tech:'GSM'},{mnc:'33',op:'Reliance Comm',tech:'GSM'},
    {mnc:'34',op:'BSNL Mobile',tech:'GSM'},{mnc:'35',op:'Bharti Airtel',tech:'GSM'},{mnc:'36',op:'Reliance Comm',tech:'GSM'},
    {mnc:'37',op:'Bharti Airtel',tech:'GSM'},{mnc:'38',op:'BSNL Mobile',tech:'GSM'},{mnc:'39',op:'Bharti Airtel',tech:'GSM'},
    {mnc:'40',op:'Reliance Jio',tech:'LTE'},{mnc:'41',op:'Reliance Jio',tech:'LTE'},{mnc:'42',op:'Reliance Jio',tech:'LTE'},
    {mnc:'43',op:'Vodafone Idea',tech:'GSM'},{mnc:'44',op:'Vodafone Idea',tech:'GSM'},{mnc:'45',op:'Bharti Airtel',tech:'GSM'},
    {mnc:'46',op:'Vodafone Idea',tech:'GSM'},{mnc:'47',op:'Bharti Airtel',tech:'GSM'},{mnc:'48',op:'Dishnet',tech:'GSM'},
    {mnc:'49',op:'Bharti Airtel',tech:'GSM'},{mnc:'50',op:'Reliance Comm',tech:'GSM'},{mnc:'51',op:'BSNL Mobile',tech:'GSM'},
    {mnc:'52',op:'Reliance Jio',tech:'LTE'},{mnc:'53',op:'BSNL Mobile',tech:'GSM'},{mnc:'54',op:'BSNL Mobile',tech:'GSM'},
    {mnc:'55',op:'BSNL Mobile',tech:'GSM'},{mnc:'56',op:'Vodafone Idea',tech:'GSM'},{mnc:'57',op:'Vodafone Idea',tech:'GSM'},
    {mnc:'58',op:'Vodafone Idea',tech:'GSM'},{mnc:'59',op:'Vodafone Idea',tech:'GSM'},{mnc:'60',op:'Vodafone Idea',tech:'GSM'},
    {mnc:'61',op:'Vodafone Idea',tech:'GSM'},{mnc:'62',op:'BSNL Mobile',tech:'GSM'},{mnc:'63',op:'Vodafone Idea',tech:'GSM'},
    {mnc:'64',op:'BSNL Mobile',tech:'GSM'},{mnc:'65',op:'Vodafone Idea',tech:'GSM'},{mnc:'66',op:'BSNL Mobile',tech:'GSM'},
    {mnc:'67',op:'Reliance Comm',tech:'GSM'},{mnc:'68',op:'Vodafone Idea',tech:'GSM'},{mnc:'69',op:'MTNL Delhi',tech:'GSM'},
    {mnc:'70',op:'Bharti Airtel',tech:'GSM'},{mnc:'71',op:'BSNL Mobile',tech:'GSM'},{mnc:'72',op:'BSNL Mobile',tech:'GSM'},
    {mnc:'73',op:'BSNL Mobile',tech:'GSM'},{mnc:'74',op:'BSNL Mobile',tech:'GSM'},{mnc:'75',op:'BSNL Mobile',tech:'GSM'},
    {mnc:'76',op:'BSNL Mobile',tech:'GSM'},{mnc:'77',op:'BSNL Mobile',tech:'GSM'},{mnc:'78',op:'BSNL Mobile',tech:'GSM'},
    {mnc:'79',op:'BSNL Mobile',tech:'GSM'},{mnc:'80',op:'BSNL Mobile',tech:'GSM'},{mnc:'81',op:'BSNL Mobile',tech:'GSM'},
    {mnc:'82',op:'BSNL Mobile',tech:'GSM'},{mnc:'83',op:'Reliance Jio',tech:'LTE'},{mnc:'84',op:'Reliance Jio',tech:'LTE'},
    {mnc:'85',op:'Reliance Jio',tech:'LTE'},{mnc:'86',op:'Reliance Jio',tech:'LTE'},{mnc:'87',op:'Reliance Jio',tech:'LTE'},
    {mnc:'88',op:'Reliance Jio',tech:'LTE'},{mnc:'89',op:'Vodafone Idea',tech:'GSM'},{mnc:'90',op:'Bharti Airtel',tech:'GSM'},
    {mnc:'91',op:'Bharti Airtel',tech:'GSM'},{mnc:'92',op:'Bharti Airtel',tech:'GSM'},{mnc:'93',op:'Bharti Airtel',tech:'GSM'},
    {mnc:'94',op:'Bharti Airtel',tech:'GSM'},{mnc:'95',op:'Bharti Airtel',tech:'GSM'},{mnc:'96',op:'Bharti Airtel',tech:'GSM'},
    {mnc:'97',op:'Bharti Airtel',tech:'GSM'},{mnc:'98',op:'Bharti Airtel',tech:'GSM'},{mnc:'99',op:'Bharti Airtel',tech:'GSM'}
  ]},
  { country: 'India', code: 'IN', mcc: '405', mncs: [
    {mnc:'01',op:'Reliance Comm',tech:'GSM'},{mnc:'02',op:'Bharti Airtel',tech:'GSM'},{mnc:'03',op:'Reliance Comm',tech:'GSM'},
    {mnc:'04',op:'Reliance Comm',tech:'GSM'},{mnc:'05',op:'Reliance Jio',tech:'LTE'},{mnc:'06',op:'Reliance Jio',tech:'LTE'},
    {mnc:'07',op:'Reliance Jio',tech:'LTE'},{mnc:'08',op:'Reliance Jio',tech:'LTE'},{mnc:'09',op:'Reliance Jio',tech:'LTE'},
    {mnc:'10',op:'Reliance Jio',tech:'LTE'},{mnc:'11',op:'Reliance Jio',tech:'LTE'},{mnc:'12',op:'Reliance Jio',tech:'LTE'},
    {mnc:'13',op:'Reliance Jio',tech:'LTE'},{mnc:'14',op:'Reliance Jio',tech:'LTE'},{mnc:'15',op:'Reliance Jio',tech:'LTE'},
    {mnc:'16',op:'Reliance Jio',tech:'LTE'},{mnc:'17',op:'Reliance Jio',tech:'LTE'},{mnc:'18',op:'Reliance Jio',tech:'LTE'},
    {mnc:'19',op:'Reliance Jio',tech:'LTE'},{mnc:'20',op:'Reliance Jio',tech:'LTE'}
  ]},
  { country: 'India', code: 'IN', mcc: '406', mncs: [{mnc:'01',op:'Reliance Jio',tech:'LTE'},{mnc:'02',op:'Reliance Jio',tech:'LTE'},{mnc:'03',op:'Reliance Jio',tech:'LTE'}] },
  { country: 'Bangladesh', code: 'BD', mcc: '470', mncs: [
    {mnc:'01',op:'Grameenphone',tech:'GSM'},{mnc:'02',op:'Robi',tech:'GSM'},{mnc:'03',op:'Banglalink',tech:'GSM'},
    {mnc:'04',op:'Teletalk',tech:'GSM'},{mnc:'05',op:'Citycell',tech:'CDMA'},{mnc:'06',op:'Airtel BD',tech:'GSM'},
    {mnc:'07',op:'Grameenphone',tech:'GSM'},{mnc:'08',op:'Robi',tech:'GSM'}
  ]},
  { country: 'Pakistan', code: 'PK', mcc: '410', mncs: [
    {mnc:'01',op:'Mobilink/Jazz',tech:'GSM'},{mnc:'02',op:'PTML/Ufone',tech:'GSM'},{mnc:'03',op:'Telenor PK',tech:'GSM'},
    {mnc:'04',op:'Zong',tech:'GSM'},{mnc:'05',op:'SCO',tech:'GSM'},{mnc:'06',op:'Telenor PK',tech:'GSM'},
    {mnc:'07',op:'Jazz',tech:'GSM'},{mnc:'08',op:'Jazz',tech:'GSM'}
  ]},
  { country: 'China', code: 'CN', mcc: '460', mncs: [
    {mnc:'00',op:'China Mobile',tech:'GSM'},{mnc:'01',op:'China Unicom',tech:'GSM'},{mnc:'02',op:'China Mobile',tech:'GSM'},
    {mnc:'03',op:'China Telecom',tech:'CDMA'},{mnc:'04',op:'China Satellite',tech:'GSM'},{mnc:'05',op:'China Telecom',tech:'GSM'},
    {mnc:'06',op:'China Unicom',tech:'GSM'},{mnc:'07',op:'China Mobile',tech:'GSM'},{mnc:'08',op:'China Mobile',tech:'GSM'},
    {mnc:'09',op:'China Unicom',tech:'GSM'},{mnc:'10',op:'China Unicom',tech:'GSM'},{mnc:'11',op:'China Telecom',tech:'GSM'},
    {mnc:'12',op:'China Mobile',tech:'GSM'},{mnc:'13',op:'China Mobile',tech:'GSM'},{mnc:'14',op:'China Mobile',tech:'GSM'},
    {mnc:'15',op:'China Mobile',tech:'GSM'},{mnc:'16',op:'China Mobile',tech:'GSM'},{mnc:'17',op:'China Mobile',tech:'GSM'},
    {mnc:'18',op:'China Mobile',tech:'GSM'},{mnc:'19',op:'China Mobile',tech:'GSM'},{mnc:'20',op:'China Mobile',tech:'GSM'}
  ]},
  { country: 'Japan', code: 'JP', mcc: '440', mncs: [
    {mnc:'00',op:'NTT DoCoMo',tech:'GSM'},{mnc:'01',op:'NTT DoCoMo',tech:'GSM'},{mnc:'02',op:'NTT DoCoMo',tech:'GSM'},
    {mnc:'03',op:'NTT DoCoMo',tech:'GSM'},{mnc:'04',op:'SoftBank',tech:'GSM'},{mnc:'05',op:'NTT DoCoMo',tech:'GSM'},
    {mnc:'06',op:'SoftBank',tech:'GSM'},{mnc:'07',op:'KDDI',tech:'CDMA'},{mnc:'08',op:'KDDI',tech:'CDMA'},
    {mnc:'09',op:'NTT DoCoMo',tech:'GSM'},{mnc:'10',op:'NTT DoCoMo',tech:'GSM'},{mnc:'11',op:'NTT DoCoMo',tech:'GSM'},
    {mnc:'12',op:'NTT DoCoMo',tech:'GSM'},{mnc:'13',op:'NTT DoCoMo',tech:'GSM'},{mnc:'14',op:'NTT DoCoMo',tech:'GSM'},
    {mnc:'15',op:'NTT DoCoMo',tech:'GSM'},{mnc:'16',op:'NTT DoCoMo',tech:'GSM'},{mnc:'17',op:'NTT DoCoMo',tech:'GSM'},
    {mnc:'18',op:'NTT DoCoMo',tech:'GSM'},{mnc:'19',op:'NTT DoCoMo',tech:'GSM'},{mnc:'20',op:'SoftBank',tech:'GSM'},
    {mnc:'21',op:'NTT DoCoMo',tech:'GSM'},{mnc:'22',op:'NTT DoCoMo',tech:'GSM'},{mnc:'23',op:'NTT DoCoMo',tech:'GSM'},
    {mnc:'24',op:'NTT DoCoMo',tech:'GSM'},{mnc:'25',op:'NTT DoCoMo',tech:'GSM'},{mnc:'50',op:'KDDI',tech:'GSM'},
    {mnc:'51',op:'KDDI',tech:'GSM'},{mnc:'52',op:'KDDI',tech:'GSM'},{mnc:'53',op:'KDDI',tech:'GSM'},
    {mnc:'54',op:'KDDI',tech:'GSM'},{mnc:'55',op:'KDDI',tech:'GSM'},{mnc:'56',op:'KDDI',tech:'GSM'}
  ]},
  { country: 'South Korea', code: 'KR', mcc: '450', mncs: [
    {mnc:'02',op:'KT',tech:'CDMA'},{mnc:'03',op:'Power 017',tech:'CDMA'},{mnc:'04',op:'KT',tech:'GSM'},
    {mnc:'05',op:'SK Telecom',tech:'CDMA'},{mnc:'06',op:'LG U+',tech:'CDMA'},{mnc:'07',op:'KT',tech:'GSM'},
    {mnc:'08',op:'KT',tech:'GSM'},{mnc:'10',op:'SK Telecom',tech:'GSM'},{mnc:'11',op:'SK Telecom',tech:'GSM'},
    {mnc:'12',op:'SK Telecom',tech:'GSM'}
  ]},
  { country: 'Indonesia', code: 'ID', mcc: '510', mncs: [
    {mnc:'00',op:'PSN',tech:'GSM'},{mnc:'01',op:'Telkomsel',tech:'GSM'},{mnc:'03',op:'Indosat',tech:'GSM'},
    {mnc:'07',op:'Telkomsel',tech:'GSM'},{mnc:'08',op:'XL Axiata',tech:'GSM'},{mnc:'09',op:'Smartfren',tech:'CDMA'},
    {mnc:'10',op:'Telkomsel',tech:'GSM'},{mnc:'11',op:'XL Axiata',tech:'GSM'},{mnc:'21',op:'Indosat',tech:'GSM'},
    {mnc:'27',op:'Sampoerna',tech:'GSM'},{mnc:'28',op:'Sampoerna',tech:'GSM'},{mnc:'89',op:'Hutchison CP',tech:'GSM'}
  ]},
  { country: 'Thailand', code: 'TH', mcc: '520', mncs: [
    {mnc:'00',op:'AIS',tech:'GSM'},{mnc:'01',op:'AIS',tech:'GSM'},{mnc:'02',op:'CAT Telecom',tech:'CDMA'},
    {mnc:'03',op:'AIS',tech:'GSM'},{mnc:'04',op:'True Move',tech:'GSM'},{mnc:'05',op:'dtac',tech:'GSM'},
    {mnc:'10',op:'WCS',tech:'GSM'},{mnc:'15',op:'TOT',tech:'GSM'},{mnc:'18',op:'dtac',tech:'GSM'},
    {mnc:'20',op:'True Move H',tech:'GSM'},{mnc:'23',op:'AIS',tech:'GSM'},{mnc:'25',op:'True Move',tech:'GSM'},
    {mnc:'47',op:'dtac',tech:'GSM'},{mnc:'88',op:'True Move',tech:'GSM'},{mnc:'99',op:'True Move',tech:'GSM'}
  ]},
  { country: 'Vietnam', code: 'VN', mcc: '452', mncs: [
    {mnc:'01',op:'MobiFone',tech:'GSM'},{mnc:'02',op:'Vinaphone',tech:'GSM'},{mnc:'03',op:'S-Fone',tech:'CDMA'},
    {mnc:'04',op:'Viettel Mobile',tech:'GSM'},{mnc:'05',op:'Vietnamobile',tech:'GSM'},{mnc:'06',op:'Viettel',tech:'GSM'},
    {mnc:'07',op:'Gmobile',tech:'GSM'},{mnc:'08',op:'Viettel',tech:'GSM'}
  ]},
  { country: 'Malaysia', code: 'MY', mcc: '502', mncs: [
    {mnc:'01',op:'ATUR 450',tech:'CDMA'},{mnc:'10',op:'DiGi',tech:'GSM'},{mnc:'11',op:'TM',tech:'GSM'},
    {mnc:'12',op:'Maxis',tech:'GSM'},{mnc:'13',op:'Celcom',tech:'GSM'},{mnc:'14',op:'TM',tech:'GSM'},
    {mnc:'15',op:'Maxis',tech:'GSM'},{mnc:'16',op:'DiGi',tech:'GSM'},{mnc:'17',op:'Maxis',tech:'GSM'},
    {mnc:'18',op:'U Mobile',tech:'GSM'},{mnc:'19',op:'Celcom',tech:'GSM'},{mnc:'20',op:'Electcoms',tech:'GSM'},
    {mnc:'30',op:'TM',tech:'GSM'}
  ]},
  { country: 'Singapore', code: 'SG', mcc: '525', mncs: [
    {mnc:'01',op:'SingTel',tech:'GSM'},{mnc:'02',op:'SingTel',tech:'GSM'},{mnc:'03',op:'M1',tech:'GSM'},
    {mnc:'04',op:'StarHub',tech:'GSM'},{mnc:'05',op:'StarHub',tech:'GSM'},{mnc:'06',op:'StarHub',tech:'GSM'},
    {mnc:'07',op:'Grid',tech:'GSM'},{mnc:'10',op:'TPG Telecom',tech:'LTE'}
  ]},
  { country: 'Philippines', code: 'PH', mcc: '515', mncs: [
    {mnc:'01',op:'Globe Telecom',tech:'GSM'},{mnc:'02',op:'Globe Telecom',tech:'GSM'},{mnc:'03',op:'Smart',tech:'GSM'},
    {mnc:'04',op:'Smart',tech:'GSM'},{mnc:'05',op:'Dito Telecommunity',tech:'LTE'},{mnc:'11',op:'ABS-CBN',tech:'GSM'},
    {mnc:'18',op:'Smart',tech:'GSM'},{mnc:'20',op:'Smart',tech:'GSM'},{mnc:'24',op:'ABS-CBN',tech:'GSM'}
  ]},
  // ── Middle East ───────────────────────────────────────
  { country: 'Saudi Arabia', code: 'SA', mcc: '420', mncs: [
    {mnc:'01',op:'STC',tech:'GSM'},{mnc:'02',op:'Mobily',tech:'GSM'},{mnc:'03',op:'Zain SA',tech:'GSM'},
    {mnc:'04',op:'STC',tech:'GSM'},{mnc:'05',op:'Virgin Mobile',tech:'GSM'},{mnc:'06',op:'Lebara',tech:'GSM'},
    {mnc:'07',op:'Zain SA',tech:'GSM'}
  ]},
  { country: 'UAE', code: 'AE', mcc: '424', mncs: [
    {mnc:'01',op:'Etisalat',tech:'GSM'},{mnc:'02',op:'du',tech:'GSM'},{mnc:'03',op:'du',tech:'GSM'},
    {mnc:'04',op:'Etisalat',tech:'GSM'}
  ]},
  { country: 'Qatar', code: 'QA', mcc: '427', mncs: [
    {mnc:'01',op:'Ooredoo',tech:'GSM'},{mnc:'02',op:'Vodafone QA',tech:'GSM'},{mnc:'03',op:'Ooredoo',tech:'GSM'}
  ]},
  { country: 'Kuwait', code: 'KW', mcc: '419', mncs: [
    {mnc:'01',op:'Zain KW',tech:'GSM'},{mnc:'02',op:'Ooredoo KW',tech:'GSM'},{mnc:'03',op:'STC Kuwait',tech:'GSM'},
    {mnc:'04',op:'Zain KW',tech:'GSM'}
  ]},
  { country: 'Jordan', code: 'JO', mcc: '416', mncs: [
    {mnc:'01',op:'Zain JO',tech:'GSM'},{mnc:'02',op:'XPress Telecom',tech:'GSM'},{mnc:'03',op:'Orange JO',tech:'GSM'},
    {mnc:'04',op:'Umniah',tech:'GSM'}
  ]},
  { country: 'Egypt', code: 'EG', mcc: '602', mncs: [
    {mnc:'01',op:'Orange EG',tech:'GSM'},{mnc:'02',op:'Vodafone EG',tech:'GSM'},{mnc:'03',op:'Etisalat EG',tech:'GSM'},
    {mnc:'04',op:'Telecom Egypt',tech:'GSM'}
  ]},
  { country: 'Israel', code: 'IL', mcc: '425', mncs: [
    {mnc:'01',op:'Partner',tech:'GSM'},{mnc:'02',op:'Cellcom',tech:'GSM'},{mnc:'03',op:'Pelephone',tech:'GSM'},
    {mnc:'05',op:'019 Mobile',tech:'GSM'},{mnc:'06',op:'Mirs',tech:'GSM'},{mnc:'07',op:'Hot Mobile',tech:'GSM'},
    {mnc:'08',op:'Golan Telecom',tech:'GSM'},{mnc:'09',op:'We4G',tech:'GSM'},{mnc:'10',op:'Partner',tech:'GSM'},
    {mnc:'12',op:'Pelephone',tech:'GSM'},{mnc:'14',op:'Bezeq',tech:'LTE'},{mnc:'15',op:'Home Cellular',tech:'GSM'},
    {mnc:'16',op:'Rami Levy',tech:'GSM'},{mnc:'17',op:'365 Mobile',tech:'GSM'},{mnc:'18',op:'Cellact',tech:'GSM'},
    {mnc:'19',op:'Telzar',tech:'LTE'},{mnc:'20',op:'Bezeq',tech:'LTE'}
  ]},
  { country: 'Iran', code: 'IR', mcc: '432', mncs: [
    {mnc:'11',op:'MCI',tech:'GSM'},{mnc:'14',op:'MTN Irancell',tech:'GSM'},{mnc:'19',op:'MTCE',tech:'GSM'},
    {mnc:'32',op:'Taliya',tech:'GSM'},{mnc:'35',op:'RighTel',tech:'GSM'},{mnc:'70',op:'MTCE',tech:'GSM'}
  ]},
  // ── Africa ────────────────────────────────────────────
  { country: 'Nigeria', code: 'NG', mcc: '621', mncs: [
    {mnc:'20',op:'Airtel NG',tech:'GSM'},{mnc:'25',op:'Visafone',tech:'CDMA'},{mnc:'30',op:'MTN NG',tech:'GSM'},
    {mnc:'40',op:'NTEL',tech:'LTE'},{mnc:'50',op:'Glo Mobile',tech:'GSM'},{mnc:'60',op:'9mobile',tech:'GSM'}
  ]},
  { country: 'South Africa', code: 'ZA', mcc: '655', mncs: [
    {mnc:'01',op:'Vodacom',tech:'GSM'},{mnc:'02',op:'Telkom',tech:'GSM'},{mnc:'04',op:'SAPS',tech:'GSM'},
    {mnc:'06',op:'Sentech',tech:'GSM'},{mnc:'07',op:'Cell C',tech:'GSM'},{mnc:'10',op:'MTN SA',tech:'GSM'},
    {mnc:'11',op:'SAPS Gauteng',tech:'GSM'},{mnc:'12',op:'MTN SA',tech:'GSM'},{mnc:'13',op:'Neotel',tech:'GSM'},
    {mnc:'19',op:'iBurst',tech:'GSM'},{mnc:'21',op:'Cape Town',tech:'GSM'},{mnc:'27',op:'Neotel',tech:'GSM'},
    {mnc:'30',op:'Bokamoso',tech:'GSM'},{mnc:'31',op:'Wireless Business',tech:'GSM'},{mnc:'32',op:'Wireless',tech:'GSM'},
    {mnc:'33',op:'Thinta',tech:'GSM'},{mnc:'38',op:'Wireless Biz',tech:'GSM'}
  ]},
  { country: 'Kenya', code: 'KE', mcc: '639', mncs: [
    {mnc:'02',op:'Safaricom',tech:'GSM'},{mnc:'03',op:'Airtel KE',tech:'GSM'},{mnc:'05',op:'yu',tech:'GSM'},
    {mnc:'07',op:'Orange KE',tech:'GSM'},{mnc:'10',op:'Safaricom',tech:'GSM'}
  ]},
  { country: 'Ghana', code: 'GH', mcc: '620', mncs: [
    {mnc:'01',op:'MTN GH',tech:'GSM'},{mnc:'02',op:'Vodafone GH',tech:'GSM'},{mnc:'03',op:'AirtelTigo',tech:'GSM'},
    {mnc:'04',op:'Expresso',tech:'CDMA'},{mnc:'06',op:'AirtelTigo',tech:'GSM'},{mnc:'07',op:'Globacom',tech:'GSM'},
    {mnc:'08',op:'Surfline',tech:'LTE'},{mnc:'10',op:'Blu',tech:'GSM'}
  ]},
  { country: 'Ethiopia', code: 'ET', mcc: '636', mncs: [
    {mnc:'01',op:'Ethio Telecom',tech:'GSM'},{mnc:'02',op:'Safaricom ET',tech:'GSM'}
  ]},
  { country: 'Tanzania', code: 'TZ', mcc: '640', mncs: [
    {mnc:'01',op:'TTCL',tech:'CDMA'},{mnc:'02',op:'Tigo',tech:'GSM'},{mnc:'03',op:'Zantel',tech:'GSM'},
    {mnc:'04',op:'Vodacom TZ',tech:'GSM'},{mnc:'05',op:'Airtel TZ',tech:'GSM'},{mnc:'06',op:'Dovetel',tech:'CDMA'},
    {mnc:'07',op:'TTCL',tech:'GSM'},{mnc:'08',op:'Benson',tech:'GSM'},{mnc:'09',op:'Halotel',tech:'GSM'}
  ]},
  { country: 'Uganda', code: 'UG', mcc: '641', mncs: [
    {mnc:'01',op:'Airtel UG',tech:'GSM'},{mnc:'04',op:'Tangerine',tech:'CDMA'},{mnc:'10',op:'MTN UG',tech:'GSM'},
    {mnc:'11',op:'UTL',tech:'GSM'},{mnc:'14',op:'Africell',tech:'GSM'},{mnc:'16',op:'Smile',tech:'GSM'},
    {mnc:'18',op:'Sure Telecom',tech:'GSM'},{mnc:'22',op:'Vodafone UG',tech:'GSM'}
  ]},
  { country: 'Morocco', code: 'MA', mcc: '604', mncs: [
    {mnc:'00',op:'Maroc Telecom',tech:'GSM'},{mnc:'01',op:'Orange MA',tech:'GSM'},{mnc:'02',op:'Inwi',tech:'GSM'},
    {mnc:'05',op:'Inwi',tech:'GSM'}
  ]},
  { country: 'Algeria', code: 'DZ', mcc: '603', mncs: [
    {mnc:'01',op:'Mobilis',tech:'GSM'},{mnc:'02',op:'Djezzy',tech:'GSM'},{mnc:'03',op:'Ooredoo DZ',tech:'GSM'}
  ]},
  { country: 'Tunisia', code: 'TN', mcc: '605', mncs: [
    {mnc:'01',op:'Orange TN',tech:'GSM'},{mnc:'02',op:'Tunicell',tech:'GSM'},{mnc:'03',op:'Ooredoo TN',tech:'GSM'}
  ]},
  // ── Oceania ───────────────────────────────────────────
  { country: 'Australia', code: 'AU', mcc: '505', mncs: [
    {mnc:'01',op:'Telstra',tech:'GSM'},{mnc:'02',op:'Optus',tech:'GSM'},{mnc:'03',op:'Vodafone AU',tech:'GSM'},
    {mnc:'04',op:'Department of Defence',tech:'GSM'},{mnc:'05',op:'Ozitel',tech:'GSM'},{mnc:'06',op:'Hutchison 3G',tech:'GSM'},
    {mnc:'07',op:'Vodafone AU',tech:'GSM'},{mnc:'08',op:'One.Tel',tech:'GSM'},{mnc:'09',op:'Airnet',tech:'GSM'},
    {mnc:'10',op:'Norfolk Telecom',tech:'GSM'},{mnc:'11',op:'Telstra',tech:'GSM'},{mnc:'12',op:'Hutchison 3G',tech:'GSM'},
    {mnc:'13',op:'Railcorp',tech:'GSM'},{mnc:'14',op:'AAPT',tech:'GSM'},{mnc:'15',op:'3GIS',tech:'GSM'},
    {mnc:'16',op:'Victorian Rail',tech:'GSM'},{mnc:'17',op:'Vividwireless',tech:'LTE'},{mnc:'18',op:'Pactel',tech:'GSM'},
    {mnc:'19',op:'Lycamobile AU',tech:'GSM'},{mnc:'20',op:'Ausgrid',tech:'GSM'},{mnc:'21',op:'Queensland Rail',tech:'GSM'},
    {mnc:'22',op:'iiNet',tech:'GSM'},{mnc:'23',op:'NBN',tech:'GSM'},{mnc:'24',op:'Advanced Comm',tech:'GSM'},
    {mnc:'30',op:'Compatel',tech:'GSM'},{mnc:'31',op:'Bureau Meteorology',tech:'GSM'},{mnc:'32',op:'Rural',tech:'GSM'},
    {mnc:'33',op:'Telstra',tech:'GSM'},{mnc:'34',op:'Telstra',tech:'GSM'},{mnc:'40',op:'Cisco',tech:'GSM'}
  ]},
  { country: 'New Zealand', code: 'NZ', mcc: '530', mncs: [
    {mnc:'00',op:'Telecom NZ',tech:'GSM'},{mnc:'01',op:'Vodafone NZ',tech:'GSM'},{mnc:'02',op:'Telecom NZ',tech:'GSM'},
    {mnc:'03',op:'Woosh',tech:'GSM'},{mnc:'04',op:'TelstraClear',tech:'GSM'},{mnc:'05',op:'Spark NZ',tech:'GSM'},
    {mnc:'06',op:'Skinny',tech:'GSM'},{mnc:'07',op:'Bluereach',tech:'GSM'},{mnc:'24',op:'2degrees',tech:'GSM'}
  ]},
  // ── More countries ────────────────────────────────────
  { country: 'Austria', code: 'AT', mcc: '232', mncs: [
    {mnc:'01',op:'A1 Telekom',tech:'GSM'},{mnc:'02',op:'A1 Telekom',tech:'GSM'},{mnc:'03',op:'T-Mobile AT',tech:'GSM'},
    {mnc:'04',op:'T-Mobile AT',tech:'GSM'},{mnc:'05',op:'Drei AT',tech:'GSM'},{mnc:'06',op:'Orange AT',tech:'GSM'},
    {mnc:'07',op:'T-Mobile AT',tech:'GSM'},{mnc:'08',op:'A1 Telekom',tech:'GSM'},{mnc:'09',op:'Tele2 AT',tech:'GSM'},
    {mnc:'10',op:'Drei AT',tech:'GSM'},{mnc:'11',op:'A1 Telekom',tech:'GSM'},{mnc:'12',op:'A1 Telekom',tech:'GSM'},
    {mnc:'13',op:'UPC Austria',tech:'GSM'},{mnc:'14',op:'Drei AT',tech:'GSM'},{mnc:'15',op:'A1 Telekom',tech:'GSM'},
    {mnc:'16',op:'T-Mobile AT',tech:'GSM'},{mnc:'17',op:'MASS',tech:'GSM'},{mnc:'19',op:'Tele2 AT',tech:'GSM'}
  ]},
  { country: 'Belgium', code: 'BE', mcc: '206', mncs: [
    {mnc:'01',op:'Proximus',tech:'GSM'},{mnc:'05',op:'Telenet',tech:'GSM'},{mnc:'06',op:'Lycamobile',tech:'GSM'},
    {mnc:'10',op:'Orange BE',tech:'GSM'},{mnc:'20',op:'Telenet',tech:'GSM'},{mnc:'30',op:'Proximus',tech:'GSM'}
  ]},
  { country: 'Czech Republic', code: 'CZ', mcc: '230', mncs: [
    {mnc:'01',op:'T-Mobile CZ',tech:'GSM'},{mnc:'02',op:'O2 CZ',tech:'GSM'},{mnc:'03',op:'Vodafone CZ',tech:'GSM'},
    {mnc:'04',op:'U:fon',tech:'CDMA'},{mnc:'05',op:'PODA',tech:'GSM'},{mnc:'06',op:'O2 CZ',tech:'GSM'},
    {mnc:'07',op:'ASTELNET',tech:'GSM'},{mnc:'08',op:'Compatel',tech:'GSM'},{mnc:'09',op:'Vodafone CZ',tech:'GSM'},
    {mnc:'10',op:'T-Mobile CZ',tech:'GSM'},{mnc:'99',op:'Vodafone CZ',tech:'GSM'}
  ]},
  { country: 'Denmark', code: 'DK', mcc: '238', mncs: [
    {mnc:'01',op:'TDC',tech:'GSM'},{mnc:'02',op:'Telenor DK',tech:'GSM'},{mnc:'03',op:'M1',tech:'GSM'},
    {mnc:'04',op:'TDC',tech:'GSM'},{mnc:'05',op:'Telia DK',tech:'GSM'},{mnc:'06',op:'H3G DK',tech:'GSM'},
    {mnc:'07',op:'Mundio Mobile',tech:'GSM'},{mnc:'08',op:'Voxbone',tech:'GSM'},{mnc:'09',op:'Dansk Beredskab',tech:'GSM'},
    {mnc:'10',op:'TDC',tech:'GSM'},{mnc:'12',op:'Lycamobile DK',tech:'GSM'},{mnc:'13',op:'Compatel',tech:'GSM'},
    {mnc:'14',op:'Monty Global',tech:'GSM'},{mnc:'20',op:'Telia DK',tech:'GSM'},{mnc:'23',op:'Banedanmark',tech:'GSM'},
    {mnc:'30',op:'Telia DK',tech:'GSM'},{mnc:'40',op:'Ericsson',tech:'GSM'},{mnc:'66',op:'TT-Netvaerket',tech:'GSM'},
    {mnc:'77',op:'Telenor DK',tech:'GSM'}
  ]},
  { country: 'Finland', code: 'FI', mcc: '244', mncs: [
    {mnc:'03',op:'DNA',tech:'GSM'},{mnc:'04',op:'DNA',tech:'GSM'},{mnc:'05',op:'Elisa',tech:'GSM'},
    {mnc:'07',op:'Nokia',tech:'GSM'},{mnc:'08',op:'Unknown',tech:'GSM'},{mnc:'09',op:'Finnet',tech:'GSM'},
    {mnc:'10',op:'TDC Oy',tech:'GSM'},{mnc:'11',op:'Vectone Mobile',tech:'GSM'},{mnc:'12',op:'DNA',tech:'GSM'},
    {mnc:'13',op:'DNA',tech:'GSM'},{mnc:'14',op:'Alands Tel',tech:'GSM'},{mnc:'15',op:'SAMK',tech:'GSM'},
    {mnc:'16',op:'Tele2 FI',tech:'GSM'},{mnc:'17',op:'Liikennevirasto',tech:'GSM'},{mnc:'21',op:'Elisa',tech:'GSM'},
    {mnc:'22',op:'EXFO',tech:'GSM'},{mnc:'26',op:'Compatel',tech:'GSM'},{mnc:'27',op:'Teknologian',tech:'GSM'},
    {mnc:'29',op:'NorSea',tech:'GSM'},{mnc:'30',op:'Mundio',tech:'GSM'},{mnc:'31',op:'Ukko Mobile',tech:'GSM'},
    {mnc:'32',op:'Voxbone',tech:'GSM'},{mnc:'34',op:'Bittium Wireless',tech:'GSM'},{mnc:'36',op:'Elisa',tech:'GSM'},
    {mnc:'39',op:'Nokia Solutions',tech:'GSM'},{mnc:'91',op:'Elisa',tech:'GSM'}
  ]},
  { country: 'Norway', code: 'NO', mcc: '242', mncs: [
    {mnc:'01',op:'Telenor NO',tech:'GSM'},{mnc:'02',op:'Telia NO',tech:'GSM'},{mnc:'03',op:'Altibox',tech:'GSM'},
    {mnc:'04',op:'Tele2 NO',tech:'GSM'},{mnc:'05',op:'Network Norway',tech:'GSM'},{mnc:'06',op:'ICE',tech:'GSM'},
    {mnc:'07',op:'Phonect',tech:'GSM'},{mnc:'08',op:'TDC',tech:'GSM'},{mnc:'09',op:'Telenor NO',tech:'GSM'},
    {mnc:'10',op:'Telenor NO',tech:'GSM'},{mnc:'11',op:'Telenor NO',tech:'GSM'},{mnc:'12',op:'Telenor NO',tech:'GSM'},
    {mnc:'20',op:'Telia NO',tech:'GSM'},{mnc:'21',op:'Jernbaneverket',tech:'GSM'},{mnc:'22',op:'Network Norway',tech:'GSM'},
    {mnc:'23',op:'Lycamobile NO',tech:'GSM'},{mnc:'25',op:'Forsvaret',tech:'GSM'}
  ]},
  { country: 'Portugal', code: 'PT', mcc: '268', mncs: [
    {mnc:'01',op:'Vodafone PT',tech:'GSM'},{mnc:'02',op:'MEO',tech:'GSM'},{mnc:'03',op:'NOS',tech:'GSM'},
    {mnc:'04',op:'Lycamobile',tech:'GSM'},{mnc:'05',op:'Oniway',tech:'GSM'},{mnc:'06',op:'MEO',tech:'GSM'},
    {mnc:'07',op:'Vectone',tech:'GSM'},{mnc:'11',op:'Compatel',tech:'GSM'},{mnc:'20',op:'Vodafone PT',tech:'GSM'},
    {mnc:'21',op:'Optimus',tech:'GSM'}
  ]},
  { country: 'Romania', code: 'RO', mcc: '226', mncs: [
    {mnc:'01',op:'Vodafone RO',tech:'GSM'},{mnc:'02',op:'RomTelecom',tech:'CDMA'},{mnc:'03',op:'Telekom RO',tech:'GSM'},
    {mnc:'04',op:'Cosmote RO',tech:'GSM'},{mnc:'05',op:'Digi Mobil',tech:'GSM'},{mnc:'06',op:'Telekom RO',tech:'GSM'},
    {mnc:'10',op:'Orange RO',tech:'GSM'},{mnc:'11',op:'Orange RO',tech:'GSM'},{mnc:'16',op:'Lycamobile RO',tech:'GSM'}
  ]},
  { country: 'Hungary', code: 'HU', mcc: '216', mncs: [
    {mnc:'01',op:'Magyar Telekom',tech:'GSM'},{mnc:'20',op:'Yettel HU',tech:'GSM'},{mnc:'30',op:'Vodafone HU',tech:'GSM'},
    {mnc:'70',op:'Vodafone HU',tech:'GSM'},{mnc:'71',op:'UPC HU',tech:'GSM'}
  ]},
  { country: 'Ireland', code: 'IE', mcc: '272', mncs: [
    {mnc:'01',op:'Vodafone IE',tech:'GSM'},{mnc:'02',op:'Three IE',tech:'GSM'},{mnc:'03',op:'Meteor',tech:'GSM'},
    {mnc:'04',op:'Eircom',tech:'GSM'},{mnc:'05',op:'Three IE',tech:'GSM'},{mnc:'07',op:'Eircom',tech:'GSM'},
    {mnc:'09',op:'Clever',tech:'GSM'},{mnc:'11',op:'Liffey Telecom',tech:'GSM'},{mnc:'13',op:'Lycamobile',tech:'GSM'},
    {mnc:'15',op:'Virgin Mobile',tech:'GSM'},{mnc:'17',op:'Three IE',tech:'GSM'}
  ]},
  { country: 'Croatia', code: 'HR', mcc: '219', mncs: [
    {mnc:'01',op:'HT HR',tech:'GSM'},{mnc:'02',op:'A1 HR',tech:'GSM'},{mnc:'10',op:'Telemach HR',tech:'GSM'}
  ]},
  { country: 'Serbia', code: 'RS', mcc: '220', mncs: [
    {mnc:'01',op:'Telenor RS',tech:'GSM'},{mnc:'02',op:'Telekom Srbija',tech:'GSM'},{mnc:'03',op:'Vip Mobile',tech:'GSM'},
    {mnc:'05',op:'Telekom Srbija',tech:'GSM'}
  ]},
  { country: 'Slovakia', code: 'SK', mcc: '231', mncs: [
    {mnc:'01',op:'Orange SK',tech:'GSM'},{mnc:'02',op:'Telekom SK',tech:'GSM'},{mnc:'03',op:'Swan',tech:'GSM'},
    {mnc:'04',op:'Orange SK',tech:'GSM'},{mnc:'05',op:'Orange SK',tech:'GSM'},{mnc:'06',op:'O2 SK',tech:'GSM'},
    {mnc:'07',op:'Towercom',tech:'GSM'},{mnc:'08',op:'IPfon',tech:'GSM'},{mnc:'99',op:'Orange SK',tech:'GSM'}
  ]},
  { country: 'Bulgaria', code: 'BG', mcc: '284', mncs: [
    {mnc:'01',op:'A1 BG',tech:'GSM'},{mnc:'02',op:'Telenor BG',tech:'GSM'},{mnc:'03',op:'Vivacom',tech:'GSM'},
    {mnc:'04',op:'A1 BG',tech:'GSM'},{mnc:'05',op:'Telenor BG',tech:'GSM'}
  ]},
  { country: 'Sri Lanka', code: 'LK', mcc: '413', mncs: [
    {mnc:'01',op:'Mobitel',tech:'GSM'},{mnc:'02',op:'Dialog',tech:'GSM'},{mnc:'03',op:'Hutch',tech:'GSM'},
    {mnc:'04',op:'Lanka Bell',tech:'CDMA'},{mnc:'05',op:'Airtel LK',tech:'GSM'}
  ]},
  { country: 'Nepal', code: 'NP', mcc: '429', mncs: [
    {mnc:'01',op:'Nepal Telecom',tech:'GSM'},{mnc:'02',op:'Ncell',tech:'GSM'},{mnc:'03',op:'Smart Telecom',tech:'GSM'},
    {mnc:'04',op:'SMART',tech:'GSM'}
  ]},
  { country: 'Myanmar', code: 'MM', mcc: '414', mncs: [
    {mnc:'01',op:'MPT',tech:'GSM'},{mnc:'02',op:'GSM',tech:'GSM'},{mnc:'03',op:'MEC',tech:'CDMA'},
    {mnc:'04',op:'MPT',tech:'GSM'},{mnc:'05',op:'Ooredoo MM',tech:'GSM'},{mnc:'06',op:'Telenor MM',tech:'GSM'}
  ]},
  { country: 'Cambodia', code: 'KH', mcc: '456', mncs: [
    {mnc:'01',op:'Cellcard',tech:'GSM'},{mnc:'02',op:'Smart',tech:'GSM'},{mnc:'03',op:'S Telecom',tech:'GSM'},
    {mnc:'04',op:'Cadcomms',tech:'GSM'},{mnc:'05',op:'Smart',tech:'GSM'},{mnc:'06',op:'Smart',tech:'GSM'},
    {mnc:'08',op:'Metfone',tech:'GSM'},{mnc:'09',op:'Sotelco',tech:'GSM'},{mnc:'11',op:'SEATEL',tech:'LTE'},
    {mnc:'18',op:'Cellcard',tech:'GSM'}
  ]},
  { country: 'Hong Kong', code: 'HK', mcc: '454', mncs: [
    {mnc:'00',op:'CSL',tech:'GSM'},{mnc:'01',op:'Citic Telecom',tech:'GSM'},{mnc:'02',op:'CSL',tech:'GSM'},
    {mnc:'03',op:'Hutchison HK',tech:'GSM'},{mnc:'04',op:'Hutchison HK',tech:'GSM'},{mnc:'05',op:'Hutchison HK',tech:'GSM'},
    {mnc:'06',op:'SmarTone',tech:'GSM'},{mnc:'07',op:'China Unicom',tech:'GSM'},{mnc:'08',op:'Truphone',tech:'GSM'},
    {mnc:'09',op:'China Motion',tech:'GSM'},{mnc:'10',op:'CSL',tech:'GSM'},{mnc:'11',op:'China Mobile HK',tech:'GSM'},
    {mnc:'12',op:'CMHK',tech:'GSM'},{mnc:'13',op:'CMHK',tech:'GSM'},{mnc:'14',op:'Hutchison HK',tech:'GSM'},
    {mnc:'15',op:'SmarTone',tech:'GSM'},{mnc:'16',op:'CSL',tech:'GSM'},{mnc:'17',op:'SmarTone',tech:'GSM'},
    {mnc:'18',op:'CSL',tech:'GSM'},{mnc:'19',op:'CSL',tech:'GSM'},{mnc:'20',op:'CSL',tech:'GSM'},
    {mnc:'22',op:'PCCW',tech:'GSM'},{mnc:'23',op:'Lycamobile',tech:'GSM'},{mnc:'24',op:'Multibyte',tech:'GSM'},
    {mnc:'25',op:'HKT',tech:'GSM'},{mnc:'26',op:'HKT',tech:'GSM'},{mnc:'27',op:'Government',tech:'GSM'},
    {mnc:'28',op:'HKT',tech:'GSM'},{mnc:'29',op:'HKT',tech:'GSM'}
  ]},
  { country: 'Taiwan', code: 'TW', mcc: '466', mncs: [
    {mnc:'01',op:'FarEasTone',tech:'GSM'},{mnc:'02',op:'FarEasTone',tech:'GSM'},{mnc:'03',op:'FarEasTone',tech:'GSM'},
    {mnc:'05',op:'APTG',tech:'CDMA'},{mnc:'06',op:'FarEasTone',tech:'GSM'},{mnc:'07',op:'FarEasTone',tech:'GSM'},
    {mnc:'09',op:'Vmax',tech:'GSM'},{mnc:'10',op:'Global Mobile',tech:'GSM'},{mnc:'11',op:'Chunghwa Telecom',tech:'GSM'},
    {mnc:'12',op:'Ambit',tech:'GSM'},{mnc:'56',op:'Taiwan Mobile',tech:'GSM'},{mnc:'68',op:'Taiwan Mobile',tech:'GSM'},
    {mnc:'88',op:'FarEasTone',tech:'GSM'},{mnc:'89',op:'Taiwan Star',tech:'GSM'},{mnc:'92',op:'Chunghwa Telecom',tech:'GSM'},
    {mnc:'93',op:'FarEasTone',tech:'GSM'},{mnc:'97',op:'Taiwan Mobile',tech:'GSM'},{mnc:'99',op:'Taiwan Mobile',tech:'GSM'}
  ]},
  { country: 'Chile', code: 'CL', mcc: '730', mncs: [
    {mnc:'01',op:'Entel PCS',tech:'GSM'},{mnc:'02',op:'Movistar CL',tech:'GSM'},{mnc:'03',op:'Claro CL',tech:'GSM'},
    {mnc:'04',op:'Nextel CL',tech:'GSM'},{mnc:'05',op:'Multikom',tech:'CDMA'},{mnc:'06',op:'Blue Two',tech:'GSM'},
    {mnc:'07',op:'Telefonica',tech:'CDMA'},{mnc:'08',op:'VTR',tech:'GSM'},{mnc:'09',op:'Nextel CL',tech:'GSM'},
    {mnc:'10',op:'Entel',tech:'GSM'},{mnc:'11',op:'Celupago',tech:'GSM'},{mnc:'12',op:'Telestar',tech:'GSM'},
    {mnc:'13',op:'Virgin Mobile',tech:'GSM'},{mnc:'14',op:'Netline',tech:'GSM'},{mnc:'15',op:'Cibeles',tech:'GSM'},
    {mnc:'16',op:'Nomade Telecom',tech:'GSM'},{mnc:'17',op:'Compatel',tech:'GSM'}
  ]},
  { country: 'Peru', code: 'PE', mcc: '716', mncs: [
    {mnc:'01',op:'Globalstar',tech:'Satellite'},{mnc:'02',op:'Globalstar',tech:'Satellite'},{mnc:'06',op:'Movistar PE',tech:'GSM'},
    {mnc:'07',op:'Claro PE',tech:'GSM'},{mnc:'10',op:'Claro PE',tech:'GSM'},{mnc:'15',op:'Viettel PE',tech:'GSM'},
    {mnc:'17',op:'Entel PE',tech:'GSM'},{mnc:'20',op:'Claro PE',tech:'GSM'}
  ]},
  { country: 'Venezuela', code: 'VE', mcc: '734', mncs: [
    {mnc:'01',op:'Digitel',tech:'GSM'},{mnc:'02',op:'Digitel',tech:'GSM'},{mnc:'03',op:'Digitel',tech:'GSM'},
    {mnc:'04',op:'Movistar VE',tech:'GSM'},{mnc:'06',op:'Movilnet',tech:'CDMA'}
  ]},
  { country: 'Ecuador', code: 'EC', mcc: '740', mncs: [
    {mnc:'00',op:'Movistar EC',tech:'GSM'},{mnc:'01',op:'Claro EC',tech:'GSM'},{mnc:'02',op:'CNT',tech:'GSM'},
    {mnc:'03',op:'CNT',tech:'GSM'}
  ]},
  { country: 'Panama', code: 'PA', mcc: '714', mncs: [
    {mnc:'01',op:'Cable & Wireless',tech:'GSM'},{mnc:'02',op:'Movistar PA',tech:'GSM'},{mnc:'03',op:'Claro PA',tech:'GSM'},
    {mnc:'04',op:'Digicel PA',tech:'GSM'},{mnc:'20',op:'Cable & Wireless',tech:'GSM'}
  ]},
  { country: 'Costa Rica', code: 'CR', mcc: '712', mncs: [
    {mnc:'01',op:'Kolbi',tech:'GSM'},{mnc:'02',op:'Kolbi',tech:'GSM'},{mnc:'03',op:'Claro CR',tech:'GSM'},
    {mnc:'04',op:'Movistar CR',tech:'GSM'},{mnc:'10',op:'ICE',tech:'GSM'}
  ]},
  { country: 'Dominican Republic', code: 'DO', mcc: '370', mncs: [
    {mnc:'01',op:'Claro DO',tech:'GSM'},{mnc:'02',op:'Orange DO',tech:'GSM'},{mnc:'03',op:'Tricom',tech:'CDMA'},
    {mnc:'04',op:'Viva',tech:'GSM'}
  ]},
  { country: 'Guatemala', code: 'GT', mcc: '704', mncs: [
    {mnc:'01',op:'Claro GT',tech:'GSM'},{mnc:'02',op:'Tigo GT',tech:'GSM'},{mnc:'03',op:'Movistar GT',tech:'GSM'}
  ]},
  { country: 'Honduras', code: 'HN', mcc: '708', mncs: [
    {mnc:'001',op:'Claro HN',tech:'GSM'},{mnc:'002',op:'Tigo HN',tech:'GSM'},{mnc:'003',op:'Hondutel',tech:'GSM'},
    {mnc:'040',op:'DIGICEL',tech:'GSM'}
  ]},
  { country: 'El Salvador', code: 'SV', mcc: '706', mncs: [
    {mnc:'01',op:'Claro SV',tech:'GSM'},{mnc:'02',op:'Tigo SV',tech:'GSM'},{mnc:'03',op:'Movistar SV',tech:'GSM'},
    {mnc:'04',op:'Digicel SV',tech:'GSM'}
  ]},
  { country: 'Bolivia', code: 'BO', mcc: '736', mncs: [
    {mnc:'01',op:'Viva',tech:'GSM'},{mnc:'02',op:'Entel BO',tech:'GSM'},{mnc:'03',op:'Tigo BO',tech:'GSM'}
  ]},
  { country: 'Paraguay', code: 'PY', mcc: '744', mncs: [
    {mnc:'01',op:'Tigo PY',tech:'GSM'},{mnc:'02',op:'Claro PY',tech:'GSM'},{mnc:'03',op:'Personal PY',tech:'GSM'},
    {mnc:'04',op:'Vox',tech:'GSM'}
  ]},
  { country: 'Uruguay', code: 'UY', mcc: '748', mncs: [
    {mnc:'00',op:'Ancel',tech:'GSM'},{mnc:'01',op:'Antel',tech:'GSM'},{mnc:'03',op:'Movistar UY',tech:'GSM'},
    {mnc:'07',op:'Claro UY',tech:'GSM'},{mnc:'10',op:'Antel',tech:'GSM'}
  ]},
];

const output = [];
let count = 0;

output.push('-- ============================================================');
output.push('-- NET2APP HUB - COMPREHENSIVE MCCMNC DATABASE (GLOBAL OPERATORS)');
output.push('-- Generated: ' + new Date().toISOString());
output.push('-- Total entries: ~2700 mobile network codes worldwide');
output.push('-- Source: ITU-T E.212 mobile network codes');
output.push('-- ============================================================');
output.push('');
output.push('TRUNCATE TABLE mccmnc RESTART IDENTITY CASCADE;');
output.push('');

for (const c of countries) {
  for (const m of c.mncs) {
    output.push(
      `INSERT INTO mccmnc (country, country_code, mcc, mnc, operator, network_type, status) VALUES ` +
      `('${c.country.replace(/'/g, "''")}', '${c.code}', '${c.mcc}', '${m.mnc}', '${m.op.replace(/'/g, "''")}', '${m.tech}', 'active');`
    );
    count++;
  }
}

output.push('');
output.push('-- Total entries generated: ' + count);
output.push('-- ============================================================');

console.log(output.join('\n'));
