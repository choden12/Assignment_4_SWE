import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Switch,
  ScrollView,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  requestNotificationPermissions,
  scheduleTaskReminder,
  scheduleDailyReminder,
  cancelAllNotifications,
  sendTestNotification,
  getExpoPushToken,
} from './services/notificationService';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [dailyReminder, setDailyReminder] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pushToken, setPushToken] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Initialize notifications on app start
  useEffect(() => {
    initializeApp();
    setupNotificationListeners();
    
    // Load saved tasks
    loadTasks();
  }, []);

  const initializeApp = async () => {
    const granted = await requestNotificationPermissions();
    setPermissionsGranted(granted);
    
    if (granted) {
      const token = await getExpoPushToken();
      setPushToken(token);
    }
  };

  const setupNotificationListeners = () => {
    // Handle notification responses (when user taps on notification)
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const { data } = response.notification.request.content;
      console.log('Notification tapped:', data);
      
      if (data?.taskId) {
        const task = tasks.find(t => t.id === data.taskId);
        if (task) {
          setSelectedTask(task);
          setDetailModalVisible(true);
        }
      }
    });

    // Handle notifications received while app is in foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
      Alert.alert(
        notification.request.content.title,
        notification.request.content.body
      );
    });

    return () => {
      subscription.remove();
      foregroundSubscription.remove();
    };
  };

  const loadTasks = () => {
    // Load tasks from AsyncStorage would go here
    // For demo, using sample tasks
    const sampleTasks = [
      {
        id: '1',
        title: 'Complete Assignment',
        description: 'Finish push notification app',
        dueDate: new Date(Date.now() + 3600000).toISOString(),
        completed: false,
        notificationId: null,
      },
    ];
    setTasks(sampleTasks);
  };

  const addTask = async () => {
    if (!taskTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    if (!taskDueDate) {
      Alert.alert('Error', 'Please enter a due date');
      return;
    }

    setLoading(true);

    const newTask = {
      id: Date.now().toString(),
      title: taskTitle.trim(),
      description: taskDescription.trim(),
      dueDate: new Date(taskDueDate).toISOString(),
      completed: false,
      notificationId: null,
      createdAt: new Date().toISOString(),
    };

    // Schedule notification for this task
    const notificationId = await scheduleTaskReminder(
      newTask.id,
      newTask.title,
      newTask.dueDate
    );

    if (notificationId) {
      newTask.notificationId = notificationId;
    }

    setTasks([...tasks, newTask]);
    setTaskTitle('');
    setTaskDescription('');
    setTaskDueDate('');
    setModalVisible(false);
    
    Alert.alert('Success', 'Task added with reminder!');
    setLoading(false);
  };

  const deleteTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (task?.notificationId) {
      await cancelAllNotifications(); // Simplified - in production, cancel specific
    }
    
    setTasks(tasks.filter(t => t.id !== taskId));
    Alert.alert('Deleted', 'Task has been removed');
  };

  const toggleTaskComplete = async (taskId) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );
    setTasks(updatedTasks);
    
    const task = updatedTasks.find(t => t.id === taskId);
    if (task.completed && task.notificationId) {
      await cancelAllNotifications();
      Alert.alert('Great job!', 'Task marked as complete');
    }
  };

  const toggleDailyReminder = async (value) => {
    setDailyReminder(value);
    if (value) {
      await scheduleDailyReminder(20, 0); // 11:00 AM
      Alert.alert('Daily Reminder', 'You will be reminded daily at 11:00 AM');
    } else {
      await cancelAllNotifications();
      Alert.alert('Daily Reminder', 'Daily reminders disabled');
    }
  };

  const handleTestNotification = async () => {
    const success = await sendTestNotification();
    if (success) {
      Alert.alert('Test Sent', 'Check your notification tray!');
    } else {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const getTimeRemaining = (dueDate) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = due - now;
    
    if (diff <= 0) return 'Overdue';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (3600000)) / 60000);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} left`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} left`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''} left`;
    }
  };

  const renderTask = ({ item }) => (
    <TouchableOpacity
      style={[styles.taskCard, item.completed && styles.taskCompleted]}
      onPress={() => {
        setSelectedTask(item);
        setDetailModalVisible(true);
      }}
    >
      <View style={styles.taskHeader}>
        <View style={styles.taskInfo}>
          <Text style={[styles.taskTitle, item.completed && styles.textCompleted]}>
            {item.title}
          </Text>
          <Text style={styles.taskDueDate}>
            ⏰ {getTimeRemaining(item.dueDate)}
          </Text>
        </View>
        <View style={styles.taskActions}>
          <TouchableOpacity
            style={[styles.checkButton, item.completed && styles.checked]}
            onPress={() => toggleTaskComplete(item.id)}
          >
            <Text style={styles.checkButtonText}>
              {item.completed ? '✓' : '○'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteTask(item.id)}
          >
            <Text style={styles.deleteButtonText}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
      {item.description ? (
        <Text style={styles.taskDescription}>{item.description}</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}> Task Reminder App</Text>
        <View style={styles.statusBar}>
          <View style={[styles.statusDot, permissionsGranted && styles.statusActive]} />
          <Text style={styles.statusText}>
            {permissionsGranted ? 'Notifications Enabled' : 'Notifications Disabled'}
          </Text>
        </View>
        {pushToken && (
          <Text style={styles.tokenText} numberOfLines={1}>
            Token: {pushToken.substring(0, 30)}...
          </Text>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{tasks.length}</Text>
          <Text style={styles.statLabel}>Total Tasks</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {tasks.filter(t => !t.completed && new Date(t.dueDate) > new Date()).length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {tasks.filter(t => new Date(t.dueDate) < new Date() && !t.completed).length}
          </Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
      </View>

      {/* Daily Reminder Toggle */}
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>Daily Reminder</Text>
            <Text style={styles.settingSubtext}>Get reminded every day at 11:00 AM</Text>
          </View>
          <Switch
            value={dailyReminder}
            onValueChange={toggleDailyReminder}
            trackColor={{ false: '#767577', true: '#34C759' }}
          />
        </View>
      </View>

      {/* Task List */}
      <View style={styles.taskListContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>📋 My Tasks</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.addButtonText}>+ New Task</Text>
          </TouchableOpacity>
        </View>

        {tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyText}>No tasks yet</Text>
            <Text style={styles.emptySubtext}>Tap + New Task to get started</Text>
          </View>
        ) : (
          <FlatList
            data={tasks}
            renderItem={renderTask}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>


      {/* Add Task Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Task</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Task title *"
              value={taskTitle}
              onChangeText={setTaskTitle}
              maxLength={100}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              value={taskDescription}
              onChangeText={setTaskDescription}
              multiline
              numberOfLines={3}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Due date (YYYY-MM-DD )"
              value={taskDueDate}
              onChangeText={setTaskDueDate}
              autoCapitalize="none"
            />
            
            <Text style={styles.dateHint}>
              Format: 2024-12-31
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={addTask}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Task</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Task Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTask && (
              <>
                <Text style={styles.modalTitle}>{selectedTask.title}</Text>
                
                {selectedTask.description ? (
                  <Text style={styles.detailText}>{selectedTask.description}</Text>
                ) : null}
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Due Date:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedTask.dueDate).toLocaleString()}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={[
                    styles.detailValue,
                    selectedTask.completed && styles.completedText
                  ]}>
                    {selectedTask.completed ? '✓ Completed' : '○ Pending'}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Time Left:</Text>
                  <Text style={styles.detailValue}>
                    {getTimeRemaining(selectedTask.dueDate)}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setDetailModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
    marginRight: 8,
  },
  statusActive: {
    backgroundColor: '#4cd964',
  },
  statusText: {
    color: 'white',
    fontSize: 14,
  },
  tokenText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
    backgroundColor: 'white',
    margin: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  settingSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  taskListContainer: {
    flex: 1,
    marginHorizontal: 15,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  taskCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  taskCompleted: {
    backgroundColor: '#f0f9f0',
    opacity: 0.8,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  textCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  taskDueDate: {
    fontSize: 12,
    color: '#FF3B30',
  },
  taskDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checked: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  checkButtonText: {
    fontSize: 18,
    color: '#007AFF',
  },
  deleteButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 18,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  testButton: {
    backgroundColor: '#FF9500',
    marginHorizontal: 15,
    marginBottom: 20,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  detailText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
  },
  completedText: {
    color: '#34C759',
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});