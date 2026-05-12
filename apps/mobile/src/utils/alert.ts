import { Alert, Platform } from 'react-native';

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

/**
 * Cross-platform alert that works on both web (window.alert / window.confirm)
 * and native (React Native Alert).
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS === 'web') {
    const fullMessage = message ? `${title}\n\n${message}` : title;

    if (!buttons || buttons.length <= 1) {
      window.alert(fullMessage);
      buttons?.[0]?.onPress?.();
      return;
    }

    // Find destructive/confirm button (non-cancel)
    const confirmBtn = buttons.find(b => b.style !== 'cancel');
    const cancelBtn = buttons.find(b => b.style === 'cancel');

    if (buttons.length === 2) {
      const confirmed = window.confirm(fullMessage);
      if (confirmed) {
        confirmBtn?.onPress?.();
      } else {
        cancelBtn?.onPress?.();
      }
      return;
    }

    // 3+ buttons: show confirm with first non-cancel action listed
    const actionLabels = buttons
      .filter(b => b.style !== 'cancel')
      .map((b, i) => `${i + 1}. ${b.text}`)
      .join('\n');
    const confirmed = window.confirm(`${fullMessage}\n\n${actionLabels}\n\nPress OK to confirm first action, Cancel to dismiss.`);
    if (confirmed && confirmBtn) {
      confirmBtn.onPress?.();
    }
  } else {
    Alert.alert(
      title,
      message,
      buttons?.map(b => ({ text: b.text, style: b.style, onPress: b.onPress }))
    );
  }
}
