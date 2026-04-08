const prisma = require('../../config/db');
const { logActivity } = require('../../utils/activityLogger');

class TodoService {
  async getAllTodos(userId) {
    return prisma.todo.findMany({
      where: { user_id: userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createTodo(userId, title) {
    const todo = await prisma.todo.create({
      data: {
        title,
        user_id: userId,
      }
    });

    // Log activity
    await logActivity(userId, 'TASK_CREATED', `Created new task: "${title.substring(0, 20)}${title.length > 20 ? '...' : ''}"`);

    return todo;
  }

  async updateTodo(userId, todoId, data) {
    // Verify ownership
    const todo = await prisma.todo.findUnique({ where: { id: todoId } });
    if (!todo || todo.user_id !== userId) {
      throw new Error('Todo not found or unauthorized');
    }

    const updatedTodo = await prisma.todo.update({
      where: { id: todoId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.completed !== undefined && { completed: data.completed })
      }
    });

    // Log activity if completed
    if (data.completed === true) {
      await logActivity(userId, 'TASK_COMPLETED', `Completed task: "${updatedTodo.title.substring(0, 20)}${updatedTodo.title.length > 20 ? '...' : ''}"`);
    }

    return updatedTodo;
  }

  async deleteTodo(userId, todoId) {
    // Verify ownership
    const todo = await prisma.todo.findUnique({ where: { id: todoId } });
    if (!todo || todo.user_id !== userId) {
      throw new Error('Todo not found or unauthorized');
    }

    return prisma.todo.delete({
      where: { id: todoId }
    });
  }

  async deleteAllTodos(userId) {
    const result = await prisma.todo.deleteMany({
      where: { user_id: userId }
    });

    // Log activity
    await logActivity(userId, 'TASK_CLEARED', `Cleared all tasks (${result.count} items)`);

    return result;
  }
}

module.exports = new TodoService();
