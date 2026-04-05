import { useState, useEffect } from 'react';
import Home from '../pages/Home';
import Training from '../pages/Training';
import More from '../pages/More';
import WhoopScreen from '../pages/WhoopScreen';
import RecipeEdit from '../pages/RecipeEdit';
import FoodPicker from '../pages/FoodPicker';
import VitalsChat from '../pages/VitalsChat';
import Onboarding from '../pages/Onboarding';
import { api } from '../api';

function dateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
}

export default function Shell() {
  const [screen, setScreen] = useState('home');
  const [pickerSlot, setPickerSlot] = useState(null);
  const [pickerDate, setPickerDate] = useState(null);
  const [editRecipe, setEditRecipe] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [weightVal, setWeightVal] = useState('');
  const [needsOnboarding, setNeedsOnboarding] = useState(null); // null = loading, true/false
  const isDesktop = useIsDesktop();

  // Check if user needs onboarding
  useEffect(() => {
    api.getProfile().then(p => {
      setNeedsOnboarding(!p || !p.name);
    }).catch(() => setNeedsOnboarding(false));
  }, []);

  const refresh = () => setRefreshKey(k => k + 1);

  if (needsOnboarding === null) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7' }}><div style={{ fontSize: 24, fontWeight: 700 }}>Vitals</div></div>;
  }

  if (needsOnboarding) {
    return <Onboarding onComplete={() => { setNeedsOnboarding(false); refresh(); }} />;
  }

  const openPicker = (slot, date) => {
    setPickerSlot(slot);
    setPickerDate(date);
    setScreen('picker');
  };

  const openRecipeEdit = (recipe) => {
    setEditRecipe(recipe);
    setScreen('recipe_edit');
  };

  const logWeight = async () => {
    if (!weightVal) return;
    await api.logWeighIn(parseFloat(weightVal));
    setWeightVal('');
    setShowWeightInput(false);
    setShowShortcuts(false);
    refresh();
  };

  const addQuickWater = async (ml) => {
    await api.logWater(ml);
    setShowShortcuts(false);
    refresh();
  };

  const isOverlay = screen === 'vitals' || screen === 'picker' || screen === 'recipe_edit';
  const t2 = '#9ca3af';

  // NAV ITEMS
  const navItems = [
    { id: 'home', label: 'Home', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { id: 'training', label: 'Training', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h11M6.5 17.5h11M4 10h1.5M4 14h1.5M18.5 10H20M18.5 14H20M7.5 10v4M16.5 10v4M9.5 8v8M14.5 8v8"/></svg> },
    { id: 'more', label: 'More', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg> },
  ];

  // ═══ DESKTOP LAYOUT ═══
  if (isDesktop) {
    return (
      <div style={{ display: 'flex', height: '100vh', background: '#f5f5f7' }}>
        {/* Left Sidebar */}
        <div style={{ width: 220, background: '#ffffff', borderRight: '1px solid #e5e5e7', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Logo */}
          <div style={{ padding: '24px 20px 20px', fontSize: 20, fontWeight: 700, color: '#1a1a1a', letterSpacing: -0.5 }}>Vitals</div>

          {/* Nav items */}
          <div style={{ flex: 1, padding: '0 10px' }}>
            {navItems.map(item => {
              const active = screen === item.id;
              return (
                <button key={item.id} onClick={() => setScreen(item.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px',
                  borderRadius: 10, border: 'none', marginBottom: 4,
                  background: active ? '#f0f0f2' : 'transparent',
                  color: active ? '#1a1a1a' : '#6b7280',
                  fontSize: 14, fontWeight: active ? 600 : 400, transition: 'all 0.15s',
                }}>
                  {item.icon}
                  {item.label}
                </button>
              );
            })}

            {/* Quick actions */}
            <div style={{ borderTop: '1px solid #e5e5e7', marginTop: 12, paddingTop: 12 }}>
              <button onClick={() => openPicker('Breakfast', dateKey())} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', background: 'transparent', color: '#6b7280', fontSize: 13 }}>
                <span style={{ fontSize: 16 }}>🍽</span> Log Food
              </button>
              <button onClick={() => addQuickWater(250)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', background: 'transparent', color: '#6b7280', fontSize: 13 }}>
                <span style={{ fontSize: 16 }}>💧</span> + 250ml Water
              </button>
            </div>
          </div>

          {/* Vitals AI button at bottom of sidebar */}
          <div style={{ padding: '12px 10px 20px' }}>
            <button onClick={() => setScreen('vitals')} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px',
              borderRadius: 12, border: '1.5px solid #2dba8e',
              background: screen === 'vitals' ? 'rgba(45,186,142,0.08)' : '#ffffff',
              color: '#2dba8e', fontSize: 14, fontWeight: 600,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2dba8e" strokeWidth="2.5" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Vitals AI
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflowY: 'auto', maxWidth: 600 }}>
          {screen === 'home' && <Home key={refreshKey} openPicker={openPicker} goTo={setScreen} />}
          {screen === 'whoop' && <WhoopScreen />}
          {screen === 'more' && <More goTo={setScreen} onRefresh={refresh} openRecipeEdit={openRecipeEdit} />}
          {screen === 'recipe_edit' && <RecipeEdit recipe={editRecipe} onBack={() => { setScreen('more'); refresh(); }} />}
          {screen === 'picker' && <FoodPicker slot={pickerSlot} date={pickerDate} onBack={() => { setScreen('home'); refresh(); }} />}
          {screen === 'vitals' && (
            <div style={{ padding: '20px 20px 0' }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#1a1a1a', marginBottom: 16 }}>Vitals AI</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>Use the chat panel on the right →</div>
            </div>
          )}
        </div>

        {/* Right Panel — Persistent AI Chat */}
        <div style={{ width: 380, background: '#ffffff', borderLeft: '1px solid #e5e5e7', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <VitalsChat onBack={() => {}} isPanel={true} />
        </div>
      </div>
    );
  }

  // ═══ MOBILE LAYOUT ═══
  return (
    <div style={{ minHeight: '100vh', maxWidth: 430, margin: '0 auto', position: 'relative', zIndex: 1, background: '#f5f5f7' }}>
      {screen === 'home' && <Home key={refreshKey} openPicker={openPicker} goTo={setScreen} />}
      {screen === 'training' && <Training />}
      {screen === 'whoop' && <WhoopScreen />}
      {screen === 'more' && <More goTo={setScreen} onRefresh={refresh} openRecipeEdit={openRecipeEdit} />}
      {screen === 'recipe_edit' && <RecipeEdit recipe={editRecipe} onBack={() => { setScreen('more'); refresh(); }} />}
      {screen === 'picker' && <FoodPicker slot={pickerSlot} date={pickerDate} onBack={() => { setScreen('home'); refresh(); }} />}
      {screen === 'vitals' && <VitalsChat onBack={() => setScreen('home')} />}

      {/* Shortcuts overlay */}
      {showShortcuts && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => { setShowShortcuts(false); setShowWeightInput(false); }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: 430, padding: '0 16px 100px',
          }}>
            <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e5e5e7', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid #e5e5e7' }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>Quick Actions</span>
                <button onClick={() => { setShowShortcuts(false); setShowWeightInput(false); }} style={{ background: 'none', border: 'none', color: t2, fontSize: 18 }}>×</button>
              </div>
              {showWeightInput && (
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e5e7' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" value={weightVal} onChange={e => setWeightVal(e.target.value)} placeholder="Weight (kg)" autoFocus step="0.1"
                      style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid #e5e5e7', background: '#ffffff', fontSize: 15, color: '#1a1a1a' }} />
                    <button onClick={logWeight} style={{ padding: '12px 20px', borderRadius: 10, background: '#2dba8e', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600 }}>Log</button>
                  </div>
                </div>
              )}
              {[
                { icon: '🍽', label: 'Log Food', sub: 'Add to today\'s meals', action: () => { setShowShortcuts(false); openPicker('Breakfast', dateKey()); } },
                { icon: '⚖️', label: 'Log Weight', sub: 'Record today\'s weigh-in', action: () => setShowWeightInput(true) },
                { icon: '💧', label: '+ 250ml Water', sub: 'Quick add', action: () => addQuickWater(250) },
                { icon: '💧', label: '+ 500ml Water', sub: 'Quick add', action: () => addQuickWater(500) },
                { icon: '🧠', label: 'Ask Vitals AI', sub: 'Chat with your coach', action: () => { setShowShortcuts(false); setScreen('vitals'); } },
              ].map((item, i) => (
                <button key={i} onClick={item.action} style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 18px',
                  background: 'none', border: 'none', borderTop: i > 0 ? '1px solid #f0f0f2' : 'none', textAlign: 'left',
                }}>
                  <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{item.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      {!isOverlay && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430, display: 'flex', alignItems: 'center',
          padding: '6px 10px 30px',
          background: '#ffffff', borderTop: '1px solid #e5e5e7', zIndex: 100,
        }}>
          <div style={{ display: 'flex', flex: 1, background: '#f0f0f2', borderRadius: 16, padding: '4px', border: '1px solid #e5e5e7' }}>
            {navItems.map(tab => {
              const active = screen === tab.id;
              return (
                <button key={tab.id} onClick={() => setScreen(tab.id)} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  background: active ? '#ffffff' : 'transparent',
                  border: 'none', padding: '10px 0', borderRadius: 12,
                  color: active ? '#1a1a1a' : '#9ca3af',
                  fontSize: 9, fontWeight: 600, letterSpacing: '0.5px',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s ease',
                }}>
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
          <button onClick={() => setShowShortcuts(true)} style={{
            width: 54, height: 54, borderRadius: '50%',
            background: '#ffffff', border: '1.5px solid #2dba8e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginLeft: 6, flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2dba8e" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
