import { useState } from 'react';
import Home from '../pages/Home';
import Health from '../pages/Health';
import More from '../pages/More';
import RecipeEdit from '../pages/RecipeEdit';
import FoodPicker from '../pages/FoodPicker';
import VitalsChat from '../pages/VitalsChat';

export default function Shell() {
  const [screen, setScreen] = useState('home');
  const [pickerSlot, setPickerSlot] = useState(null);
  const [pickerDate, setPickerDate] = useState(null);
  const [editRecipe, setEditRecipe] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

  const openPicker = (slot, date) => {
    setPickerSlot(slot);
    setPickerDate(date);
    setScreen('picker');
  };

  const openRecipeEdit = (recipe) => {
    setEditRecipe(recipe);
    setScreen('recipe_edit');
  };

  const isOverlay = screen === 'vitals' || screen === 'picker' || screen === 'recipe_edit';

  return (
    <div style={{ minHeight: '100vh', maxWidth: 430, margin: '0 auto', position: 'relative', zIndex: 1 }}>
      {screen === 'home' && <Home key={refreshKey} openPicker={openPicker} goTo={setScreen} />}
      {screen === 'health' && <Health goTo={setScreen} />}
      {screen === 'more' && <More goTo={setScreen} onRefresh={refresh} openRecipeEdit={openRecipeEdit} />}
      {screen === 'recipe_edit' && <RecipeEdit recipe={editRecipe} onBack={() => { setScreen('more'); refresh(); }} />}
      {screen === 'picker' && <FoodPicker slot={pickerSlot} date={pickerDate} onBack={() => { setScreen('home'); refresh(); }} />}
      {screen === 'vitals' && <VitalsChat onBack={() => setScreen('home')} />}

      {!isOverlay && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430,
          display: 'flex', alignItems: 'center',
          padding: '6px 10px 30px',
          background: 'linear-gradient(180deg, rgba(18,21,26,0.85), rgba(18,21,26,0.98))',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          zIndex: 100,
        }}>
          {/* Pillbox nav container */}
          <div style={{ display: 'flex', flex: 1, background: '#1e2228', borderRadius: 16, padding: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { id: 'home', label: 'Home', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
              { id: 'health', label: 'Health', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
              { id: 'more', label: 'More', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg> },
            ].map(tab => {
              const active = screen === tab.id;
              return (
                <button key={tab.id} onClick={() => setScreen(tab.id)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: 'none', padding: '10px 0', borderRadius: 12,
                    color: active ? '#ffffff' : 'rgba(255,255,255,0.25)',
                    fontSize: 9, fontWeight: 600, letterSpacing: '0.5px',
                    boxShadow: active ? '0 0 12px rgba(255,255,255,0.04)' : 'none',
                    transition: 'all 0.2s ease',
                  }}>
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
          {/* FAB - Vitals AI */}
          <button onClick={() => setScreen('vitals')}
            style={{
              width: 54, height: 54, borderRadius: '50%',
              background: 'radial-gradient(circle at 50% 50%, rgba(30,50,60,0.9), rgba(20,30,40,0.95))',
              border: '1.5px solid rgba(45,186,142,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: 6, flexShrink: 0,
              boxShadow: '0 0 25px rgba(45,186,142,0.12), inset 0 0 15px rgba(45,186,142,0.05)',
            }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2dba8e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
