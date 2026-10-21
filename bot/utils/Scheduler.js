/**
 * Планировщик задач на основе setInterval.
 * @method addTask(name, callback, intervalMs) - Добавить задачу (заменяет существующую с тем же именем).
 * @method stopTask(name) - Остановить задачу.
 * @method stopAll() - Остановить все задачи.
 */
class Scheduler {
    constructor() {
        this.tasks = new Map();
    }

    addTask(name, callback, intervalMs) {
        this.stopTask(name);
        var id = setInterval(callback, intervalMs);
        this.tasks.set(name, id);
        return id;
    }

    stopTask(name) {
        if (this.tasks.has(name)) {
            clearInterval(this.tasks.get(name));
            this.tasks.delete(name);
        }
    }

    stopAll() {
        for (var id of this.tasks.values()) {
            clearInterval(id);
        }
        this.tasks.clear();
    }
}

export default Scheduler;
