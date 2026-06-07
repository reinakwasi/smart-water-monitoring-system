import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const CustomAlert = ({ visible, type = 'info', title, message, buttons = [], onDismiss }) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return { name: 'check-circle', color: '#10B981' };
      case 'error':
        return { name: 'error', color: '#EF4444' };
      case 'warning':
        return { name: 'warning', color: '#F59E0B' };
      case 'info':
      default:
        return { name: 'info', color: '#0891B2' };
    }
  };

  const icon = getIcon();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={[styles.iconContainer, { backgroundColor: `${icon.color}15` }]}>
              <MaterialIcons name={icon.name} size={40} color={icon.color} />
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            <View style={styles.buttonContainer}>
              {buttons.length > 0 ? (
                buttons.map((button, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      button.style === 'cancel' ? styles.cancelButton : styles.primaryButton,
                      buttons.length > 1 && index === 0 && styles.buttonMarginRight
                    ]}
                    onPress={() => {
                      if (button.onPress) button.onPress();
                      if (onDismiss) onDismiss();
                    }}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        button.style === 'cancel' ? styles.cancelText : styles.primaryText
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={onDismiss}
                >
                  <Text style={styles.primaryText}>OK</Text>
                </TouchableOpacity>
              )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#0891B2',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  buttonMarginRight: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  cancelText: {
    color: '#6B7280',
  },
});

export default CustomAlert;
