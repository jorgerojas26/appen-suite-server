export const mutateTaskData = (collecting_task_list, taskId, key, value) => {
    return collecting_task_list.map(task => {
        if (task.id === taskId) {
            task[key] = value;
        }

        return task;
    });
};

export const getTaskValue = (collecting_task_list, taskId, key) => {
    const task = collecting_task_list.find(task => task.id === taskId);
    const value = task[key];

    return value;
};

export const removeTaskFromList = (collecting_task_list, taskId) => {
    return collecting_task_list.filter(task => task.id !== taskId);
};

export const pauseAllTasks = collecting_task_list => {
    return collecting_task_list.map(task => {
        task.status = 'paused';

        return task;
    });
};
