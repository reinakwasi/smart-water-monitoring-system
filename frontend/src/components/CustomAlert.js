import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const ALERT_STYLES = {
  success: { icon: 'check-circle', color: '#059669', soft: '#D1FAE5', label: 'Success' },
  error: { icon: 'error-outline', color: '#DC2626', soft: '#FEE2E2', label: 'Error' },
  warning: { icon: 'warning-amber', color: '#D97706', soft: '#FEF3C7', label: 'Warning' },
  info: { icon: 'info-outline', color: '#0891B2', soft: '#CFFAFE', label: 'Notice' },
};

const getButtonStyle = (button, type) => {
  if (button.style === 'cancel') {
    return {
      button: [styles.button, styles.cancelButton],
      text: [styles.buttonText, styles.cancelText],
    };
  }

  if (button.style === 'destructive') {
    return {
      button: [styles.button, styles.destructiveButton],
      text: [styles.buttonText, styles.primaryText],
    };
  }

  const accent = ALERT_STYLES[type]?.color || ALERT_STYLES.info.color;
  return {
    button: [styles.button, styles.primaryButton, { backgroundColor: accent }],
    text: [styles.buttonText, styles.primaryText],
  };
};

const CustomAlert = ({ visible, type = 'info', title, message, buttons = [], onDismiss }) => {
  const alertStyle = ALERT_STYLES[type] || ALERT_STYLES.info;
  const actionButtons = buttons.length > 0 ? buttons : [{ text: 'OK' }];

  const handlePress = button => {
    if (button.onPress) button.onPress();
    if (onDismiss) onDismiss();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={[styles.accentBar, { backgroundColor: alertStyle.color }]} />
          <View style={styles.content}>
            <View style={[styles.iconContainer, { backgroundColor: alertStyle.soft }]}>
              <MaterialIcons name={alertStyle.icon} size={34} color={alertStyle.color} />
            </View>

            <Text style={[styles.kicker, { color: alertStyle.color }]}>{alertStyle.label}</Text>
            <Text style={styles.title}>{title}</Text>
            {!!message && <Text style={styles.message}>{message}</Text>}

            <View style={[styles.buttonContainer, actionButtons.length > 2 ? styles.stackedButtons : null]}>
              {actionButtons.map((button, index) => {
                const buttonStyle = getButtonStyle(button, type);
                return (
                  <TouchableOpacity
                    key={`${button.text}-${index}`}
                    style={[
                      ...buttonStyle.button,
                      actionButtons.length > 1 && actionButtons.length <= 2 && index === 0 ? styles.buttonGap : null,
                      actionButtons.length > 2 && index < actionButtons.length - 1 ? styles.stackedButtonGap : null,
                    ]}
                    onPress={() => handlePress(button)}
                    activeOpacity={0.85}
                  >
                    <Text style={buttonStyle.text}>{button.text || 'OK'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 12,
  },
  accentBar: {
    height: 5,
    width: '100%',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  stackedButtons: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  primaryButton: {
    backgroundColor: '#0891B2',
  },
  destructiveButton: {
    backgroundColor: '#DC2626',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  buttonGap: {
    marginRight: 10,
  },
  stackedButtonGap: {
    marginBottom: 10,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  cancelText: {
    color: '#475569',
  },
});

export default CustomAlert;
