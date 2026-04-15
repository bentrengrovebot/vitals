const BASE = '/api';

function getTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'Pacific/Auckland'; }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Timezone': getTimezone(), ...options.headers },
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
  updateDiaryEntry: (id, data) => request(`/diary/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getDiaryRange: (start, end) => request(`/diary/range/query?start=${start}&end=${end}`),
  copyMeal: (fromDate, toDate, slot) => request('/diary/copy', { method: 'POST', body: JSON.stringify({ fromDate, toDate, slot }) }),

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
  logSupplement: (data) => request('/supplements/log', { method: 'POST', body: JSON.stringify(typeof data === 'string' ? { supplementId: data } : data) }),
  updateSupplementLog: (id, data) => request(`/supplements/log/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplementLog: (id) => request(`/supplements/log/${id}`, { method: 'DELETE' }),

  // Training
  searchExercises: (q, muscle) => request(`/training/exercises?q=${encodeURIComponent(q || '')}&muscle=${muscle || ''}`),
  getExerciseHistory: (id) => request(`/training/exercises/${id}/last`),
  getPlans: () => request('/training/plans'),
  getPlan: (id) => request(`/training/plans/${id}`),
  seedPlan: () => request('/training/plans/seed', { method: 'POST' }),
  startFromPlan: (planDayId, name, date) => request('/training/sessions/from-plan', { method: 'POST', body: JSON.stringify({ planDayId, name, date }) }),
  createExercise: (data) => request('/training/exercises', { method: 'POST', body: JSON.stringify(data) }),
  getTrainingSessions: (date) => request(`/training/sessions${date ? '?date=' + date : ''}`),
  getSessionById: (id) => request(`/training/sessions/${id}`),
  createSession: (data) => request('/training/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateSession: (id, data) => request(`/training/sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSession: (id) => request(`/training/sessions/${id}`, { method: 'DELETE' }),
  addSet: (sessionId, data) => request(`/training/sessions/${sessionId}/sets`, { method: 'POST', body: JSON.stringify(data) }),
  updateSet: (id, data) => request(`/training/sets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSet: (id) => request(`/training/sets/${id}`, { method: 'DELETE' }),
  getTrainingVolume: (days) => request(`/training/volume?days=${days || 30}`),

  // Bloods & Biomarkers
  getBloods: () => request('/bloods'),
  getBloodTest: (id) => request(`/bloods/${id}`),
  createBloodTest: (data) => request('/bloods', { method: 'POST', body: JSON.stringify(data) }),
  deleteBloodTest: (id) => request(`/bloods/${id}`, { method: 'DELETE' }),
  extractBloodPdf: (content) => request('/bloods/extract', { method: 'POST', body: JSON.stringify({ content }) }),
  getMarkerHistory: (name) => request(`/bloods/marker/${name}`),

  // Knowledge Base
  getKnowledgeDocs: () => request('/knowledge'),
  createKnowledgeDoc: (data) => request('/knowledge', { method: 'POST', body: JSON.stringify(data) }),
  updateKnowledgeDoc: (id, data) => request(`/knowledge/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteKnowledgeDoc: (id) => request(`/knowledge/${id}`, { method: 'DELETE' }),

  // Weekly
  runWeeklyCheckin: () => request('/weekly/run', { method: 'POST' }),
  getLatestWeekly: () => request('/weekly/latest'),
  getWeeklyHistory: () => request('/weekly/history'),
  acceptWeeklyTargets: (id) => request(`/weekly/${id}/accept`, { method: 'POST' }),

  // Data
  clearAll: () => request('/data/all', { method: 'DELETE' }),
  exportData: () => request('/data/export'),

  // Foods
  // My Foods
  getMyFoods: () => request('/my-foods'),
  createMyFood: (data) => request('/my-foods', { method: 'POST', body: JSON.stringify(data) }),
  updateMyFood: (id, data) => request(`/my-foods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMyFood: (id) => request(`/my-foods/${id}`, { method: 'DELETE' }),

  searchFoods: (q) => request(`/foods/search?q=${encodeURIComponent(q)}`),
  aiSearchFood: (name, grams) => request('/foods/ai-search', { method: 'POST', body: JSON.stringify({ name, grams }) }),

  // Whoop
  getWhoopStatus: () => request('/whoop/status'),
  syncWhoop: () => request('/whoop/sync', { method: 'POST' }),
  getWhoopDaily: (date) => request(`/whoop/daily/${date}`),
  disconnectWhoop: () => request('/whoop/disconnect', { method: 'POST' }),

  // Training
  searchExercises: (q, muscle) => request(`/training/exercises?q=${encodeURIComponent(q || '')}&muscle=${muscle || ''}`),
  createExercise: (data) => request('/training/exercises', { method: 'POST', body: JSON.stringify(data) }),
  getTrainingSessions: (date) => request(`/training/sessions${date ? '?date=' + date : ''}`),
  getSessionById: (id) => request(`/training/sessions/${id}`),
  createSession: (data) => request('/training/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateSession: (id, data) => request(`/training/sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSession: (id) => request(`/training/sessions/${id}`, { method: 'DELETE' }),
  addSet: (sessionId, data) => request(`/training/sessions/${sessionId}/sets`, { method: 'POST', body: JSON.stringify(data) }),
  updateSet: (id, data) => request(`/training/sets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSet: (id) => request(`/training/sets/${id}`, { method: 'DELETE' }),
  getTrainingVolume: (days) => request(`/training/volume?days=${days || 30}`),
};
