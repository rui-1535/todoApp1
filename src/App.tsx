import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided, DraggableStateSnapshot, DroppableStateSnapshot } from 'react-beautiful-dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { dbPromise } from './db';

type TaskStatus = 'not_started' | 'in_progress' | 'completed';

interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface Label {
  name: string;
  color: string;
}

const DEFAULT_LABELS: Label[] = [
  { name: '重要', color: '#EF4444' },
  { name: '緊急', color: '#F59E0B' },
  { name: '進行中', color: '#3B82F6' },
  { name: '完了', color: '#10B981' },
];

const TASK_STATUSES: TaskStatus[] = ['not_started', 'in_progress', 'completed'];

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [labels, setLabels] = useState<Label[]>(DEFAULT_LABELS);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    description: '',
    status: 'not_started',
    labels: [],
  });

  useEffect(() => {
    const loadData = async () => {
      const db = await dbPromise;
      const loadedTasks = await db.getAll('tasks');
      const loadedLabels = await db.getAll('labels');
      setTasks(loadedTasks.map(task => ({
        ...task,
        id: task.id || 0,
      })));
      setLabels(loadedLabels.length > 0 ? loadedLabels : DEFAULT_LABELS);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const allCompleted = tasks.length > 0 && tasks.every(task => task.status === 'completed');
    if (allCompleted) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  }, [tasks]);

  const handleAddTask = async () => {
    if (!newTask.title) return;

    const task: Omit<Task, 'id'> = {
      title: newTask.title,
      description: newTask.description || '',
      status: newTask.status || 'not_started',
      labels: newTask.labels || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const db = await dbPromise;
    const id = await db.add('tasks', task);
    
    setTasks([...tasks, { ...task, id }]);
    setNewTask({
      title: '',
      description: '',
      status: 'not_started',
      labels: [],
    });
    setIsAddingTask(false);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const taskId = parseInt(result.draggableId);
    const newStatus = result.destination.droppableId as TaskStatus;

    if (!TASK_STATUSES.includes(newStatus)) {
      console.error('Invalid task status:', newStatus);
      return;
    }

    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) {
      console.error('Task not found:', taskId);
      return;
    }

    const updatedTasks = tasks.map(task =>
      task.id === taskId
        ? { ...task, status: newStatus, updatedAt: new Date() }
        : task
    );

    setTasks(updatedTasks);

    try {
      const db = await dbPromise;
      await db.put('tasks', {
        ...taskToUpdate,
        status: newStatus,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const toggleLabel = (labelName: string) => {
    setNewTask(prev => ({
      ...prev,
      labels: prev.labels?.includes(labelName)
        ? prev.labels.filter(l => l !== labelName)
        : [...(prev.labels || []), labelName]
    }));
  };

  const renderTaskCard = (provided: DraggableProvided, snapshot: DraggableStateSnapshot, task: Task) => (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={`p-4 mb-2 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-move transition-shadow ${
        snapshot.isDragging ? 'shadow-lg' : ''
      }`}
    >
      <h3 className="font-medium">{task.title}</h3>
      <p className="text-sm opacity-75">{task.description}</p>
      <div className="flex flex-wrap gap-2 mt-2">
        {task.labels.map(label => (
          <span
            key={label}
            className="px-2 py-1 text-xs rounded-full text-white"
            style={{
              backgroundColor: labels.find(l => l.name === label)?.color || '#E5E7EB'
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );

  const renderDroppableColumn = (provided: DroppableProvided, snapshot: DroppableStateSnapshot, status: TaskStatus) => (
    <div
      ref={provided.innerRef}
      {...provided.droppableProps}
      className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg"
    >
      <h2 className="text-xl font-semibold mb-4 capitalize">
        {status.replace('_', ' ')}
      </h2>
      {tasks
        .filter(task => task.status === status)
        .map((task, index) => (
          <Draggable
            key={task.id}
            draggableId={String(task.id)}
            index={index}
          >
            {(provided, snapshot) => renderTaskCard(provided, snapshot, task)}
          </Draggable>
        ))}
      {provided.placeholder}
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDarkMode ? 'dark bg-background-dark text-text-dark' : 'bg-background-light text-text-light'
    }`}>
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Todo App</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setIsAddingTask(true)}
              className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
            >
              タスクを追加
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg bg-primary-light dark:bg-primary-dark text-white"
            >
              {isDarkMode ? '🌞' : '🌙'}
            </button>
          </div>
        </header>

        <AnimatePresence>
          {isAddingTask && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">新しいタスク</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">タイトル</label>
                    <input
                      type="text"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      placeholder="タスクのタイトル"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">説明</label>
                    <textarea
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      placeholder="タスクの説明"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">ラベル</label>
                    <div className="flex flex-wrap gap-2">
                      {labels.map(label => (
                        <button
                          key={label.name}
                          onClick={() => toggleLabel(label.name)}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            newTask.labels?.includes(label.name)
                              ? 'text-white'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                          style={{
                            backgroundColor: newTask.labels?.includes(label.name)
                              ? label.color
                              : 'transparent',
                            border: `1px solid ${label.color}`
                          }}
                        >
                          {label.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsAddingTask(false)}
                      className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleAddTask}
                      className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                    >
                      追加
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TASK_STATUSES.map((status) => (
              <Droppable key={status} droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg ${
                      snapshot.isDraggingOver ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <h2 className="text-xl font-semibold mb-4 capitalize">
                      {status.replace('_', ' ')}
                    </h2>
                    {tasks
                      .filter(task => task.status === status)
                      .map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={String(task.id)}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-4 mb-2 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-move transition-shadow ${
                                snapshot.isDragging ? 'shadow-lg' : ''
                              }`}
                            >
                              <h3 className="font-medium">{task.title}</h3>
                              <p className="text-sm opacity-75">{task.description}</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {task.labels.map(label => (
                                  <span
                                    key={label}
                                    className="px-2 py-1 text-xs rounded-full text-white"
                                    style={{
                                      backgroundColor: labels.find(l => l.name === label)?.color || '#E5E7EB'
                                    }}
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>

        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg"
            >
              おめでとうございます！
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default App; 