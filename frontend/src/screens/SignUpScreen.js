import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { authAPI } from '../services/api';
import { showAppAlert } from '../utils/alertHelper';

const VALID_TLDS = [
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'io', 'co', 'uk', 'us', 'ca', 'au', 'de', 'fr',
  'jp', 'cn', 'in', 'br', 'ru', 'za', 'ng', 'ke', 'gh', 'tz', 'ug', 'zm', 'zw', 'bw', 'mw', 'rw',
  'info', 'biz', 'name', 'pro', 'aero', 'asia', 'cat', 'coop', 'jobs', 'mobi', 'museum', 'tel',
  'travel', 'xxx', 'ac', 'ad', 'ae', 'af', 'ag', 'ai', 'al', 'am', 'ao', 'aq', 'ar', 'as', 'at',
  'aw', 'ax', 'az', 'ba', 'bb', 'bd', 'be', 'bf', 'bg', 'bh', 'bi', 'bj', 'bm', 'bn', 'bo', 'bs',
  'bt', 'bv', 'by', 'bz', 'cc', 'cd', 'cf', 'cg', 'ch', 'ci', 'ck', 'cl', 'cm', 'cr', 'cu', 'cv',
  'cw', 'cx', 'cy', 'cz', 'dj', 'dk', 'dm', 'do', 'dz', 'ec', 'ee', 'eg', 'er', 'es', 'et', 'eu',
  'fi', 'fj', 'fk', 'fm', 'fo', 'ga', 'gd', 'ge', 'gf', 'gg', 'gi', 'gl', 'gm', 'gn', 'gp', 'gq',
  'gr', 'gs', 'gt', 'gu', 'gw', 'gy', 'hk', 'hm', 'hn', 'hr', 'ht', 'hu', 'id', 'ie', 'il', 'im',
  'iq', 'ir', 'is', 'it', 'je', 'jm', 'jo', 'kg', 'kh', 'ki', 'km', 'kn', 'kp', 'kr', 'kw', 'ky',
  'kz', 'la', 'lb', 'lc', 'li', 'lk', 'lr', 'ls', 'lt', 'lu', 'lv', 'ly', 'ma', 'mc', 'md', 'me',
  'mg', 'mh', 'mk', 'ml', 'mm', 'mn', 'mo', 'mp', 'mq', 'mr', 'ms', 'mt', 'mu', 'mv', 'mx', 'my',
  'mz', 'na', 'nc', 'ne', 'nf', 'ni', 'nl', 'no', 'np', 'nr', 'nu', 'nz', 'om', 'pa', 'pe', 'pf',
  'pg', 'ph', 'pk', 'pl', 'pm', 'pn', 'pr', 'ps', 'pt', 'pw', 'py', 'qa', 're', 'ro', 'rs', 'sa',
  'sb', 'sc', 'sd', 'se', 'sg', 'sh', 'si', 'sj', 'sk', 'sl', 'sm', 'sn', 'so', 'sr', 'ss', 'st',
  'sv', 'sx', 'sy', 'sz', 'tc', 'td', 'tf', 'tg', 'th', 'tj', 'tk', 'tl', 'tm', 'tn', 'to', 'tr',
  'tt', 'tv', 'tw', 'ua', 'uy', 'uz', 'va', 'vc', 've', 'vg', 'vi', 'vn', 'vu', 'wf', 'ws', 'ye',
  'yt', 'app', 'dev', 'tech', 'online', 'site', 'website', 'store', 'shop', 'blog', 'cloud', 'digital', 'email',
];

const FieldLabel = ({ children }) => (
  <Text className="text-xs font-bold text-slate-500 mb-2 tracking-wider">{children}</Text>
);

const SignUpScreen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);

  const busy = loading;

  const validateEmail = value => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!value || value.length < 5) return { valid: false, message: 'Email is too short' };
    if (!emailRegex.test(value)) return { valid: false, message: 'Invalid email format' };
    if (value.startsWith('.') || value.endsWith('.')) return { valid: false, message: 'Email cannot start or end with a dot' };
    if (value.includes('..')) return { valid: false, message: 'Email cannot contain consecutive dots' };
    if (!value.includes('@')) return { valid: false, message: 'Email must contain @' };

    const parts = value.split('@');
    if (parts.length !== 2) return { valid: false, message: 'Email must have exactly one @' };
    if (parts[0].length === 0) return { valid: false, message: 'Email username cannot be empty' };
    if (parts[1].length === 0) return { valid: false, message: 'Email domain cannot be empty' };

    const domain = parts[1];
    if (!domain.includes('.')) return { valid: false, message: 'Email domain must contain a dot' };
    if (domain.startsWith('.') || domain.endsWith('.')) return { valid: false, message: 'Invalid email domain format' };

    const tld = domain.split('.').pop().toLowerCase();
    const commonTypos = { cog: 'com', con: 'com', cm: 'com', cpm: 'com', comm: 'com', og: 'org', ogr: 'org', rog: 'org', nte: 'net', ent: 'net', nett: 'net' };
    if (commonTypos[tld]) return { valid: false, message: `Invalid domain ".${tld}". Did you mean ".${commonTypos[tld]}"?` };
    if (!VALID_TLDS.includes(tld)) return { valid: false, message: `Invalid email domain ".${tld}". Please use a valid domain like .com, .org, .net` };
    return { valid: true, message: '' };
  };

  const calculatePasswordStrength = value => {
    let strength = 0;
    const feedback = [];
    if (value.length >= 8) strength += 1;
    else feedback.push('at least 8 characters');
    if (/[A-Z]/.test(value)) strength += 1;
    else feedback.push('one uppercase letter');
    if (/[a-z]/.test(value)) strength += 1;
    else feedback.push('one lowercase letter');
    if (/[0-9]/.test(value)) strength += 1;
    else feedback.push('one number');
    if (/[^A-Za-z0-9]/.test(value)) strength += 1;
    else feedback.push('one special character (!@#$%^&*)');
    if (value.length >= 12) strength += 1;
    if (value.length >= 16) strength += 1;

    if (strength >= 5) return { level: 'Strong', color: '#10B981', width: '100%', feedback: 'Great password!', isValid: true };
    if (strength >= 3) return { level: 'Medium', color: '#F59E0B', width: '66%', feedback: `Add ${feedback.join(', ')}`, isValid: false };
    return { level: value ? 'Weak' : '', color: '#EF4444', width: value ? '33%' : '0%', feedback: feedback.length ? `Add ${feedback.join(', ')}` : '', isValid: false };
  };

  const checkFormValidity = (name, emailValue, passwordValue, confirmPasswordValue) => {
    const nameValid = name.trim().length >= 3;
    const emailValidation = validateEmail(emailValue);
    const passwordStrengthCheck = calculatePasswordStrength(passwordValue);
    const passwordsMatch = passwordValue === confirmPasswordValue && confirmPasswordValue.length > 0;
    setIsFormValid(nameValid && emailValidation.valid && passwordStrengthCheck.isValid && passwordsMatch);
  };

  const handleFullNameChange = text => {
    setFullName(text);
    checkFormValidity(text, email, password, confirmPassword);
  };

  const handleEmailChange = text => {
    setEmail(text);
    if (text.length > 0) {
      const validation = validateEmail(text);
      setEmailError(validation.valid ? '' : validation.message);
    } else {
      setEmailError('');
    }
    checkFormValidity(fullName, text, password, confirmPassword);
  };

  const handlePasswordChange = text => {
    setPassword(text);
    if (text.length > 0) {
      const strength = calculatePasswordStrength(text);
      setPasswordStrength(strength.level);
      setPasswordError(strength.isValid ? '' : strength.feedback);
    } else {
      setPasswordStrength('');
      setPasswordError('');
    }
    setConfirmPasswordError(confirmPassword && text !== confirmPassword ? 'Passwords do not match' : '');
    checkFormValidity(fullName, email, text, confirmPassword);
  };

  const handleConfirmPasswordChange = text => {
    setConfirmPassword(text);
    setConfirmPasswordError(text.length > 0 && text !== password ? 'Passwords do not match' : '');
    checkFormValidity(fullName, email, password, text);
  };

  const showCustomAlert = (title, message, type = 'warning') => {
    showAppAlert(title, message, [], type);
  };

  const handleSignUp = async () => {
    if (!fullName.trim() || fullName.trim().length < 3) {
      showCustomAlert('Name required', 'Please enter your full name with at least 3 characters.');
      return;
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      showCustomAlert('Invalid email', emailValidation.message);
      return;
    }

    const passwordStrengthCheck = calculatePasswordStrength(password);
    if (!passwordStrengthCheck.isValid) {
      showCustomAlert('Weak password', `Password is too weak. ${passwordStrengthCheck.feedback}`);
      return;
    }

    if (password !== confirmPassword) {
      showCustomAlert('Password mismatch', 'Passwords do not match. Please try again.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.register({
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        role: 'user',
      });
      navigation.navigate('OTPVerification', { email: email.trim().toLowerCase() });
    } catch (error) {
      if (error.response?.status === 409) {
        showCustomAlert('Account exists', 'An account with this email already exists. Please sign in instead.');
      } else if (error.response?.data?.detail) {
        showCustomAlert('Registration failed', error.response.data.detail, 'error');
      } else if (error.message === 'Network Error') {
        showCustomAlert('Connection error', 'Cannot connect right now. Please check your internet connection and try again.', 'error');
      } else {
        showCustomAlert('Registration not completed', 'The account could not be created. Please try again later.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };


  const passwordStatus = calculatePasswordStrength(password);

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="light-content" backgroundColor="#083B4C" />
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="bg-[#083B4C] pt-14 pb-9 px-6 relative overflow-hidden">
          <View className="absolute -top-20 -right-16 w-56 h-56 rounded-full bg-cyan-300/10" />
          <View className="absolute -bottom-24 -left-20 w-64 h-64 rounded-full bg-emerald-300/10" />

          <TouchableOpacity className="w-11 h-11 rounded-full bg-white/15 border border-white/20 items-center justify-center mb-6" onPress={() => navigation.navigate('Login')}>
            <MaterialIcons name="arrow-back" size={23} color="#FFFFFF" />
          </TouchableOpacity>

          <Text className="text-4xl font-extrabold text-white mb-3">Create account</Text>
          <Text className="text-base text-cyan-100 leading-6 mb-6">
            Create an account to check your water status and receive important warnings.
          </Text>
        </View>

        <View className="mx-5 -mt-5 rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
          <View className="mb-5">
            <FieldLabel>FULL NAME</FieldLabel>
            <View className="flex-row items-center bg-slate-50 rounded-xl border border-slate-200 px-4 h-14">
              <MaterialIcons name="person-outline" size={20} color="#64748B" />
              <TextInput className="flex-1 text-base text-slate-900 ml-3" placeholder="Your full name" placeholderTextColor="#94A3B8" value={fullName} onChangeText={handleFullNameChange} editable={!busy} />
            </View>
          </View>

          <View className="mb-5">
            <FieldLabel>EMAIL ADDRESS</FieldLabel>
            <View className={`flex-row items-center rounded-xl border px-4 h-14 ${emailError ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
              <MaterialCommunityIcons name="email-outline" size={20} color="#64748B" />
              <TextInput className="flex-1 text-base text-slate-900 ml-3" placeholder="you@example.com" placeholderTextColor="#94A3B8" value={email} onChangeText={handleEmailChange} keyboardType="email-address" autoCapitalize="none" editable={!busy} />
            </View>
            {emailError ? <Text className="text-red-600 text-xs mt-1.5 ml-1">{emailError}</Text> : null}
          </View>

          <View className="mb-5">
            <FieldLabel>PASSWORD</FieldLabel>
            <View className={`flex-row items-center rounded-xl border px-4 h-14 ${passwordError ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
              <MaterialIcons name="lock-outline" size={20} color="#64748B" />
              <TextInput className="flex-1 text-base text-slate-900 ml-3" placeholder="Min 8 characters" placeholderTextColor="#94A3B8" value={password} onChangeText={handlePasswordChange} secureTextEntry={!showPassword} editable={!busy} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={busy} className="p-1">
                <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            {password ? (
              <View className="mt-2">
                <View className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <View className="h-2 rounded-full" style={{ width: passwordStatus.width, backgroundColor: passwordStatus.color }} />
                </View>
                <View className="flex-row justify-between mt-1.5">
                  <Text className="text-xs text-slate-500">Password strength</Text>
                  <Text className="text-xs font-bold" style={{ color: passwordStatus.color }}>{passwordStrength}</Text>
                </View>
                {passwordError ? <Text className="text-red-600 text-xs mt-1">{passwordError}</Text> : null}
              </View>
            ) : null}
          </View>

          <View className="mb-6">
            <FieldLabel>CONFIRM PASSWORD</FieldLabel>
            <View className={`flex-row items-center rounded-xl border px-4 h-14 ${confirmPasswordError ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
              <MaterialIcons name="lock-outline" size={20} color="#64748B" />
              <TextInput className="flex-1 text-base text-slate-900 ml-3" placeholder="Re-enter your password" placeholderTextColor="#94A3B8" value={confirmPassword} onChangeText={handleConfirmPasswordChange} secureTextEntry={!showConfirmPassword} editable={!busy} />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} disabled={busy} className="p-1">
                <MaterialIcons name={showConfirmPassword ? 'visibility' : 'visibility-off'} size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            {confirmPasswordError ? <Text className="text-red-600 text-xs mt-1.5 ml-1">{confirmPasswordError}</Text> : null}
            {confirmPassword && !confirmPasswordError ? <Text className="text-green-600 text-xs mt-1.5 ml-1">Passwords match</Text> : null}
          </View>

          <TouchableOpacity className={`rounded-xl h-14 justify-center items-center mb-5 ${(busy || !isFormValid) ? 'bg-slate-400' : 'bg-[#0891B2]'}`} onPress={handleSignUp} disabled={busy || !isFormValid} activeOpacity={0.86}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white text-base font-extrabold">Create account</Text>}
          </TouchableOpacity>

          <View className="flex-row justify-center items-center">
            <Text className="text-sm text-slate-500">Already registered? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text className="text-sm text-[#0891B2] font-extrabold">Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default SignUpScreen;
