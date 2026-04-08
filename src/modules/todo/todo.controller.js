const todoService = require('./todo.service');

class TodoController {
  async getAllTodos(req, res, next) {
    try {
      const todos = await todoService.getAllTodos(req.user.id);
      res.status(200).json({ success: true, data: todos });
    } catch (error) {
      next(error);
    }
  }

  async createTodo(req, res, next) {
    try {
      const { title } = req.body;
      if (!title) {
        return res.status(400).json({ success: false, message: 'Title is required' });
      }
      const todo = await todoService.createTodo(req.user.id, title);
      
      // Emit real-time update
      const socketService = require('../../sockets/socketService');
      socketService.getIo().to(req.user.id).emit('todo_updated');

      res.status(201).json({ success: true, data: todo });
    } catch (error) {
      next(error);
    }
  }

  async updateTodo(req, res, next) {
    try {
      const { id } = req.params;
      const { title, completed } = req.body;
      const todo = await todoService.updateTodo(req.user.id, id, { title, completed });
      
      // Emit real-time update
      const socketService = require('../../sockets/socketService');
      socketService.getIo().to(req.user.id).emit('todo_updated');

      res.status(200).json({ success: true, data: todo });
    } catch (error) {
      next(error);
    }
  }

  async deleteTodo(req, res, next) {
    try {
      const { id } = req.params;
      await todoService.deleteTodo(req.user.id, id);
      
      // Emit real-time update
      const socketService = require('../../sockets/socketService');
      socketService.getIo().to(req.user.id).emit('todo_updated');

      res.status(200).json({ success: true, message: 'Todo deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async deleteAllTodos(req, res, next) {
    try {
      const userId = req.user.id;
      await todoService.deleteAllTodos(userId);

      // Emit real-time update
      const socketService = require('../../sockets/socketService');
      socketService.getIo().to(userId).emit('todo_updated');

      res.status(200).json({ success: true, message: 'All todos cleared' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TodoController();
