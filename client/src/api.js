const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (res.status === 401 && !path.includes('/auth/')) {
    window.location.href = '/login';
    throw new Error('Not authenticated');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  signup: (email, password) => request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, newPassword) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),

  // Profile & Goals
  getProfile: () => request('/profile'),
  updateProfile: (data) => request('/profile', { method: 'PUT', body: JSON.stringify(data) }),
  getGoals: () => request('/goals'),
  updateGoals: (data) => request('/goals', { method: 'PUT', body: JSON.stringify(data) }),

  // Recipes
  getRecipes: () => request('/recipes'),
  createRecipe: (data) => request('/recipes', { method: 'POST', body: JSON.stringify(data) }),
  updateRecipe: (id, data) => request(`/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRecipe: (id) => request(`/recipes/${id}`, { method: 'DELETE' }),

  // Diary
  getDiary: (date) => request(`/diary/${date}`),
  addDiaryEntry: (data) => request('/diary', { method: 'POST', body: JSON.stringify(data) }),
  deleteDiaryEntry: (id) => request(`/diary/${id}`, { method: 'DELETE' }),
  getDiaryRange: (start, end) => request(`/diary/range/query?start=${start}&end=${end}`),

  // Weigh-ins
  getWeighIns: (limit = 14) => request(`/weighins?limit=${limit}`),
  logWeighIn: (weightKg) => request('/weighins', { method: 'POST', body: JSON.stringify({ weightKg }) }),
  deleteWeighIn: (id) => request(`/weighins/${id}`, { method: 'DELETE' }),

  // Symptoms
  getSymptoms: (limit = 20) => request(`/symptoms?limit=${limit}`),
  logSymptom: (data) => request('/symptoms', { method: 'POST', body: JSON.stringify(data) }),
  deleteSymptom: (id) => request(`/symptoms/${id}`, { method: 'DELETE' }),

  // Water
  getWater: (date) => request(`/water/${date}`),
  logWater: (amountMl) => request('/water', { method: 'POST', body: JSON.stringify({ amountMl }) }),
  deleteWater: (id) => request(`/water/${id}`, { method: 'DELETE' }),

  // Supplements
  getSupplements: () => request('/supplements'),
  createSupplement: (data) => request('/supplements', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplement: (id, data) => request(`/supplements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplement: (id) => request(`/supplements/${id}`, { method: 'DELETE' }),
  getSupplementLogs: (date) => request(`/supplements/log/${date}`),
  logSupplement: (supplementId) => request('/supplements/log', { method: 'POST', body: JSON.stringify({ supplementId }) }),
  deleteSupplementLog: (id) => request(`/supplements/log/${id}`, { method: 'DELETE' }),

  // AI
  chat: (messages) => request('/ai/chat', { method: 'POST', body: JSON.stringify({ messages }) }),
  insight: (days) => request('/ai/insight', { method: 'POST', body: JSON.stringify({ days }) }),
  estimate: (name, grams) => request('/ai/estimate', { method: 'POST', body: JSON.stringify({ name, grams }) }),
  getInsights: () => request('/ai/insights'),

  // Data
  clearAll: () => request('/data/all', { method: 'DELETE' }),
  exportData: () => request('/data/export'),
};
