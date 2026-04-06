const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class TodoService {
  async getAllTodos(userId) {
    return prisma.todo.findMany({
      where: { user_id: userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createTodo(userId, title) {
    return prisma.todo.create({
      data: {
        title,
        user_id: userId,
      }
    });
  }

  async updateTodo(userId, todoId, data) {
    // Verify ownership
    const todo = await prisma.todo.findUnique({ where: { id: todoId } });
    if (!todo || todo.user_id !== userId) {
      throw new Error('Todo not found or unauthorized');
    }

    return prisma.todo.update({
      where: { id: todoId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.completed !== undefined && { completed: data.completed })
      }
    });
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
}

module.exports = new TodoService();
