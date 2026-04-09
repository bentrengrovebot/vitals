import { useState } from 'react';
import Diary from '../pages/Diary';
import Recipes from '../pages/Recipes';
import RecipeEdit from '../pages/RecipeEdit';
import FoodPicker from '../pages/FoodPicker';
import Training from '../pages/Training';
import Insights from '../pages/Insights';
import Settings from '../pages/Settings';

const TABS = [
  { id: 'diary', label: 'Diary' },
  { id: 'training', label: 'Training' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'insights', label: 'Insights' },
  { id: 'settings', label: 'Settings' },
];

const NAV_ICONS = {
  diary: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
  training: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6.5 6.5h11M6.5 17.5h11M4 10h1.5M4 14h1.5M18.5 10H20M18.5 14H20M7.5 10v4M16.5 10v4M9.5 8v8M14.5 8v8"/></svg>,
  recipes: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 11h.01"/><path d="M11 15h.01"/><path d="M16 16h.01"/><path d="m2 16 20 6-6-20A20 20 0 0 0 2 16"/></svg>,
  insights: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>,
  settings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
};

export default function Shell() {
  const [screen, setScreen] = useState('diary');
  const [pickerSlot, setPickerSlot] = useState(null);
  const [editRecipe, setEditRecipe] = useState(null);
  const [pickerDate, setPickerDate] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);
  const openPicker = (slot, date) => { setPickerSlot(slot); setPickerDate(date); setScreen('picker'); };
  const openRecipeEdit = (recipe) => { setEditRecipe(recipe); setScreen('recipe_edit'); };

  const showNav = !['picker', 'recipe_edit'].includes(screen);
  const isOverlay = ['picker', 'recipe_edit'].includes(screen);

  const content = (
    <>
      {screen === 'diary' && <Diary key={refreshKey} openPicker={openPicker} goTo={setScreen} />}
      {screen === 'training' && <Training goTo={setScreen} />}
      {screen === 'recipes' && <Recipes onEdit={openRecipeEdit} goTo={setScreen} />}
      {screen === 'recipe_edit' && <RecipeEdit recipe={editRecipe} onBack={() => { setScreen('recipes'); refresh(); }} />}
      {screen === 'picker' && <FoodPicker slot={pickerSlot} date={pickerDate} onBack={() => { setScreen('diary'); refresh(); }} />}
      {screen === 'insights' && <Insights goTo={setScreen} />}
      {screen === 'settings' && <Settings goTo={setScreen} onRefresh={refresh} />}
    </>
  );

  // ============ MOBILE (<768px) ============
  const mobileLayout = (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      {content}
      {showNav && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480, background: '#fff', borderTop: '1px solid #EEEEEE',
          display: 'flex', zIndex: 50, padding: '6px 8px 28px',
        }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setScreen(tab.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', padding: '8px 0',
                color: screen === tab.id ? '#E53935' : '#BDBDBD', fontSize: 10, fontWeight: 600,
              }}>
              {NAV_ICONS[tab.id]}
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ============ DESKTOP (>=768px) ============
  const desktopLayout = (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Left Sidebar */}
      <div style={{
        width: 220, background: '#fff', borderRight: '1px solid #EEEEEE',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 60,
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #EEEEEE' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#212121', letterSpacing: '-0.5px' }}>Vitals</div>
          <div style={{ fontSize: 11, color: '#BDBDBD', fontWeight: 500, marginTop: 2 }}>Health Tracker</div>
        </div>

        {/* Nav Items */}
        <div style={{ padding: '12px 10px', flex: 1 }}>
          {TABS.map(tab => {
            const active = screen === tab.id;
            return (
              <button key={tab.id} onClick={() => setScreen(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '12px 14px', borderRadius: 10, border: 'none', marginBottom: 4,
                  background: active ? '#FBE9E7' : 'transparent',
                  color: active ? '#E53935' : '#757575',
                  fontSize: 14, fontWeight: active ? 700 : 500, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                {NAV_ICONS[tab.id]}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, marginLeft: 220, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 600, minHeight: '100vh' }}>
          {content}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile */}
      <div className="shell-mobile" style={{ display: 'block' }}>{mobileLayout}</div>
      {/* Desktop */}
      <div className="shell-desktop" style={{ display: 'none' }}>{desktopLayout}</div>

      <style>{`
        @media (min-width: 768px) {
          .shell-mobile { display: none !important; }
          .shell-desktop { display: block !important; }
        }
      `}</style>
    </>
  );
}
