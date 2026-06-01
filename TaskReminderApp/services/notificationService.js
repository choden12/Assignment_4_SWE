import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Setup notification channels for Android
export async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Task Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('alerts', {
      name: 'Urgent Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF0000',
      sound: 'default',
    });
  }
}

// Request notification permissions
export async function requestNotificationPermissions() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Notifications are required for task reminders. Please enable them in settings.'
      );
      return false;
    }
    
    await setupNotificationChannels();
    return true;
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return false;
  }
}

// Get Expo push token - FIXED: Proper projectId handling
export async function getExpoPushToken() {
  try {
    const permissionGranted = await requestNotificationPermissions();
    if (!permissionGranted) {
      return null;
    }

    // Get projectId from Constants (required for push notifications)
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || 
                      Constants.expoConfig?.projectId;
    
    if (!projectId) {
      console.warn('No projectId found. Push notifications will not work. For local notifications only.');
      // Return mock token for local-only functionality
      return 'local-only-mode';
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });
    console.log('Push Token:', token.data);
    return token.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    // Return null but don't break the app - local notifications still work
    return null;
  }
}

// Schedule a local notification
export async function scheduleTaskReminder(taskId, title, dueDate) {
  try {
    const dueDateTime = new Date(dueDate);
    const now = new Date();
    
    // Don't schedule for past dates
    if (dueDateTime <= now) {
      console.log('Due date is in the past, not scheduling');
      return null;
    }

    // Schedule notification 10 minutes before due time
    const reminderTime = new Date(dueDateTime.getTime() - 10 * 60 * 1000);
    
    // FIXED: Proper trigger format for time interval
    let trigger;
    if (reminderTime > now) {
      // Calculate seconds from now
      const secondsFromNow = Math.floor((reminderTime - now) / 1000);
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsFromNow,
      };
    } else {
      // If reminder time is in the past, schedule for 5 seconds from now
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
      };
    }
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Task Reminder',
        body: `"${title}" is due in 10 minutes!`,
        data: { taskId, screen: 'TaskDetail', type: 'reminder' },
        sound: true,
        priority: 'high',
      },
      trigger: trigger,
    });

    console.log(`Reminder scheduled for task ${taskId}, ID: ${notificationId}`);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling reminder:', error);
    return null;
  }
}

// FIXED: Schedule daily reminder with correct trigger format
export async function scheduleDailyReminder(hour = 20, minute = 0) {
  try {
    // Cancel existing daily reminders
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.content.data?.type === 'daily') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    // Calculate next trigger date
    const now = new Date();
    let triggerDate = new Date();
    triggerDate.setHours(hour, minute, 0, 0);
    
    if (triggerDate <= now) {
      triggerDate.setDate(triggerDate.getDate() + 1);
    }

    // FIXED: For daily recurring notifications, use TIME_INTERVAL with 24 hours
    // Calculate seconds until next trigger
    const secondsUntilTrigger = Math.floor((triggerDate - now) / 1000);
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📅 Daily Task Check',
        body: 'Review your tasks and plan your day!',
        data: { type: 'daily', screen: 'Tasks' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilTrigger,
        repeats: true,
      },
    });

    console.log(`Daily reminder scheduled for ${hour}:${minute}, first trigger in ${secondsUntilTrigger} seconds`);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling daily reminder:', error);
    return null;
  }
}

// Alternative: Schedule daily reminder using date-based trigger (iOS compatible)
export async function scheduleDailyReminderWithDate(hour = 20, minute = 0) {
  try {
    // Cancel existing reminders
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.content.data?.type === 'daily') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    // Create a date-based trigger for the next occurrence
    const now = new Date();
    let triggerDate = new Date();
    triggerDate.setHours(hour, minute, 0, 0);
    
    if (triggerDate <= now) {
      triggerDate.setDate(triggerDate.getDate() + 1);
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📅 Daily Task Check',
        body: 'Review your tasks and plan your day!',
        data: { type: 'daily', screen: 'Tasks' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate.getTime(),
      },
    });

    console.log(`Daily reminder scheduled for ${triggerDate.toLocaleString()}`);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling daily reminder with date:', error);
    return null;
  }
}

// Cancel a specific notification
export async function cancelNotification(notificationId) {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`Cancelled notification: ${notificationId}`);
    return true;
  } catch (error) {
    console.error('Error cancelling notification:', error);
    return false;
  }
}

// Cancel all notifications
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('All notifications cancelled');
    return true;
  } catch (error) {
    console.error('Error cancelling notifications:', error);
    return false;
  }
}

// Get all scheduled notifications (for debugging)
export async function getAllScheduledNotifications() {
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`Scheduled notifications: ${notifications.length}`);
    return notifications;
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
}

// Send test notification immediately
export async function sendTestNotification() {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Test Notification',
        body: 'Your notification system is working!',
        data: { type: 'test' },
        sound: true,
      },
      trigger: null, // Send immediately
    });
    console.log('Test notification sent:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('Error sending test notification:', error);
    return null;
  }
}