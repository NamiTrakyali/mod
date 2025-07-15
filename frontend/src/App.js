import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { 
  Shield, 
  Users, 
  Settings as SettingsIcon, 
  BarChart3, 
  LogOut, 
  Home,
  Bot,
  MessageCircle,
  AlertTriangle,
  UserX,
  Volume2,
  Trash2,
  Eye,
  Power,
  Server
} from "lucide-react";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Authentication context
const AuthContext = React.createContext();

// Authentication provider
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('discord_token'));

  useEffect(() => {
    // Check for token in URL (from OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
      localStorage.setItem('discord_token', tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Auth error:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      const response = await axios.get(`${API}/auth/login`);
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('discord_token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login component
const Login = () => {
  const { login } = React.useContext(AuthContext);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Discord Moderasyon Botu
            </h1>
            <p className="text-gray-300">
              Sunucunuzu yönetmek için Discord hesabınızla giriş yapın
            </p>
          </div>

          <button
            onClick={login}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Shield className="w-5 h-5" />
            Discord ile Giriş Yap
          </button>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              30+ Türkçe moderasyon komutu • AI sohbet • Gerçek zamanlı istatistikler
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard components
const Sidebar = ({ activeTab, setActiveTab, guilds, selectedGuild, setSelectedGuild }) => {
  const { user, logout } = React.useContext(AuthContext);

  const menuItems = [
    { id: 'dashboard', label: 'Ana Sayfa', icon: Home },
    { id: 'moderation', label: 'Moderasyon', icon: Shield },
    { id: 'settings', label: 'Ayarlar', icon: SettingsIcon },
    { id: 'stats', label: 'İstatistikler', icon: BarChart3 },
    { id: 'ai', label: 'AI Yönetimi', icon: MessageCircle },
  ];

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Bot Paneli</h1>
            <p className="text-sm text-gray-400">v1.0.0</p>
          </div>
        </div>

        {/* Guild Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Sunucu Seç</label>
          <select
            value={selectedGuild?.id || ''}
            onChange={(e) => {
              const guild = guilds.find(g => g.id === e.target.value);
              setSelectedGuild(guild);
            }}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Sunucu seçin...</option>
            {guilds.map(guild => (
              <option key={guild.id} value={guild.id}>
                {guild.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <nav className="flex-1 p-4">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-2 transition-colors ${
              activeTab === item.id
                ? 'bg-indigo-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">
              {user?.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">{user?.username}</p>
            <p className="text-xs text-gray-400">#{user?.discriminator}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Çıkış Yap
        </button>
      </div>
    </div>
  );
};

const Dashboard = ({ selectedGuild }) => {
  const [stats, setStats] = useState({
    total_warnings: 0,
    total_bans: 0,
    total_kicks: 0,
    total_mutes: 0
  });

  useEffect(() => {
    if (selectedGuild) {
      fetchGuildStats();
    }
  }, [selectedGuild]);

  const fetchGuildStats = async () => {
    try {
      const response = await axios.get(`${API}/guilds/${selectedGuild.id}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const statCards = [
    { title: 'Toplam Uyarı', value: stats.total_warnings, icon: AlertTriangle, color: 'bg-yellow-500' },
    { title: 'Toplam Yasak', value: stats.total_bans, icon: UserX, color: 'bg-red-500' },
    { title: 'Toplam Atma', value: stats.total_kicks, icon: UserX, color: 'bg-orange-500' },
    { title: 'Toplam Susturma', value: stats.total_mutes, icon: Volume2, color: 'bg-purple-500' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {selectedGuild ? `${selectedGuild.name} - Ana Sayfa` : 'Bot Paneli'}
        </h1>
        <p className="text-gray-600">
          {selectedGuild ? 'Sunucu moderasyon istatistikleri' : 'Lütfen bir sunucu seçin'}
        </p>
      </div>

      {selectedGuild ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
            <div key={index} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-full ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200 text-center">
          <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Sunucu Seçin</h3>
          <p className="text-gray-600">
            Moderasyon panelini kullanmak için sol taraftan bir sunucu seçin.
          </p>
        </div>
      )}
    </div>
  );
};

const Moderation = ({ selectedGuild }) => {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedGuild) {
      fetchModerationActions();
    }
  }, [selectedGuild]);

  const fetchModerationActions = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/guilds/${selectedGuild.id}/moderation/actions`);
      setActions(response.data.actions);
    } catch (error) {
      console.error('Error fetching moderation actions:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteAction = async (actionId) => {
    try {
      await axios.delete(`${API}/guilds/${selectedGuild.id}/moderation/actions/${actionId}`);
      setActions(actions.filter(action => action.id !== actionId));
    } catch (error) {
      console.error('Error deleting action:', error);
    }
  };

  const getActionIcon = (type) => {
    switch (type) {
      case 'warn': return AlertTriangle;
      case 'ban': return UserX;
      case 'kick': return UserX;
      case 'mute': return Volume2;
      default: return Shield;
    }
  };

  const getActionColor = (type) => {
    switch (type) {
      case 'warn': return 'text-yellow-600';
      case 'ban': return 'text-red-600';
      case 'kick': return 'text-orange-600';
      case 'mute': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  if (!selectedGuild) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200 text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Sunucu Seçin</h3>
          <p className="text-gray-600">
            Moderasyon loglarını görmek için sol taraftan bir sunucu seçin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {selectedGuild.name} - Moderasyon Logları
        </h1>
        <p className="text-gray-600">
          Son moderasyon işlemleri ve detayları
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Moderasyon İşlemleri</h2>
            <button
              onClick={fetchModerationActions}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Yenile
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Yükleniyor...</p>
            </div>
          ) : actions.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlem
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kullanıcı
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sebep
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Moderatör
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tarih
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {actions.map((action) => {
                  const Icon = getActionIcon(action.action_type);
                  return (
                    <tr key={action.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Icon className={`w-5 h-5 ${getActionColor(action.action_type)} mr-2`} />
                          <span className="font-medium text-gray-800 capitalize">
                            {action.action_type === 'warn' ? 'Uyarı' :
                             action.action_type === 'ban' ? 'Yasak' :
                             action.action_type === 'kick' ? 'Atma' :
                             action.action_type === 'mute' ? 'Susturma' : action.action_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-800">{action.user_id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{action.reason}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-800">{action.moderator_id}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {new Date(action.timestamp).toLocaleString('tr-TR')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => deleteAction(action.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center">
              <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Henüz moderasyon işlemi yok</h3>
              <p className="text-gray-600">
                Bu sunucuda henüz hiç moderasyon işlemi gerçekleştirilmedi.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AIManagement = ({ selectedGuild }) => {
  const [aiSettings, setAiSettings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedGuild) {
      fetchAISettings();
    }
  }, [selectedGuild]);

  const fetchAISettings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/guilds/${selectedGuild.id}/ai/settings`);
      setAiSettings(response.data.ai_settings);
    } catch (error) {
      console.error('Error fetching AI settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAI = async (channelId, enabled) => {
    try {
      await axios.post(`${API}/guilds/${selectedGuild.id}/ai/toggle`, null, {
        params: { channel_id: channelId, enabled }
      });
      fetchAISettings();
    } catch (error) {
      console.error('Error toggling AI:', error);
    }
  };

  if (!selectedGuild) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200 text-center">
          <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Sunucu Seçin</h3>
          <p className="text-gray-600">
            AI ayarlarını yönetmek için sol taraftan bir sunucu seçin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {selectedGuild.name} - AI Yönetimi
        </h1>
        <p className="text-gray-600">
          ChatGPT entegrasyonu ve kanal ayarları
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">AI Sohbet Ayarları</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-blue-800">ChatGPT Entegrasyonu</h3>
            </div>
            <p className="text-blue-700 text-sm">
              AI botu Türkçe olarak kısa ve öz cevaplar verir. Botunuzu @etiketleyerek veya /ai komutunu kullanarak AI ile sohbet edebilirsiniz.
            </p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-800">OpenAI API Anahtarı Gerekli</h3>
          </div>
          <p className="text-yellow-700 text-sm">
            AI özelliklerini kullanmak için OpenAI API anahtarının bot ayarlarına eklenmesi gerekir. 
            API anahtarı yoksa "Yapay zeka şu anda çevrimdışı." mesajı gösterilir.
          </p>
        </div>
      </div>
    </div>
  );
};

const Settings = ({ selectedGuild }) => {
  const [settings, setSettings] = useState({
    prefix: "!",
    log_channel_id: "",
    auto_role_id: "",
    warning_role_id: "",
    jail_role_id: "",
    anti_spam: true,
    anti_swear: true,
    anti_link: true,
    ai_enabled: true,
    ai_channels: []
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedGuild) {
      fetchSettings();
    }
  }, [selectedGuild]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/guilds/${selectedGuild.id}/settings`);
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/guilds/${selectedGuild.id}/settings`, {
        ...settings,
        guild_id: selectedGuild.id
      });
      alert('Ayarlar başarıyla kaydedildi!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Ayarlar kaydedilirken hata oluştu!');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedGuild) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200 text-center">
          <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Sunucu Seçin</h3>
          <p className="text-gray-600">
            Bot ayarlarını yönetmek için sol taraftan bir sunucu seçin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {selectedGuild.name} - Bot Ayarları
        </h1>
        <p className="text-gray-600">
          Bot davranışlarını ve özelliklerini özelleştirin
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Genel Ayarlar</h2>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Komut Öneki
            </label>
            <input
              type="text"
              value={settings.prefix}
              onChange={(e) => setSettings({...settings, prefix: e.target.value})}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="!"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Log Kanalı ID
            </label>
            <input
              type="text"
              value={settings.log_channel_id}
              onChange={(e) => setSettings({...settings, log_channel_id: e.target.value})}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="123456789012345678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Otomatik Rol ID
            </label>
            <input
              type="text"
              value={settings.auto_role_id}
              onChange={(e) => setSettings({...settings, auto_role_id: e.target.value})}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="123456789012345678"
            />
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Koruma Ayarları</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-700">Spam Koruması</label>
                  <p className="text-sm text-gray-600">Hızlı mesaj gönderimini engeller</p>
                </div>
                <button
                  onClick={() => setSettings({...settings, anti_spam: !settings.anti_spam})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.anti_spam ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.anti_spam ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-700">Küfür Koruması</label>
                  <p className="text-sm text-gray-600">Kötü sözcükleri otomatik siler</p>
                </div>
                <button
                  onClick={() => setSettings({...settings, anti_swear: !settings.anti_swear})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.anti_swear ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.anti_swear ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-700">Link Koruması</label>
                  <p className="text-sm text-gray-600">İzinsiz linkleri engeller</p>
                </div>
                <button
                  onClick={() => setSettings({...settings, anti_link: !settings.anti_link})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.anti_link ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.anti_link ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-700">AI Sohbet</label>
                  <p className="text-sm text-gray-600">ChatGPT entegrasyonunu etkinleştirir</p>
                </div>
                <button
                  onClick={() => setSettings({...settings, ai_enabled: !settings.ai_enabled})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.ai_enabled ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.ai_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4" />
                  Ayarları Kaydet
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Dashboard component
const DashboardMain = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [guilds, setGuilds] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGuilds();
  }, []);

  const fetchGuilds = async () => {
    try {
      const response = await axios.get(`${API}/guilds`);
      setGuilds(response.data.guilds);
      if (response.data.guilds.length > 0) {
        setSelectedGuild(response.data.guilds[0]);
      }
    } catch (error) {
      console.error('Error fetching guilds:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard selectedGuild={selectedGuild} />;
      case 'moderation':
        return <Moderation selectedGuild={selectedGuild} />;
      case 'settings':
        return <Settings selectedGuild={selectedGuild} />;
      case 'ai':
        return <AIManagement selectedGuild={selectedGuild} />;
      default:
        return <Dashboard selectedGuild={selectedGuild} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Sunucular yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        guilds={guilds}
        selectedGuild={selectedGuild}
        setSelectedGuild={setSelectedGuild}
      />
      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  );
};

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = React.useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

// Main App component
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardMain />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;