/**
 * Custom Alert Helper
 * Provides a consistent, styled alert experience across the app
 */

let alertCallback = null;

export const setAlertHandler = (callback) => {
  alertCallback = callback;
};

export const showAlert = (type, title, message, buttons = []) => {
  if (alertCallback) {
    alertCallback({ type, title, message, buttons });
  }
};

// Convenience methods
export const showSuccess = (title, message, buttons = []) => {
  showAlert('success', title, message, buttons);
};

export const showError = (title, message, buttons = []) => {
  showAlert('error', title, message, buttons);
};

export const showWarning = (title, message, buttons = []) => {
  showAlert('warning', title, message, buttons);
};

export const showInfo = (title, message, buttons = []) => {
  showAlert('info', title, message, buttons);
};
