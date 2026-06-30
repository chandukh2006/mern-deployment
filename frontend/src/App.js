import React, { useEffect, useState } from 'react';
import axios from 'axios';

// In production this should point to your API domain, e.g. https://api.mydomain.com/api
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState('');

  const fetchTodos = async () => {
    const res = await axios.get(`${API_URL}/todos`);
    setTodos(res.data);
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const addTodo = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await axios.post(`${API_URL}/todos`, { text });
    setText('');
    fetchTodos();
  };

  const toggleTodo = async (todo) => {
    await axios.put(`${API_URL}/todos/${todo._id}`, {
      completed: !todo.completed
    });
    fetchTodos();
  };

  const deleteTodo = async (id) => {
    await axios.delete(`${API_URL}/todos/${id}`);
    fetchTodos();
  };

  return (
    <div className="container">
      <h1>📝 MERN Todo</h1>
      <form className="todo-form" onSubmit={addTodo}>
        <input
          type="text"
          placeholder="Add a new task..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
      <div className="todo-list">
        {todos.map((todo) => (
          <div
            key={todo._id}
            className={`todo-item ${todo.completed ? 'completed' : ''}`}
          >
            <span onClick={() => toggleTodo(todo)} style={{ cursor: 'pointer' }}>
              {todo.text}
            </span>
            <div className="actions">
              <button onClick={() => toggleTodo(todo)}>✔</button>
              <button className="delete-btn" onClick={() => deleteTodo(todo._id)}>
                ✕
              </button>
            </div>
          </div>
        ))}
        {todos.length === 0 && <p>No todos yet. Add one above!</p>}
      </div>
    </div>
  );
}

export default App;
