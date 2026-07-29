import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Search, Trash2, Play, Upload, Globe, Phone, RefreshCw,
  Server, Loader, Hash, Mic, Save, Edit, Wifi, WifiOff,
  Filter, Activity, Clock, AlertCircle, Music
} from 'lucide-react';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Badge } from '../../components/UI/Badge';
import { Modal } from '../../components/UI/Modal';
import { Input, Select } from '../../components/UI/Input';
import { api } from '../../services/api';

// =====================================================================
// DEDUPLICATED LANGUAGE PRESET (~25 unique languages)
// =====================================================================
const LI_LANGUAGES = [
  { code:'en', tts_code:'en', display:'English',        greeting:'Hello, your verification code is',            retry:'I repeat, your code is' },
  { code:'ar', tts_code:'ar', display:'Arabic',         greeting:'مرحبا. رمز التحقق الخاص بك هو', retry:'أكرر، رمزك هو' },
  { code:'es', tts_code:'es', display:'Spanish',        greeting:'Hola. Su código de verificación es', retry:'Repito, su código es' },
  { code:'fr', tts_code:'fr', display:'French',          greeting:'Bonjour. Votre code de vérification est', retry:'Je répète, votre code est' },
  { code:'de', tts_code:'de', display:'German',          greeting:'Hallo. Ihr Bestätigungscode lautet',      retry:'Ich wiederhole, Ihr Code lautet' },
  { code:'it', tts_code:'it', display:'Italian',         greeting:'Salve. Il suo codice di verifica è',      retry:'Ripeto, il suo codice è' },
  { code:'pt', tts_code:'pt', display:'Portuguese',     greeting:'Olá. Seu código de verificação é', retry:'Repito, seu código é' },
  { code:'ru', tts_code:'ru', display:'Russian',         greeting:'Здравствуйте. Ваш код подтверждения:',       retry:'Повторяю, ваш код:' },
  { code:'zh', tts_code:'zh', display:'Chinese',         greeting:'您好，您的验证码是',           retry:'重复一遍，您的验证码是' },
  { code:'ja', tts_code:'ja', display:'Japanese',        greeting:'こんにちは。確認コードは', retry:'繰り返し、確認コードは' },
  { code:'ko', tts_code:'ko', display:'Korean',          greeting:'안녕하세요. 인증 번호는',        retry:'다시 말씀드리면, 인증 번호는' },
  { code:'hi', tts_code:'hi', display:'Hindi',           greeting:'नमस्ते। आपका सत्यापन कोड है', retry:'दोहराता हूँ, आपका कोड है' },
  { code:'bn', tts_code:'bn', display:'Bengali',         greeting:'নমস্কার। আপনার যাচাইকরণ কোড হল', retry:'আবার বলছি, আপনার কোড হল' },
  { code:'ur', tts_code:'ur', display:'Urdu',            greeting:'ہیلو۔ آپ کا تصدیقی کوڈ ہے', retry:'دہراتا ہوں، آپ کا کوڈ ہے' },
  { code:'fa', tts_code:'fa', display:'Persian',         greeting:'سلام. کد تأیید شما', retry:'تکرار می‌کنم، کد شما' },
  { code:'tr', tts_code:'tr', display:'Turkish',         greeting:'Merhaba. Doğrulama kodunuz',              retry:'Tekrar ediyorum, kodunuz' },
  { code:'nl', tts_code:'nl', display:'Dutch',           greeting:'Hallo. Uw verificatiecode is',               retry:'Ik herhaal, uw code is' },
  { code:'pl', tts_code:'pl', display:'Polish',          greeting:'Dzień dobry. Twój kod weryfikacyjny to', retry:'Powtarzam, twój kod to' },
  { code:'sv', tts_code:'sv', display:'Swedish',         greeting:'Hej. Din verifieringskod är',            retry:'Jag upprepar, din kod är' },
  { code:'th', tts_code:'th', display:'Thai',            greeting:'สวัสดี รหัสยืนยันของคุณคือ', retry:'ขอย้ำอีกครั้ง รหัสของคุณคือ' },
  { code:'vi', tts_code:'vi', display:'Vietnamese',      greeting:'Xin chào. Mã xác minh của bạn là', retry:'Tôi nhắc lại, mã của bạn là' },
  { code:'id', tts_code:'id', display:'Indonesian',      greeting:'Halo. Kode verifikasi Anda adalah',          retry:'Saya ulangi, kode Anda' },
  { code:'ms', tts_code:'ms', display:'Malay',           greeting:'Halo. Kod pengesahan anda ialah',           retry:'Saya ulang, kod anda' },
  { code:'fil',tts_code:'en', display:'Filipino',        greeting:'Hello. Ang verification code mo ay',        retry:'Ulitin ko, ang code mo ay' },
  { code:'uk', tts_code:'uk', display:'Ukrainian',       greeting:'Доброго дня. Ваш код підтвердження:',        retry:'Повторюю, ваш код:' },
  { code:'he', tts_code:'he', display:'Hebrew',          greeting:'שלום. קוד האימות שלך הוא', retry:'אני חוזר, הקוד שלך הוא' },
  { code:'km', tts_code:'km', display:'Khmer (Cambodia)',greeting:'ជម្រាបសួរ។ លេខបញ្ជាក់ការផ្ទាក់បញ្ជាក់របស់អ្នកគឺ', retry:'ខ្ញុំនិយាយម្ដងទៀត, លេខបញ្ជាក់របស់អ្នកគឺ' },
  { code:'my', tts_code:'my', display:'Burmese (Myanmar)',greeting:'မင်္ဂလာပါ။ သင့်ရဲ့ အတည်ကုန်နမူနာကုန်မှာ', retry:'ထပ်မံလှက္ပါတယ်၊ သင့်ရဲ့ နမူနာကုန်မှာ' },
  { code:'uz', tts_code:'uz', display:'Uzbek',           greeting:'Salom. Tasdiqlash kodingiz',               retry:'Takrorlayman, kodingiz' },
];

// =====================================================================
// DEFAULT COUNTRY GROUPS (seeded when empty, 2nd language optional=none)
// =====================================================================
const DEFAULT_GROUPS = [
  { name:'English (Default)',  country_prefix:'+1,+44,+61,+64,+353,+27,+234,+254,+63', primary_language_code:'en', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Arabic Countries',   country_prefix:'+971,+966,+968,+974,+973,+965,+962,+967,+963,+961,+20,+218,+216,+213,+212,+249,+973', primary_language_code:'ar', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Spain & Latin America', country_prefix:'+34,+52,+54,+57,+56,+51,+58,+593,+591,+595,+598,+502,+503,+504,+505,+506,+507', primary_language_code:'es', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Bangladesh',         country_prefix:'+880', primary_language_code:'bn', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'India',              country_prefix:'+91', primary_language_code:'hi', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Pakistan',           country_prefix:'+92', primary_language_code:'ur', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Russia',             country_prefix:'+7', primary_language_code:'ru', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Germany',            country_prefix:'+49,+43,+41', primary_language_code:'de', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'France',             country_prefix:'+33,+32', primary_language_code:'fr', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Japan',              country_prefix:'+81', primary_language_code:'ja', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Korea',              country_prefix:'+82', primary_language_code:'ko', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'China',              country_prefix:'+86,+852,+853,+886', primary_language_code:'zh', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Thailand',           country_prefix:'+66', primary_language_code:'th', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Vietnam',            country_prefix:'+84', primary_language_code:'vi', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Indonesia',          country_prefix:'+62', primary_language_code:'id', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Malaysia',           country_prefix:'+60', primary_language_code:'ms', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Philippines',        country_prefix:'+63', primary_language_code:'fil', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Myanmar',            country_prefix:'+95', primary_language_code:'my', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Cambodia',           country_prefix:'+855', primary_language_code:'km', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Turkey',             country_prefix:'+90', primary_language_code:'tr', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Uzbekistan',         country_prefix:'+998', primary_language_code:'uz', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Afghanistan',        country_prefix:'+93', primary_language_code:'fa', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Italy',              country_prefix:'+39', primary_language_code:'it', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Portugal & Brazil',  country_prefix:'+351,+55', primary_language_code:'pt', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Netherlands',        country_prefix:'+31', primary_language_code:'nl', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Poland',             country_prefix:'+48', primary_language_code:'pl', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Sweden',             country_prefix:'+46', primary_language_code:'sv', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Ukraine',            country_prefix:'+380', primary_language_code:'uk', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
  { name:'Israel',             country_prefix:'+972', primary_language_code:'he', secondary_language_code:'', retry_count:3, play_count:2, is_active:true },
];

// =====================================================================
// CODEC OPTIONS
// =====================================================================
const CODEC_OPTIONS = [
  { value: 'g711', label: 'G.711 (aLaw/μLaw)' },
  { value: 'g729', label: 'G.729' },
  { value: 'gsm', label: 'GSM' },
];

// =====================================================================
// TABS
// =====================================================================
const TABS = [
  { key: 'languages', label: 'Languages',        icon: <Globe size={14} /> },
  { key: 'audio',     label: 'Audio Upload',     icon: <Mic size={14} /> },
  { key: 'sip',       label: 'SIP Config',       icon: <Server size={14} /> },
  { key: 'logs',      label: 'Call Logs',        icon: <Phone size={14} /> },
];
type TabKey = 'languages' | 'audio' | 'sip' | 'logs';

function langDisplay(code: string): string {
  const l = LI_LANGUAGES.find(x => x.code === code);
  return l ? l.display : code;
}

// =====================================================================
// CountdownTimer - localized component for retry countdown
// =====================================================================
const CountdownTimer: React.FC<{ nextRetryAt: string | null; status: string }> = ({ nextRetryAt, status }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (status !== 'retrying' || !nextRetryAt) {
      setTimeLeft('');
      return;
    }
    const tick = () => {
      const diff = new Date(nextRetryAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Now');
        return;
      }
      setTimeLeft(`${Math.ceil(diff / 1000)}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextRetryAt, status]);

  if (!timeLeft) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono ${timeLeft === 'Now' ? 'text-green-600' : 'text-blue-600'}`}>
      <Clock size={10} /> {timeLeft}
    </span>
  );
};

// =====================================================================
// VoiceOTP Component
// =====================================================================
export const VoiceOTP: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('languages');

  // --- Languages state ---
  const [configs, setConfigs] = useState<any[]>([]);
  const [langSearch, setLangSearch] = useState('');
  const [showLangModal, setShowLangModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [groupForm, setGroupForm] = useState<Record<string, any>>({});
  const [langSaving, setLangSaving] = useState(false);

  // --- Audio state ---
  const [audioGroupId, setAudioGroupId] = useState<number | null>(null);
  const [uploadBusy, setUploadBusy] = useState<string | null>(null);
  const [convertingMsg, setConvertingMsg] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  // --- SIP state ---
  const [globalSip, setGlobalSip] = useState<Record<string, string>>({});
  const [sipSaving, setSipSaving] = useState(false);
  const [servers, setServers] = useState<any[]>([]);
  const [showServerModal, setShowServerModal] = useState(false);
  const [editingServer, setEditingServer] = useState<any | null>(null);
  const [serverForm, setServerForm] = useState<Record<string, any>>({});
  const [serverSaving, setServerSaving] = useState(false);

  // --- Logs state ---
  const [logs, setLogs] = useState<any[]>([]);
  const [logFilters, setLogFilters] = useState({ status: '', language: '', date_from: '', date_to: '' });
  const [logsLoading, setLogsLoading] = useState(false);

  // ===================== LOADERS =====================
  const loadConfigs = useCallback(async () => {
    try {
      const r = await api.get('/voice-otp/configs');
      if (r?.success) setConfigs(r.data || []);
    } catch {}
  }, []);

  const loadGlobalSip = useCallback(async () => {
    try {
      const r = await api.get('/voice-otp/global-sip');
      if (r?.success) setGlobalSip(r.data || {});
    } catch {}
  }, []);

  const loadServers = useCallback(async () => {
    try {
      const r = await api.get('/asterisk/servers');
      if (r?.success) setServers(r.data || []);
    } catch {}
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const body: any = { limit: 200 };
      if (logFilters.status) body.status = logFilters.status;
      if (logFilters.language) body.language = logFilters.language;
      if (logFilters.date_from) body.date_from = logFilters.date_from;
      if (logFilters.date_to) body.date_to = logFilters.date_to;
      const r = await api.post('/voice-otp/logs', body);
      setLogs(r?.data || []);
    } catch {} finally { setLogsLoading(false); }
  }, [logFilters]);

  useEffect(() => {
    loadConfigs();
    loadGlobalSip();
    loadServers();
    loadLogs();
  }, []);

  // Seed defaults only once when the table is empty
  useEffect(() => {
    if (configs.length === 0) {
      api.post('/voice-otp/seed-defaults', { groups: DEFAULT_GROUPS }).then(() => loadConfigs()).catch(() => {});
    }
  }, [configs.length]);

  const refreshAll = () => { loadConfigs(); loadGlobalSip(); loadServers(); loadLogs(); };

  // Computed: audio status for the selected 1st language across all groups
  const selectedLangAudioStatus = (() => {
    const code = groupForm.primary_language_code;
    if (!code) return null;
    // Find the first group (not the one being edited) that uses this language and has audio
    const match = configs.find((c: any) =>
      c.primary_language_code === code &&
      (!editingGroup || c.id !== editingGroup.id) &&
      (Object.keys(c.audio_files || {}).length > 0 || !!c.greeting_audio_url)
    );
    // If no match with audio, find ANY group with this language (or the editing group itself as last resort)
    const anyMatch = match || configs.find((c: any) =>
      c.primary_language_code === code &&
      (!editingGroup || c.id !== editingGroup.id)
    ) || (editingGroup ? configs.find((c: any) => c.id === editingGroup.id) : null);
    if (!anyMatch) return { found: false, greeting: false, digitCount: 0, complete: false, groupName: null };
    const audioFiles = anyMatch.audio_files || {};
    const digitCount = Object.keys(audioFiles).length;
    const hasGreeting = !!anyMatch.greeting_audio_url;
    return {
      found: true,
      greeting: hasGreeting,
      digitCount,
      complete: hasGreeting && digitCount >= 10,
      groupName: match ? match.language : null,
    };
  })();

  // ===================== LANGUAGE GROUP CRUD =====================
  const openGroupModal = (group?: any) => {
    if (group) {
      setEditingGroup(group);
      setGroupForm({
        name: group.language || '',
        country_prefix: group.country_prefix || '',
        primary_language_code: group.primary_language_code || 'en',
        secondary_language_code: group.secondary_language_code || '',
        retry_count: group.retry_count ?? 3,
        play_count: group.play_count ?? 2,
        is_active: group.is_active !== false,
      });
    } else {
      setEditingGroup(null);
      setGroupForm({
        name: '', country_prefix: '',
        primary_language_code: 'en',
        secondary_language_code: '',
        retry_count: 3, play_count: 2,
        is_active: true,
      });
    }
    setShowLangModal(true);
  };

  const saveGroup = async () => {
    setLangSaving(true);
    try {
      const body: any = {
        language: groupForm.name,
        country_prefix: groupForm.country_prefix,
        primary_language_code: groupForm.primary_language_code,
        secondary_language_code: groupForm.secondary_language_code || '',
        retry_count: groupForm.retry_count,
        play_count: groupForm.play_count,
        is_active: groupForm.is_active,
        language_code: groupForm.primary_language_code,
        greeting_text: '',
        retry_text: '',
        primary_greeting_text: '',
        primary_retry_text: '',
      };
      if (editingGroup) {
        await api.put('/voice-otp/configs/' + editingGroup.id, body);
      } else {
        await api.post('/voice-otp/configs', body);
      }
      setShowLangModal(false);
      await loadConfigs();
    } catch (e: any) {
      alert('Failed: ' + (e?.message || ''));
    } finally { setLangSaving(false); }
  };

  const deleteGroup = async (id: number) => {
    if (!confirm('Delete this country group? This cannot be undone.')) return;
    try {
      await api.delete('/voice-otp/configs/' + id);
      await loadConfigs();
    } catch (e: any) { alert('Failed: ' + (e?.message || '')); }
  };

  const toggleActive = async (cfg: any) => {
    try {
      await api.put('/voice-otp/configs/' + cfg.id, { is_active: !cfg.is_active });
      await loadConfigs();
    } catch {}
  };

  // ===================== AUDIO UPLOAD =====================
  const selectedGroup = configs.find((c: any) => c.id === audioGroupId);

  const handleAudioUpload = async (digit: string, file: File) => {
    if (!file || !selectedGroup) return;
    if (!/^[0-9]$/.test(digit) && digit !== 'greeting') { alert('digit must be 0-9'); return; }
    const key = digit;
    setUploadBusy(key);
    const isMp3 = file.name.toLowerCase().endsWith('.mp3');
    if (isMp3) setConvertingMsg(key);
    try {
      const fd = new FormData();
      fd.append('audio', file);
      fd.append('language_code', selectedGroup.primary_language_code || selectedGroup.language_code || 'en');
      fd.append('digit', digit);
      fd.append('group_id', String(selectedGroup.id));
      const token = api.getToken();
      const resp = await fetch('/api/voice-otp/audio-upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await resp.json();
      if (data?.success) {
        await loadConfigs();
      } else {
        alert('Audio upload failed: ' + (data?.error || 'unknown'));
      }
    } catch (e: any) {
      alert('Audio upload failed: ' + e.message);
    } finally {
      setUploadBusy(null);
      setConvertingMsg(null);
    }
  };

  // Drag-and-drop handlers
  const [dragTarget, setDragTarget] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, digit: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTarget(digit);
  };

  const handleDragLeave = () => {
    setDragTarget(null);
  };

  const handleDrop = (e: React.DragEvent, digit: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTarget(null);
    const file = e.dataTransfer.files?.[0];      if (file && file.name.match(/\.(mp3|wav)$/i)) {
      handleAudioUpload(digit, file);
    }
  };

  // ===================== GLOBAL SIP SAVE =====================
  const saveGlobalSip = async () => {
    setSipSaving(true);
    try {
      await api.put('/voice-otp/global-sip', globalSip);
      await loadGlobalSip();
    } catch (e: any) { alert('Failed: ' + (e?.message || '')); }
    finally { setSipSaving(false); }
  };

  // ===================== SIP SERVER CRUD =====================
  const openServerForm = (server?: any) => {
    if (server) {
      setEditingServer(server);
      setServerForm({ ...server });
    } else {
      setEditingServer(null);
      setServerForm({
        name: '', ami_host: '', sip_host: '', ami_port: 5038, sip_port: 5060,
        ami_username: 'net2app', ami_secret: 'net2app_secret', transport: 'udp',
        dialplan_context: 'net2app-otp', priority: 10, is_active: true,
      });
    }
    setShowServerModal(true);
  };

  const saveServer = async () => {
    setServerSaving(true);
    try {
      if (editingServer) {
        await api.put('/asterisk/servers/' + editingServer.id, serverForm);
      } else {
        await api.post('/asterisk/servers', serverForm);
      }
      setShowServerModal(false);
      await loadServers();
    } catch (e: any) { alert('Failed to save server: ' + (e?.message || '')); }
    finally { setServerSaving(false); }
  };

  const deleteServer = async (id: number) => {
    if (!confirm('Archive this SIP server?')) return;
    try { await api.delete('/asterisk/servers/' + id); await loadServers(); } catch {}
  };

  const testServer = async (id: number) => {
    try {
      const r = await api.post('/asterisk/servers/' + id + '/test', {});
      alert(r?.data?.ok ? 'Server reachable ✓' : 'Server unreachable: ' + (r?.data?.error || 'unknown'));
    } catch { alert('Health check failed'); }
  };

  // ===================== STATS =====================
  const activeGroups = configs.filter((c: any) => c.is_active !== false).length;
  const groupsWithFullAudio = configs.filter((c: any) => {
    const audioFiles = c.audio_files || {};
    return Object.keys(audioFiles).length >= 10 && !!c.greeting_audio_url;
  }).length;
  const serversUp = servers.filter((s: any) => s.last_health_status === 'ok').length;
  const callSuccessRate = logs.length
    ? ((logs.filter((l: any) => l.dial_status === 'CONNECTED' || l.status === 'completed').length / logs.length) * 100).toFixed(1)
    : '0.0';

  // Filtered configs for search
  const filteredConfigs = configs.filter((c: any) =>
    (c.language + ' ' + (c.country_prefix || '')).toLowerCase().includes(langSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Voice OTP</h1>
          <p className="text-gray-500 mt-1">{configs.length} country groups • Asterisk SIP • Call delivery logs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={refreshAll}>Refresh</Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-xl p-4">
          <Globe size={20} className="mb-2" /><p className="text-sm opacity-80">Groups</p><p className="text-2xl font-bold">{configs.length}</p>
        </div>
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-xl p-4">
          <Activity size={20} className="mb-2" /><p className="text-sm opacity-80">Active</p><p className="text-2xl font-bold">{activeGroups}</p>
        </div>
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-xl p-4">
          <Music size={20} className="mb-2" /><p className="text-sm opacity-80">Full Audio</p><p className="text-2xl font-bold">{groupsWithFullAudio}/{configs.length}</p>
        </div>
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-xl p-4">
          <Server size={20} className="mb-2" /><p className="text-sm opacity-80">SIP Up</p><p className="text-2xl font-bold">{serversUp}/{servers.length || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-xl p-4">
          <Phone size={20} className="mb-2" /><p className="text-sm opacity-80">Connect Rate</p><p className="text-2xl font-bold">{callSuccessRate}%</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as TabKey)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ===================== TAB 1: LANGUAGES ===================== */}
      {tab === 'languages' && (
        <Card title={`Country Groups (${configs.length})`}
          subtitle="Each group maps country prefixes to a language for voice OTP delivery. Retry count = max call attempts. Play count = OTP repeat cycles per call."
          action={
            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Search..."
                  value={langSearch} onChange={(e) => setLangSearch(e.target.value)} />
              </div>
              <Button icon={<Plus size={16} />} onClick={() => openGroupModal()}>Add Group</Button>
            </div>
          }
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800 border-b-2 border-gray-900">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Group Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Country Prefixes</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase">1st Language</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase">2nd Language</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase">Retry</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase">Play Count</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase">Audio</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase">Active</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredConfigs.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    <Globe size={32} className="mx-auto mb-2 opacity-30" />
                    <p>{configs.length === 0 ? 'No country groups yet' : 'No matching groups'}</p>
                    {configs.length === 0 && <Button className="mt-3" icon={<Plus size={14} />} onClick={() => openGroupModal()}>Add First Group</Button>}
                  </td></tr>
                ) : (
                  filteredConfigs.map((cfg: any) => {
                    const priCode = cfg.primary_language_code || 'en';
                    const secCode = cfg.secondary_language_code || '';
                    const audioCount = Object.keys(cfg.audio_files || {}).length;
                    const hasGreeting = !!cfg.greeting_audio_url;
                    const audioComplete = hasGreeting && audioCount >= 10;
                    return (
                      <tr key={cfg.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-800">{cfg.language || 'Unnamed'}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-600 max-w-[200px] truncate" title={cfg.country_prefix}>{cfg.country_prefix || '-'}</td>
                        <td className="px-4 py-2.5 text-center"><Badge variant="info">{langDisplay(priCode)}</Badge></td>
                        <td className="px-4 py-2.5 text-center">
                          {secCode ? <Badge variant="warning">{langDisplay(secCode)}</Badge> : <span className="text-xs text-gray-400">None</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant={cfg.retry_count > 2 ? 'warning' : 'default'}>{cfg.retry_count ?? 3}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant={cfg.play_count > 2 ? 'warning' : 'default'}>{cfg.play_count ?? 2}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant={audioComplete ? 'success' : audioCount > 0 ? 'warning' : 'danger'}>
                            {audioComplete ? 'Full' : audioCount > 0 ? `${audioCount}/11` : 'None'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => toggleActive(cfg)}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                              cfg.is_active !== false ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                            {cfg.is_active !== false ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex justify-center gap-1">
                            <Button size="sm" variant="secondary" onClick={() => openGroupModal(cfg)} icon={<Edit size={12} />}>Edit</Button>
                            <Button size="sm" variant="danger" onClick={() => deleteGroup(cfg.id)} icon={<Trash2 size={12} />} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Language Group Add/Edit Modal */}
      <Modal isOpen={showLangModal} onClose={() => setShowLangModal(false)}
        title={editingGroup ? 'Edit Country Group' : 'Add Country Group'} size="lg"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowLangModal(false)}>Cancel</Button>
            <Button onClick={saveGroup} loading={langSaving} icon={<Save size={14} />}>
              {editingGroup ? 'Update' : 'Create'}
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <Input label="Group Name *" value={groupForm.name || ''}
            onChange={(e) => setGroupForm((p: any) => ({ ...p, name: e.target.value }))} placeholder="e.g. Bangladesh" />
          <Input label="Country Prefixes (comma-separated) *" value={groupForm.country_prefix || ''}
            onChange={(e) => setGroupForm((p: any) => ({ ...p, country_prefix: e.target.value }))} placeholder="+880" />
          <Select label="1st Language" value={groupForm.primary_language_code || 'en'}
            onChange={(e) => setGroupForm((p: any) => ({ ...p, primary_language_code: e.target.value }))}
            options={LI_LANGUAGES.map((l) => ({ value: l.code, label: l.display }))} />

          {/* Audio status for selected language */}
          {selectedLangAudioStatus?.found ? (
            <div className={`rounded-lg p-3 border text-sm ${
              selectedLangAudioStatus.complete ? 'bg-green-50 border-green-200' :
              selectedLangAudioStatus.digitCount > 0 ? 'bg-amber-50 border-amber-200' :
              'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Mic size={14} className={selectedLangAudioStatus.complete ? 'text-green-600' : 'text-amber-600'} />
                <span className="font-semibold">Audio Status: {langDisplay(groupForm.primary_language_code)}</span>
              </div>
              {selectedLangAudioStatus.groupName && (
                <p className="text-xs text-gray-500 mb-1">Reusing audio from "{selectedLangAudioStatus.groupName}"</p>
              )}
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <Badge variant={selectedLangAudioStatus.greeting ? 'success' : 'danger'} size="sm">
                    {selectedLangAudioStatus.greeting ? '✓ Greeting' : '✗ Greeting'}
                  </Badge>
                </span>
                <span className="flex items-center gap-1">
                  <Badge variant={selectedLangAudioStatus.digitCount >= 10 ? 'success' : selectedLangAudioStatus.digitCount > 0 ? 'warning' : 'danger'} size="sm">
                    {selectedLangAudioStatus.digitCount}/10 Digits
                  </Badge>
                </span>
                <span className="flex items-center gap-1">
                  <Badge variant={selectedLangAudioStatus.complete ? 'success' : 'warning'} size="sm" dot>
                    {selectedLangAudioStatus.complete ? 'Full' : 'Partial'}
                  </Badge>
                </span>
              </div>
            </div>
          ) : selectedLangAudioStatus && !selectedLangAudioStatus.found ? (
            <div className="rounded-lg p-3 border text-sm bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2">
                <Music size={14} className="text-blue-600" />
                <span className="font-semibold">No audio uploaded yet for {langDisplay(groupForm.primary_language_code)}</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">Upload greeting + digits (0-9) in the Audio tab first.</p>
            </div>
          ) : null}

          <Select label="2nd Language (optional)" value={groupForm.secondary_language_code || ''}
            onChange={(e) => setGroupForm((p: any) => ({ ...p, secondary_language_code: e.target.value }))}
            options={[{value:'',label:'None (disabled)'},...LI_LANGUAGES.map((l) => ({ value: l.code, label: l.display }))]} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Retry Count (1-4)" value={String(groupForm.retry_count ?? 3)}
              onChange={(e) => setGroupForm((p: any) => ({ ...p, retry_count: parseInt(e.target.value) }))}
              options={[{value:'1',label:'1'},{value:'2',label:'2'},{value:'3',label:'3'},{value:'4',label:'4'}]} />
            <Select label="Play Count (1-3)" value={String(groupForm.play_count ?? 2)}
              onChange={(e) => setGroupForm((p: any) => ({ ...p, play_count: parseInt(e.target.value) }))}
              options={[{value:'1',label:'1'},{value:'2',label:'2'},{value:'3',label:'3'}]} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={groupForm.is_active !== false}
              onChange={(e) => setGroupForm((p: any) => ({ ...p, is_active: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm">Active</span>
          </label>
        </div>
      </Modal>

      {/* ===================== TAB 2: AUDIO UPLOAD ===================== */}
      {tab === 'audio' && (
        <>
          <Card title="Audio Upload"
            subtitle={selectedGroup
              ? `${selectedGroup.language} — ${langDisplay(selectedGroup.primary_language_code || 'en')}`
              : 'Select a country group to upload audio files. Drag & drop mp3 or wav files onto digit cards.'}
            action={
              <div className="w-64">
                <Select label="" value={audioGroupId ?? ''}
                  onChange={(e) => setAudioGroupId(e.target.value ? Number(e.target.value) : null)}
                  options={[
                    { value: '', label: '-- Select group --' },
                    ...configs.filter((c: any) => c.is_active !== false).map((c: any) => ({ value: String(c.id), label: c.language || 'Unnamed' })),
                  ]} />
              </div>
            }>
            {!selectedGroup ? (
              <div className="text-center py-8 text-gray-400">
                <Mic size={48} className="mx-auto mb-4 opacity-30" />
                <p>Select a country group above to start uploading audio</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Greeting upload */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Mic size={16} className="text-blue-600" /> Greeting Audio
                  </h4>
                  <AudioDropCard
                    digit="greeting"
                    label="Greeting"
                    audioUrl={selectedGroup.greeting_audio_url || ''}
                    uploadBusy={uploadBusy}
                    convertingMsg={convertingMsg}
                    dragTarget={dragTarget}
                    audioRefs={audioRefs}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onUpload={handleAudioUpload}
                  />
                </div>

                {/* Digit grid */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Hash size={16} className="text-purple-600" /> Digit Audio (0-9)
                  </h4>
                  <div className="grid grid-cols-5 gap-3">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                      const digit = String(d);
                      const audioFiles = selectedGroup.audio_files || {};
                      const audioUrl = audioFiles[digit];
                      const key = digit;
                      const isUploading = uploadBusy === key;
                      const isDragOver = dragTarget === key;
                      return (
                        <div key={d}
                          onDragOver={(e) => handleDragOver(e, key)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, key)}
                          className={`relative border-2 rounded-xl p-3 flex flex-col items-center gap-2 transition-all hover:shadow-md ${
                            isDragOver ? 'border-blue-500 bg-blue-50 scale-105' :
                            audioUrl ? 'border-green-300 bg-green-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-sm">{d}</div>
                          {audioUrl ? (
                            <>
                              <Badge variant="success">WAV</Badge>
                              <div className="flex gap-1">
                                <button onClick={() => { const a = audioRefs.current[key]; if (a) { a.currentTime = 0; a.play().catch(() => {}); } }}
                                  className="p-1.5 rounded-full bg-green-100 hover:bg-green-200"><Play size={14} className="text-green-600" /></button>
                                <label className="p-1.5 rounded-full bg-blue-100 hover:bg-blue-200 cursor-pointer" title="Replace">
                                  <Upload size={14} className="text-blue-600" />
                                  <input type="file" className="hidden" accept="audio/mpeg,audio/wav,.mp3,.wav"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAudioUpload(key, f); }} />
                                </label>
                              </div>
                              <audio ref={(el) => { audioRefs.current[key] = el; }} src={audioUrl} preload="auto" className="hidden" />
                            </>
                          ) : convertingMsg === key ? (
                            <div className="text-center text-xs text-yellow-600 py-1"><Loader size={12} className="animate-spin mx-auto mb-1" />Converting…</div>
                          ) : (
                            <label className={`flex items-center gap-1 cursor-pointer text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
                              isUploading ? 'bg-gray-100 text-gray-400' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'}`}>
                              {isUploading ? <Loader size={12} className="animate-spin" /> : <Upload size={12} />}
                              {isUploading ? 'Uploading…' : 'Upload'}
                              <input type="file" className="hidden" accept="audio/mpeg,audio/wav,.mp3,.wav"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAudioUpload(key, f); }} disabled={!!isUploading} />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">Drag & drop mp3/wav files onto digit cards — auto-converted to 8kHz mono wav.</p>
                </div>
              </div>
            )}
          </Card>

          {/* Audio status overview */}
          <Card title="Audio Upload Status (all groups)" subtitle="Greeting + 10 digits = Full. Click a group to jump to audio upload." noPadding>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0">
                  <tr className="bg-gray-800 border-b-2 border-gray-900">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Group</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase">Greeting</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase">0-9 Digits</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((cfg: any) => {
                    const hasGreeting = !!(cfg.greeting_audio_url);
                    const digitCount = Object.keys(cfg.audio_files || {}).length;
                    const complete = hasGreeting && digitCount >= 10;
                    return (
                      <tr key={cfg.id} onClick={() => { setAudioGroupId(cfg.id); setTab('audio'); }}
                        className="border-b hover:bg-gray-50 cursor-pointer transition-colors">
                        <td className="px-4 py-2.5 text-sm font-medium">{cfg.language || 'Unnamed'}</td>
                        <td className="px-4 py-2.5 text-center">{hasGreeting ? <Badge variant="success">✓</Badge> : <Badge variant="danger">✗</Badge>}</td>
                        <td className="px-4 py-2.5 text-center"><Badge variant={digitCount >= 10 ? 'success' : digitCount > 0 ? 'warning' : 'danger'}>{digitCount}/10</Badge></td>
                        <td className="px-4 py-2.5 text-center"><Badge variant={complete ? 'success' : 'warning'} dot>{complete ? 'Full' : 'Partial'}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ===================== TAB 3: SIP CONFIG ===================== */}
      {tab === 'sip' && (
        <>
          {/* Global SIP Settings */}
          <Card title="Global SIP Trunk Settings"
            subtitle="Configure the upstream SIP trunk. Codec, E.164 mode, and caller ID apply to all outbound voice OTP calls."
            action={
              <Button onClick={saveGlobalSip} loading={sipSaving} icon={<Save size={14} />}>Save SIP</Button>
            }>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input label="SIP Host"
                value={globalSip.voice_otp_sip_host || ''}
                onChange={(e) => setGlobalSip((p) => ({ ...p, voice_otp_sip_host: e.target.value }))}
                placeholder="sip.provider.com" />
              <Input label="SIP Port" type="number"
                value={globalSip.voice_otp_sip_port || '5060'}
                onChange={(e) => setGlobalSip((p) => ({ ...p, voice_otp_sip_port: e.target.value }))} />
              <Input label="SIP Username (optional)"
                value={globalSip.voice_otp_sip_username || ''}
                onChange={(e) => setGlobalSip((p) => ({ ...p, voice_otp_sip_username: e.target.value }))}
                placeholder="auth user" />
              <Input label="SIP Password (optional)" type="password"
                value={globalSip.voice_otp_sip_password || ''}
                onChange={(e) => setGlobalSip((p) => ({ ...p, voice_otp_sip_password: e.target.value }))}
                placeholder="••••" />
              <Input label="Caller ID"
                value={globalSip.voice_otp_caller_id || ''}
                onChange={(e) => setGlobalSip((p) => ({ ...p, voice_otp_caller_id: e.target.value }))}
                placeholder="+1234567890" />
              <Select label="Audio Codec"
                value={globalSip.voice_otp_audio_codec || 'g711'}
                onChange={(e) => setGlobalSip((p) => ({ ...p, voice_otp_audio_codec: e.target.value }))}
                options={CODEC_OPTIONS} />
              <div className="flex flex-col justify-end">
                <Select label="Caller ID Format"
                  value={globalSip.voice_otp_is_e164 || 'true'}
                  onChange={(e) => setGlobalSip((p) => ({ ...p, voice_otp_is_e164: e.target.value }))}
                  options={[{ value: 'true', label: 'E.164 (+1234567890)' }, { value: 'false', label: 'International (001234567890)' }]} />
              </div>
            </div>
          </Card>

          {/* SIP Servers List */}
          <Card title={`SIP Servers (${servers.length})`} subtitle={`${serversUp} healthy • These are the Asterisk endpoints that place calls`}
            action={<Button icon={<Plus size={16} />} onClick={() => openServerForm()}>Add Server</Button>}>
            {servers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Server size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No SIP servers configured</p>
                <Button className="mt-4" icon={<Plus size={16} />} onClick={() => openServerForm()}>Add First Server</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {servers.map((srv: any) => (
                  <div key={srv.id} className={`border rounded-xl p-4 transition-all hover:shadow-sm ${srv.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          srv.last_health_status === 'ok' ? 'bg-green-100' : srv.last_health_status === 'down' ? 'bg-red-100' : 'bg-gray-100'}`}>
                          {srv.last_health_status === 'ok' ? <Wifi size={18} className="text-green-600" /> :
                           srv.last_health_status === 'down' ? <WifiOff size={18} className="text-red-600" /> :
                           <AlertCircle size={18} className="text-gray-400" />}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800">{srv.name}</h4>
                          <p className="text-xs text-gray-500 font-mono">AMI: {srv.ami_host}:{srv.ami_port} • SIP: {srv.sip_host}:{srv.sip_port}</p>
                        </div>
                        <Badge variant={srv.is_active ? 'success' : 'danger'} dot>{srv.is_active ? 'Active' : 'Inactive'}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => testServer(srv.id)} icon={<Activity size={12} />}>Test</Button>
                        <Button variant="secondary" size="sm" onClick={() => openServerForm(srv)} icon={<Edit size={12} />}>Edit</Button>
                        <Button variant="danger" size="sm" onClick={() => deleteServer(srv.id)} icon={<Trash2 size={12} />}>Archive</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Modal isOpen={showServerModal} onClose={() => setShowServerModal(false)}
            title={editingServer ? 'Edit SIP Server' : 'Add SIP Server'} size="lg"
            footer={<div className="flex gap-2 justify-end"><Button variant="secondary" onClick={() => setShowServerModal(false)}>Cancel</Button><Button onClick={saveServer} loading={serverSaving} icon={<Save size={14} />}>Save</Button></div>}>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Server Name" value={serverForm.name || ''} onChange={(e) => setServerForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
              <Input label="AMI Host" value={serverForm.ami_host || ''} onChange={(e) => setServerForm((p: any) => ({ ...p, ami_host: e.target.value }))} />
              <Input label="AMI Port" type="number" value={serverForm.ami_port ?? 5038} onChange={(e) => setServerForm((p: any) => ({ ...p, ami_port: parseInt(e.target.value) }))} />
              <Input label="SIP Host" value={serverForm.sip_host || ''} onChange={(e) => setServerForm((p: any) => ({ ...p, sip_host: e.target.value }))} />
              <Input label="SIP Port" type="number" value={serverForm.sip_port ?? 5060} onChange={(e) => setServerForm((p: any) => ({ ...p, sip_port: parseInt(e.target.value) }))} />
              <Input label="AMI Username" value={serverForm.ami_username || 'net2app'} onChange={(e) => setServerForm((p: any) => ({ ...p, ami_username: e.target.value }))} />
              <Input label="AMI Secret" type="password" value={serverForm.ami_secret || ''} onChange={(e) => setServerForm((p: any) => ({ ...p, ami_secret: e.target.value }))} />
              <Select label="Transport" value={serverForm.transport || 'udp'} onChange={(e) => setServerForm((p: any) => ({ ...p, transport: e.target.value }))}
                options={[{value:'udp',label:'UDP'},{value:'tcp',label:'TCP'},{value:'tls',label:'TLS'}]} />
              <Input label="Priority" type="number" value={serverForm.priority ?? 10} onChange={(e) => setServerForm((p: any) => ({ ...p, priority: parseInt(e.target.value) }))} />
              <div className="col-span-2"><Input label="Dialplan Context" value={serverForm.dialplan_context || 'net2app-otp'} onChange={(e) => setServerForm((p: any) => ({ ...p, dialplan_context: e.target.value }))} /></div>
            </div>
          </Modal>
        </>
      )}

      {/* ===================== TAB 4: CALL LOGS ===================== */}
      {tab === 'logs' && (
        <>
          <Card title="Call Logs (CDR)" subtitle="Voice OTP delivery history with DLR status and retry tracking."
            action={<Button variant="secondary" icon={<RefreshCw size={14} />} onClick={loadLogs} loading={logsLoading}>Refresh</Button>}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Select label="Status" value={logFilters.status} onChange={(e) => setLogFilters((p: any) => ({ ...p, status: e.target.value }))}
                options={[{value:'',label:'All'},{value:'initiated',label:'Initiated'},{value:'completed',label:'Completed'},{value:'failed',label:'Failed'},{value:'retrying',label:'Retrying'}]} />
              <Select label="Language" value={logFilters.language} onChange={(e) => setLogFilters((p: any) => ({ ...p, language: e.target.value }))}
                options={[{value:'',label:'All'},...LI_LANGUAGES.map(l=>({value:l.code,label:l.display}))]} />
              <Input label="Date from" type="date" value={logFilters.date_from} onChange={(e) => setLogFilters((p: any) => ({ ...p, date_from: e.target.value }))} />
              <Input label="Date to" type="date" value={logFilters.date_to} onChange={(e) => setLogFilters((p: any) => ({ ...p, date_to: e.target.value }))} />
            </div>
            <div className="flex gap-2 mb-4">
              <Button variant="secondary" size="sm" icon={<Filter size={12} />} onClick={loadLogs}>Apply</Button>
              <Button variant="secondary" size="sm" onClick={() => { setLogFilters({status:'',language:'',date_from:'',date_to:''}); setTimeout(() => loadLogs(), 50); }}>Clear</Button>
            </div>
          </Card>
          <Card title={`Results (${logs.length})`} noPadding>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-800 border-b-2 border-gray-900">
                    <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase">Call ID</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase">Destination</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-white uppercase">OTP</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-white uppercase">Language</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-white uppercase">Status</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-white uppercase">DLR</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-white uppercase">Retries</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-white uppercase">Countdown</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-white uppercase">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                      <Phone size={32} className="mx-auto mb-2 opacity-30" /><p>No call logs found</p>
                    </td></tr>
                  ) : (
                    logs.map((l: any) => {
                      const dlrOk = l.dlr_status === 'CONNECTED' || l.dlr_status === 'DELIVRD';
                      const isRetrying = l.status === 'retrying';
                      const isFailed = l.status === 'failed' || l.dial_status === 'FAILED' || l.dlr_status === 'FAILED';
                      const isCompleted = l.status === 'completed' || l.dial_status === 'CONNECTED';
                      return (
                        <tr key={l.id} className={`border-b hover:bg-gray-50 transition-colors ${isFailed ? 'bg-red-50' : ''}`}>
                          <td className="px-3 py-3 font-mono text-xs text-gray-600 max-w-[100px] truncate" title={l.call_id}>{l.call_id}</td>
                          <td className="px-3 py-3 font-mono text-sm font-medium">{l.destination}</td>
                          <td className="px-3 py-3 text-center font-mono font-bold text-purple-700">{l.otp_code}</td>
                          <td className="px-3 py-3 text-center"><Badge variant="info">{l.language || '-'}</Badge></td>
                          <td className="px-3 py-3 text-center">
                            <Badge variant={isCompleted ? 'success' : isFailed ? 'danger' : isRetrying ? 'warning' : 'default'} dot>
                              {l.dial_status || l.status || 'unknown'}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <Badge variant={dlrOk ? 'success' : l.dlr_status ? 'danger' : 'default'}>
                              {l.dlr_status || 'pending'}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-center text-sm font-medium">
                            <span className={l.retry_count > 0 ? 'text-amber-600' : 'text-gray-400'}>
                              {l.retry_count || 0}/{l.max_retries || 4}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <CountdownTimer nextRetryAt={l.next_retry_at} status={l.status} />
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-gray-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

// =====================================================================
// AudioDropCard - drag-and-drop enabled audio card for greeting
// =====================================================================
const AudioDropCard: React.FC<{
  digit: string; label: string; audioUrl: string;
  uploadBusy: string | null; convertingMsg: string | null;
  dragTarget: string | null;
  audioRefs: React.MutableRefObject<Record<string, HTMLAudioElement | null>>;
  onDragOver: (e: React.DragEvent, digit: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, digit: string) => void;
  onUpload: (digit: string, file: File) => void;
}> = ({ digit, label, audioUrl, uploadBusy, convertingMsg, dragTarget, audioRefs, onDragOver, onDragLeave, onDrop, onUpload }) => {
  const key = digit;
  const isDragOver = dragTarget === key;
  const isBusy = uploadBusy === key;
  const isConverting = convertingMsg === key;

  return (
    <div
      onDragOver={(e) => onDragOver(e, key)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, key)}
      className={`border-2 rounded-xl p-4 transition-all ${
        isDragOver ? 'border-blue-500 bg-blue-50 scale-[1.02]' :
        audioUrl ? 'border-green-300 bg-green-50' : 'border-dashed border-blue-300 bg-blue-50'}`}
    >
      <h5 className="text-xs font-semibold text-gray-500 uppercase mb-3">{label}</h5>
      {audioUrl ? (
        <div className="flex items-center gap-4">
          <Badge variant="success">WAV</Badge>
          <button onClick={() => { const a = audioRefs.current[key]; if (a) { a.currentTime = 0; a.play().catch(() => {}); } }}
            className="p-2 rounded-full bg-blue-100 hover:bg-blue-200 transition-colors"><Play size={16} className="text-blue-600" /></button>
          <audio ref={(el) => { audioRefs.current[key] = el; }} src={audioUrl} preload="auto" className="hidden" />
          <label className="cursor-pointer text-sm text-blue-600 hover:text-blue-800"><Upload size={14} className="inline mr-1" />Replace
            <input type="file" className="hidden" accept="audio/mpeg,audio/wav,.mp3,.wav"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(key, f); }} />
          </label>
        </div>
      ) : isConverting ? (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg text-sm">
          <Loader size={14} className="animate-spin" />Converting mp3 → wav (8kHz mono)…
        </div>
      ) : isBusy ? (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
          <Loader size={14} className="animate-spin" />Uploading…
        </div>
      ) : (
        <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm w-fit">
          <Upload size={14} />Upload {label} (mp3/wav)
          <input type="file" className="hidden" accept="audio/mpeg,audio/wav,.mp3,.wav"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(key, f); }} />
        </label>
      )}
    </div>
  );
};
