import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { authAPI } from '../services/api';
import GoogleIcon from '../components/GoogleIcon';

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

  const VALID_TLDS = [
    'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
    'io', 'co', 'uk', 'us', 'ca', 'au', 'de', 'fr',
    'jp', 'cn', 'in', 'br', 'ru', 'za', 'ng', 'ke',
    'gh', 'tz', 'ug', 'zm', 'zw', 'bw', 'mw', 'rw',
    'info', 'biz', 'name', 'pro', 'aero', 'asia', 'cat',
    'coop', 'jobs', 'mobi', 'museum', 'tel', 'travel',
    'xxx', 'ac', 'ad', 'ae', 'af', 'ag', 'ai', 'al',
    'am', 'ao', 'aq', 'ar', 'as', 'at', 'aw', 'ax',
    'az', 'ba', 'bb', 'bd', 'be', 'bf', 'bg', 'bh',
    'bi', 'bj', 'bm', 'bn', 'bo', 'br', 'bs', 'bt',
    'bv', 'by', 'bz', 'cc', 'cd', 'cf', 'cg', 'ch',
    'ci', 'ck', 'cl', 'cm', 'co', 'cr', 'cu', 'cv',
    'cw', 'cx', 'cy', 'cz', 'dj', 'dk', 'dm', 'do',
    'dz', 'ec', 'ee', 'eg', 'er', 'es', 'et', 'eu',
    'fi', 'fj', 'fk', 'fm', 'fo', 'ga', 'gd', 'ge',
    'gf', 'gg', 'gi', 'gl', 'gm', 'gn', 'gp', 'gq',
    'gr', 'gs', 'gt', 'gu', 'gw', 'gy', 'hk', 'hm',
    'hn', 'hr', 'ht', 'hu', 'id', 'ie', 'il', 'im',
    'iq', 'ir', 'is', 'it', 'je', 'jm', 'jo', 'kg',
    'kh', 'ki', 'km', 'kn', 'kp', 'kr', 'kw', 'ky',
    'kz', 'la', 'lb', 'lc', 'li', 'lk', 'lr', 'ls',
    'lt', 'lu', 'lv', 'ly', 'ma', 'mc', 'md', 'me',
    'mg', 'mh', 'mk', 'ml', 'mm', 'mn', 'mo', 'mp',
    'mq', 'mr', 'ms', 'mt', 'mu', 'mv', 'mx', 'my',
    'mz', 'na', 'nc', 'ne', 'nf', 'ni', 'nl', 'no',
    'np', 'nr', 'nu', 'nz', 'om', 'pa', 'pe', 'pf',
    'pg', 'ph', 'pk', 'pl', 'pm', 'pn', 'pr', 'ps',
    'pt', 'pw', 'py', 'qa', 're', 'ro', 'rs', 'sa',
    'sb', 'sc', 'sd', 'se', 'sg', 'sh', 'si', 'sj',
    'sk', 'sl', 'sm', 'sn', 'so', 'sr', 'ss', 'st',
    'sv', 'sx', 'sy', 'sz', 'tc', 'td', 'tf', 'tg',
    'th', 'tj', 'tk', 'tl', 'tm', 'tn', 'to', 'tr',
    'tt', 'tv', 'tw', 'ua', 'uy', 'uz', 'va', 'vc',
    've', 'vg', 'vi', 'vn', 'vu', 'wf', 'ws', 'ye',
    'yt', 'app', 'dev', 'tech', 'online', 'site', 'website',
    'store', 'shop', 'blog', 'cloud', 'digital', 'email'
  ];

  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!email || email.length < 5) return { valid: false, message: 'Email is too short' };
    if (!emailRegex.test(email)) return { valid: false, message: 'Invalid email format' };
    
    if (email.startsWith('.') || email.endsWith('.')) {
      return { valid: false, message: 'Email cannot start or end with a dot' };
    }
    if (email.includes('..')) {
      return { valid: false, message: 'Email cannot contain consecutive dots' };
    }
    if (!email.includes('@')) {
      return { valid: false, message: 'Email must contain @' };
    }
    
    const parts = email.split('@');
    if (parts.length !== 2) {
      return { valid: false, message: 'Email must have exactly one @' };
    }
    if (parts[0].length === 0) {
      return { valid: false, message: 'Email username cannot be empty' };
    }
    if (parts[1].length === 0) {
      return { valid: false, message: 'Email domain cannot be empty' };
    }
    
    const domain = parts[1];
    if (!domain.includes('.')) {
      return { valid: false, message: 'Email domain must contain a dot' };
    }
    if (domain.startsWith('.') || domain.endsWith('.')) {
      return { valid: false, message: 'Invalid email domain format' };
    }
    
    const domainParts = domain.split('.');
    const tld = domainParts[domainParts.length - 1].toLowerCase();
    
    if (tld.length < 2) {
      return { valid: false, message: 'Invalid domain ending' };
    }
    
    const commonTypos = {
      'cog': 'com',
      'con': 'com',
      'cm': 'com',
      'cpm': 'com',
      'comm': 'com',
      'og': 'org',
      'ogr': 'org',
      'rog': 'org',
      'nte': 'net',
      'ent': 'net',
      'nett': 'net'
    };
    
    if (commonTypos[tld]) {
      return { 
        valid: false, 
        message: `Invalid domain ".${tld}". Did you mean ".${commonTypos[tld]}"?` 
      };
    }
    
    if (!VALID_TLDS.includes(tld)) {
      return { 
        valid: false, 
        message: `Invalid email domain ".${tld}". Please use a valid domain like .com, .org, .net` 
      };
    }
    
    return { valid: true, message: '' };
  };

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    const feedback = [];
    
    if (password.length >= 8) {
      strength += 1;
    } else {
      feedback.push('at least 8 characters');
    }
    
    if (/[A-Z]/.test(password)) {
      strength += 1;
    } else {
      feedback.push('one uppercase letter');
    }
    
    if (/[a-z]/.test(password)) {
      strength += 1;
    } else {
      feedback.push('one lowercase letter');
    }
    
    if (/[0-9]/.test(password)) {
      strength += 1;
    } else {
      feedback.push('one number');
    }
    
    if (/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(password)) {
      strength += 1;
    } else {
      feedback.push('one special character (!@#$%^&*)');
    }
    
    if (password.length >= 12) strength += 1;
    if (password.length >= 16) strength += 1;
    
    let level = 'Weak';
    let color = '#EF4444';
    
    if (strength >= 5) {
      level = 'Strong';
      color = '#10B981';
    } else if (strength >= 3) {
      level = 'Medium';
      color = '#F59E0B';
    }
    
    return {
      level,
      color,
      strength,
      feedback: feedback.length > 0 ? `Add ${feedback.join(', ')}` : 'Great password!',
      isValid: strength >= 5
    };
  };

  const handleEmailChange = (text) => {
    setEmail(text);
    
    if (text.length > 0) {
      const validation = validateEmail(text);
      setEmailError(validation.valid ? '' : validation.message);
    } else {
      setEmailError('');
    }
    
    checkFormValidity(fullName, text, password, confirmPassword);
  };

  const handlePasswordChange = (text) => {
    setPassword(text);
    
    if (text.length > 0) {
      const strength = calculatePasswordStrength(text);
      setPasswordStrength(strength.level);
      setPasswordError(strength.isValid ? '' : strength.feedback);
    } else {
      setPasswordStrength('');
      setPasswordError('');
    }
    
    if (confirmPassword && text !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
    }
    
    checkFormValidity(fullName, email, text, confirmPassword);
  };

  const handleConfirmPasswordChange = (text) => {
    setConfirmPassword(text);
    
    if (text.length > 0 && text !== password) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
    }
    
    checkFormValidity(fullName, email, password, text);
  };

  const handleFullNameChange = (text) => {
    setFullName(text);
    checkFormValidity(text, email, password, confirmPassword);
  };

  const checkFormValidity = (name, emailValue, passwordValue, confirmPasswordValue) => {
    const nameValid = name.trim().length >= 3;
    const emailValidation = validateEmail(emailValue);
    const passwordStrengthCheck = calculatePasswordStrength(passwordValue);
    const passwordsMatch = passwordValue === confirmPasswordValue && confirmPasswordValue.length > 0;
    
    setIsFormValid(
      nameValid && 
      emailValidation.valid && 
      passwordStrengthCheck.isValid &&
      passwordsMatch
    );
  };

  const showCustomAlert = (title, message, type = 'error') => {
    Alert.alert(
      title,
      message,
      [{ text: 'OK', style: type === 'success' ? 'default' : 'cancel' }],
      { cancelable: false }
    );
  };

  const handleSignUp = async () => {
    if (!fullName.trim() || fullName.trim().length < 3) {
      showCustomAlert('Validation Error', 'Please enter your full name (at least 3 characters)');
      return;
    }
    
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      showCustomAlert('Invalid Email', emailValidation.message);
      return;
    }
    
    const passwordStrengthCheck = calculatePasswordStrength(password);
    if (!passwordStrengthCheck.isValid) {
      showCustomAlert('Weak Password', `Password is too weak. ${passwordStrengthCheck.feedback}`);
      return;
    }

    if (password !== confirmPassword) {
      showCustomAlert('Password Mismatch', 'Passwords do not match. Please try again.');
      return;
    }

    setLoading(true);
    
    try {
      await authAPI.register({
        email: email.trim().toLowerCase(),
        password: password,
        full_name: fullName.trim(),
        role: 'user'
      });
      
      navigation.navigate('OTPVerification', { email: email.trim().toLowerCase() });
      
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.response?.status === 409) {
        showCustomAlert('Account Exists', 'An account with this email already exists. Please sign in instead.');
      } else if (error.response?.data?.detail) {
        showCustomAlert('Registration Failed', error.response.data.detail);
      } else if (error.message === 'Network Error') {
        showCustomAlert('Connection Error', 'Cannot connect to server. Please check your internet connection and try again.');
      } else {
        showCustomAlert('Registration Failed', 'Failed to create account. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    Alert.alert('Coming Soon', 'Google Sign-In will be available soon');
  };

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="light-content" backgroundColor="#0891B2" />
      
      <View className="bg-[#0891B2] pt-16 pb-12 px-6 relative overflow-hidden">
        <View className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10" />
        <Text className="text-4xl font-bold text-white mb-2">Create Account</Text>
        <Text className="text-base text-cyan-100">Start your water monitoring journey</Text>
      </View>

      <ScrollView className="flex-1 bg-white rounded-t-3xl -mt-5 px-6 pt-8" bounces={false}>
        <View className="mb-5">
          <Text className="text-xs font-semibold text-slate-600 mb-2.5 tracking-wider">FULL NAME</Text>
          <View className="flex-row items-center bg-slate-100 rounded-xl border border-slate-200 px-4 h-14">
            <MaterialIcons name="person-outline" size={20} color="#64748B" className="mr-3" />
            <TextInput
              className="flex-1 text-base text-slate-800"
              placeholder="Samuel Antwi-Adjei"
              placeholderTextColor="#94A3B8"
              value={fullName}
              onChangeText={handleFullNameChange}
              editable={!loading}
            />
          </View>
        </View>

        <View className="mb-5">
          <Text className="text-xs font-semibold text-slate-600 mb-2.5 tracking-wider">EMAIL ADDRESS</Text>
          <View className={`flex-row items-center rounded-xl border px-4 h-14 ${emailError ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-slate-100'}`}>
            <MaterialCommunityIcons name="email" size={20} color="#64748B" className="mr-3" />
            <TextInput
              className="flex-1 text-base text-slate-800"
              placeholder="samuel@email.com"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>
          {emailError ? <Text className="text-red-500 text-xs mt-1.5 ml-1">{emailError}</Text> : null}
        </View>

        <View className="mb-5">
          <Text className="text-xs font-semibold text-slate-600 mb-2.5 tracking-wider">PASSWORD</Text>
          <View className={`flex-row items-center rounded-xl border px-4 h-14 ${passwordError ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-slate-100'}`}>
            <MaterialIcons name="lock-outline" size={20} color="#64748B" className="mr-3" />
            <TextInput
              className="flex-1 text-base text-slate-800"
              placeholder="Min 8 characters"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={handlePasswordChange}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={loading}>
              <MaterialIcons 
                name={showPassword ? "visibility" : "visibility-off"} 
                size={20} 
                color="#64748B" 
              />
            </TouchableOpacity>
          </View>
          {passwordError ? <Text className="text-red-500 text-xs mt-1.5 ml-1">{passwordError}</Text> : null}
          {password && passwordStrength ? (
            <View className="flex-row items-center mt-1.5 ml-1">
              <Text className="text-xs text-slate-500">Password Strength: </Text>
              <Text className="text-xs font-semibold" style={{ color: calculatePasswordStrength(password).color }}>
                {passwordStrength}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mb-5">
          <Text className="text-xs font-semibold text-slate-600 mb-2.5 tracking-wider">CONFIRM PASSWORD</Text>
          <View className={`flex-row items-center rounded-xl border px-4 h-14 ${confirmPasswordError ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-slate-100'}`}>
            <MaterialIcons name="lock-outline" size={20} color="#64748B" className="mr-3" />
            <TextInput
              className="flex-1 text-base text-slate-800"
              placeholder="Re-enter your password"
              placeholderTextColor="#94A3B8"
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              secureTextEntry={!showConfirmPassword}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} disabled={loading}>
              <MaterialIcons 
                name={showConfirmPassword ? "visibility" : "visibility-off"} 
                size={20} 
                color="#64748B" 
              />
            </TouchableOpacity>
          </View>
          {confirmPasswordError ? <Text className="text-red-500 text-xs mt-1.5 ml-1">{confirmPasswordError}</Text> : null}
          {confirmPassword && !confirmPasswordError ? (
            <Text className="text-green-500 text-xs mt-1.5 ml-1">✓ Passwords match</Text>
          ) : null}
        </View>

        <TouchableOpacity 
          className={`rounded-xl h-14 justify-center items-center mt-2 mb-5 ${(loading || !isFormValid) ? 'bg-slate-400' : 'bg-[#0891B2]'}`}
          onPress={handleSignUp}
          disabled={loading || !isFormValid}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-semibold">Create Account</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row items-center my-5">
          <View className="flex-1 h-px bg-slate-200" />
          <Text className="mx-4 text-sm text-slate-400 font-medium">OR</Text>
          <View className="flex-1 h-px bg-slate-200" />
        </View>

        <TouchableOpacity 
          className="flex-row items-center justify-center bg-white rounded-xl border border-slate-200 h-14 mb-5"
          onPress={handleGoogleSignIn} 
          disabled={loading}
        >
          <GoogleIcon size={20} />
          <Text className="text-base text-slate-800 font-medium ml-3">Continue with Google</Text>
        </TouchableOpacity>

        <View className="flex-row justify-center items-center mt-1 mb-5">
          <Text className="text-sm text-slate-500">Already have an account? </Text>
          <TouchableOpacity onPress={handleSignIn}>
            <Text className="text-sm text-[#0891B2] font-semibold">Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default SignUpScreen;
